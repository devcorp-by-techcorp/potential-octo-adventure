"""Opt-in client password recovery with one-use tokens and encrypted Resend outbox."""

import asyncio
import json
import re
import secrets
from datetime import timedelta
from email.utils import parseaddr
from uuid import uuid4

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import ReturnDocument
from starlette.concurrency import run_in_threadpool

from auth import (
    database_errors,
    digest,
    normalize_email,
    now,
    password_hash,
    require_origin,
    throttle,
)
from client_access import transaction
from client_auth import cookie_name
from config import get_settings
from db import close_database_client, get_database

router = APIRouter(prefix="/api/auth/client/recovery")
GENERIC = "If this account is eligible, recovery instructions will be sent."
INVALID = "This recovery link is invalid or expired. Request a new link."


class RecoverySettings(BaseSettings):
    # Process environment only: deployment must explicitly opt in. Application
    # Resend credentials/sender still use the established Settings boundary.
    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)
    client_recovery_enabled: bool = False
    client_recovery_sender_verified: bool = False
    client_recovery_encryption_key: SecretStr | None = None
    client_recovery_origin: str | None = None
    client_recovery_seconds: int = Field(default=1800, ge=60, le=3600)


def recovery_config():
    try:
        recovery = RecoverySettings()
        settings = get_settings()
        sender = settings.booking_from_email or ""
        address = parseaddr(sender)[1]
        if not (
            recovery.client_recovery_enabled
            and recovery.client_recovery_sender_verified
            and settings.resend_api_key
            and address.count("@") == 1
            and "\r" not in sender
            and "\n" not in sender
            and recovery.client_recovery_origin in settings.auth_origin_list()
            and recovery.client_recovery_encryption_key
        ):
            return None
        cipher = Fernet(recovery.client_recovery_encryption_key.get_secret_value().encode())
        return recovery, settings, cipher
    except (ValueError, TypeError):
        return None


def require_enabled():
    config = recovery_config()
    if config is None:
        raise HTTPException(
            503, "Self-service recovery is unavailable. Contact your studio administrator."
        )
    return config


class RecoveryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=1, max_length=254)

    @field_validator("email")
    @classmethod
    def utf8_email(cls, value):
        if "\r" in value or "\n" in value or "@" not in value:
            raise ValueError("Provide a valid email address.")
        try:
            value.encode("utf-8")
        except UnicodeError:
            raise ValueError("Provide a valid email address.") from None
        return value


class RecoveryReset(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: SecretStr = Field(min_length=43, max_length=43)
    password: SecretStr = Field(min_length=12, max_length=1024)

    @field_validator("token", "password")
    @classmethod
    def safe_secret(cls, value, info):
        plain = value.get_secret_value()
        if info.field_name == "token" and not re.fullmatch(r"[A-Za-z0-9_-]{43}", plain):
            raise ValueError("Invalid recovery link.")
        try:
            plain.encode("utf-8")
        except UnicodeError:
            raise ValueError("Provide valid recovery details.") from None
        return value


async def ensure_indexes(database):
    await database.client_recovery_tokens.create_index("expires_at", expireAfterSeconds=0)
    await database.client_recovery_outbox.create_index("expires_at", expireAfterSeconds=0)
    await database.client_recovery_outbox.create_index([("state", 1), ("expires_at", 1)])
    await database.client_recovery_limits.create_index("expires_at", expireAfterSeconds=0)


async def budget(database, request, email=None, reset=False):
    host = request.client.host if request.client else "unknown"
    await throttle(
        database,
        "reset-ip" if reset else "request-ip",
        host,
        20 if reset else 10,
        "client_recovery_limits",
    )
    if email is not None:
        await throttle(database, "request-email", email, 3, "client_recovery_limits")


@router.get("/status")
async def status():
    return {"enabled": recovery_config() is not None}


@router.post("/request", status_code=202, dependencies=[Depends(require_origin)])
async def request_recovery(body: RecoveryRequest, request: Request, tasks: BackgroundTasks):
    recovery, settings, cipher = require_enabled()
    email = normalize_email(body.email)
    # Generate/encrypt the same bounded material for unknown/disabled identities;
    # the public response never exposes lookup or delivery results.
    token = secrets.token_urlsafe(32)
    token_hash = digest(token)
    job_id = str(uuid4())
    expires = now() + timedelta(seconds=recovery.client_recovery_seconds)
    payload = {
        "from": settings.booking_from_email,
        "to": [email],
        "subject": "Reset your Studio Suite client password",
        "text": (
            "A client password reset was requested. It does not confirm a booking "
            "or change access.\n"
            f"Open this link before {expires.isoformat()}:\n"
            f"{recovery.client_recovery_origin}/client/recovery#{token}\n"
            "If you did not request this, ignore this email."
        ),
    }
    encrypted = cipher.encrypt(json.dumps(payload, separators=(",", ":")).encode()).decode()
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        await budget(database, request, email)

        async def issue(session):
            identity = await database.client_identities.find_one(
                {"email": email, "enabled": True, "role": "client"},
                session=session,
            )
            if identity is None:
                return False
            await database.client_recovery_tokens.insert_one(
                {
                    "_id": token_hash,
                    "identity_id": identity["_id"],
                    "auth_version": identity["auth_version"],
                    "created_at": now(),
                    "expires_at": expires,
                    "consumed_at": None,
                },
                session=session,
            )
            await database.client_recovery_outbox.insert_one(
                {
                    "_id": job_id,
                    "token_hash": token_hash,
                    "identity_id": identity["_id"],
                    "auth_version": identity["auth_version"],
                    "ciphertext": encrypted,
                    "state": "pending",
                    "attempts": 0,
                    "created_at": now(),
                    "expires_at": expires,
                },
                session=session,
            )
            return True

        issued = await transaction(database, issue)
    if issued:
        tasks.add_task(deliver_recovery, job_id)
    return {"message": GENERIC}


@router.post("/reset", dependencies=[Depends(require_origin)])
async def reset_password(body: RecoveryReset, request: Request, response: Response):
    require_enabled()
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        await budget(database, request, reset=True)
    replacement = await run_in_threadpool(password_hash, body.password.get_secret_value())
    token_hash = digest(body.token.get_secret_value())
    auth_version = str(uuid4())
    with database_errors():

        async def consume(session):
            token = await database.client_recovery_tokens.find_one(
                {
                    "_id": token_hash,
                    "consumed_at": None,
                    "expires_at": {"$gt": now()},
                },
                session=session,
            )
            if token is None:
                raise HTTPException(400, INVALID)
            changed = await database.client_identities.update_one(
                {
                    "_id": token["identity_id"],
                    "role": "client",
                    "enabled": True,
                    "auth_version": token["auth_version"],
                },
                {
                    "$set": {
                        "password_hash": replacement,
                        "auth_version": auth_version,
                        "updated_at": now(),
                    }
                },
                session=session,
            )
            if changed.modified_count != 1:
                raise HTTPException(400, INVALID)
            consumed = await database.client_recovery_tokens.update_one(
                {
                    "_id": token_hash,
                    "consumed_at": None,
                },
                {"$set": {"consumed_at": now()}},
                session=session,
            )
            if consumed.modified_count != 1:
                raise HTTPException(400, INVALID)
            # Other links tied to the old auth_version cannot reset again.
            # Cancel queued delivery and purge encrypted payloads immediately.
            await database.client_recovery_outbox.update_many(
                {
                    "identity_id": token["identity_id"],
                    "auth_version": token["auth_version"],
                },
                {"$set": {"state": "cancelled"}, "$unset": {"ciphertext": ""}},
                session=session,
            )

        await transaction(database, consume)
    response.delete_cookie(
        cookie_name(), path="/", secure=get_settings().is_production, httponly=True, samesite="lax"
    )
    return {"message": "Password changed. Sign in with your new password."}


async def send_recovery_email(payload, idempotency_key):
    """The only external-provider boundary; tests replace it with a mail sink."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {get_settings().resend_api_key}",
                "Idempotency-Key": idempotency_key,
            },
            json=payload,
        )
    response.raise_for_status()
    receipt = response.json()
    if not isinstance(receipt, dict) or not isinstance(receipt.get("id"), str) or not receipt["id"]:
        raise RuntimeError("Recovery provider did not acknowledge delivery.")


async def deliver_recovery(job_id):
    # Delivery never changes the public request result or logs recipient/token.
    try:
        await _deliver_recovery(job_id)
    except Exception:
        return


async def _deliver_recovery(job_id):
    config = recovery_config()
    if config is None:
        return
    _, _, cipher = config
    database = get_database()
    claim = str(uuid4())
    job = await database.client_recovery_outbox.find_one_and_update(
        {
            "_id": job_id,
            "expires_at": {"$gt": now()},
            "attempts": {"$lt": 5},
            "$or": [
                {"state": {"$in": ["pending", "failed"]}},
                {"state": "sending", "attempted_at": {"$lt": now() - timedelta(minutes=5)}},
            ],
        },
        {
            "$set": {"state": "sending", "claim": claim, "attempted_at": now()},
            "$inc": {"attempts": 1},
        },
        return_document=ReturnDocument.AFTER,
    )
    if job is None:
        return
    fence = {"_id": job_id, "claim": claim, "state": "sending"}
    token = await database.client_recovery_tokens.find_one(
        {
            "_id": job["token_hash"],
            "consumed_at": None,
            "expires_at": {"$gt": now()},
        }
    )
    identity = await database.client_identities.find_one(
        {
            "_id": job["identity_id"],
            "role": "client",
            "enabled": True,
            "auth_version": job["auth_version"],
        }
    )
    if token is None or identity is None:
        await database.client_recovery_outbox.update_one(
            fence,
            {"$set": {"state": "cancelled"}, "$unset": {"ciphertext": ""}},
        )
        return
    try:
        payload = json.loads(cipher.decrypt(job["ciphertext"].encode()))
        await send_recovery_email(payload, "studio-client-recovery-" + job_id)
    except (httpx.HTTPError, InvalidToken, ValueError, KeyError, RuntimeError):
        await database.client_recovery_outbox.update_one(fence, {"$set": {"state": "failed"}})
    else:
        await database.client_recovery_outbox.update_one(
            fence,
            {"$set": {"state": "sent", "sent_at": now()}, "$unset": {"ciphertext": ""}},
        )


async def retry_recovery():
    if recovery_config() is None:
        return
    database = get_database()
    await ensure_indexes(database)
    async for job in (
        database.client_recovery_outbox.find(
            {
                "state": {"$in": ["pending", "failed", "sending"]},
                "expires_at": {"$gt": now()},
                "attempts": {"$lt": 5},
            }
        )
        .limit(100)
        .max_time_ms(5000)
    ):
        await deliver_recovery(job["_id"])


if __name__ == "__main__":
    from pathlib import Path

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
    get_settings.cache_clear()
    try:
        asyncio.run(retry_recovery())
    finally:
        close_database_client()
