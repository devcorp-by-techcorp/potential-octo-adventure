"""Staff identities and opaque, revocable MongoDB sessions. No public registration."""

import hashlib
import secrets
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from starlette.concurrency import run_in_threadpool

from config import get_settings
from db import get_database

router = APIRouter(prefix="/api")
PASSWORDS = PasswordHasher(type=Type.ID)
# Equal-cost verification for unknown, disabled and non-staff identities.
DUMMY_HASH = PASSWORDS.hash(secrets.token_urlsafe(32))
AUTH_ERROR = "Email or password is incorrect."
WINDOW_SECONDS = 900


def now():
    return datetime.now(UTC)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def cookie_name():
    return "__Host-studio_session" if get_settings().is_production else "studio_session"


def csrf_token(token):
    return digest("studio-csrf:" + token)


@contextmanager
def database_errors():
    try:
        yield
    except (PyMongoError, RuntimeError):
        raise HTTPException(
            503, "Studio access is temporarily unavailable. Please try again."
        ) from None


async def ensure_indexes(database):
    await database.staff_identities.create_index("email", unique=True)
    await database.staff_sessions.create_index("expires_at", expireAfterSeconds=0)
    await database.staff_sessions.create_index("identity_id")
    await database.staff_login_limits.create_index("expires_at", expireAfterSeconds=0)


def normalize_email(email):
    return email.strip().casefold()


def password_hash(password):
    if not 12 <= len(password) <= 1024:
        raise ValueError("Passwords must contain 12–1024 characters.")
    return PASSWORDS.hash(password)


def verify_password(encoded, password):
    try:
        return PASSWORDS.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def require_origin(request: Request):
    if request.headers.get("origin") not in get_settings().auth_origin_list():
        raise HTTPException(403, "Request origin is not allowed.")


async def throttle(database, kind, value, limit, collection="staff_login_limits"):
    current = now()
    bucket = int(current.timestamp()) // WINDOW_SECONDS
    record = await database[collection].find_one_and_update(
        {"_id": digest(f"{kind}:{value}:{bucket}")},
        {
            "$inc": {"attempts": 1},
            "$setOnInsert": {
                "expires_at": datetime.fromtimestamp((bucket + 1) * WINDOW_SECONDS, UTC)
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if record["attempts"] > limit:
        remaining = (bucket + 1) * WINDOW_SECONDS - int(current.timestamp())
        raise HTTPException(
            429,
            "Too many sign-in attempts. Please try again later.",
            headers={"Retry-After": str(remaining)},
        )


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=1, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=1024)


def public_identity(identity):
    return {"id": str(identity["_id"]), "email": identity["email"], "name": identity["name"]}


def clear_cookie(response):
    response.delete_cookie(
        cookie_name(), path="/", secure=get_settings().is_production, httponly=True, samesite="lax"
    )


@router.post("/auth/login", dependencies=[Depends(require_origin)])
async def login(body: LoginBody, request: Request, response: Response):
    email = normalize_email(body.email)
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        # Do not trust arbitrary X-Forwarded-For headers. Configure trusted proxies in Uvicorn.
        await throttle(database, "ip", request.client.host if request.client else "unknown", 20)
        await throttle(database, "email", email, 5)
        identity = await database.staff_identities.find_one({"email": email})
        eligible = identity and identity.get("enabled") and identity.get("role") == "staff"
        encoded = identity["password_hash"] if eligible else DUMMY_HASH
        valid = await run_in_threadpool(verify_password, encoded, body.password.get_secret_value())
        if not eligible or not valid:
            raise HTTPException(401, AUTH_ERROR)
        # Rehash on login without overwriting a concurrent operator reset.
        if PASSWORDS.check_needs_rehash(encoded):
            replacement = await run_in_threadpool(PASSWORDS.hash, body.password.get_secret_value())
            await database.staff_identities.update_one(
                {"_id": identity["_id"], "auth_version": identity["auth_version"]},
                {"$set": {"password_hash": replacement}},
            )
        token = secrets.token_urlsafe(32)
        expires = now() + timedelta(seconds=get_settings().auth_session_seconds)
        await database.staff_sessions.insert_one(
            {
                "_id": digest(token),
                "identity_id": identity["_id"],
                "auth_version": identity["auth_version"],
                "created_at": now(),
                "expires_at": expires,
                "revoked_at": None,
            }
        )
    response.set_cookie(
        cookie_name(),
        token,
        max_age=get_settings().auth_session_seconds,
        expires=expires,
        path="/",
        httponly=True,
        secure=get_settings().is_production,
        samesite="lax",
    )
    return {
        "identity": public_identity(identity),
        "csrf_token": csrf_token(token),
        "expires_at": expires.isoformat(),
        "expires_in_seconds": get_settings().auth_session_seconds,
    }


async def require_staff(request: Request):
    token = request.cookies.get(cookie_name(), "")
    if not token or len(token) > 128:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    with database_errors():
        database = get_database()
        session = await database.staff_sessions.find_one({"_id": digest(token)})
        # Motor's default datetimes are UTC-naive. TTL cleanup is never authorization.
        if (
            not session
            or session.get("revoked_at") is not None
            or session["expires_at"].replace(tzinfo=UTC) <= now()
        ):
            raise HTTPException(401, "Your session has expired. Please sign in again.")
        identity = await database.staff_identities.find_one({"_id": session["identity_id"]})
        if (
            not identity
            or not identity.get("enabled")
            or identity.get("auth_version") != session["auth_version"]
        ):
            raise HTTPException(401, "Your session has expired. Please sign in again.")
        if identity.get("role") != "staff":
            raise HTTPException(403, "Staff access is required.")
    request.state.staff_session = session
    return identity


async def require_staff_write(request: Request, identity: Annotated[dict, Depends(require_staff)]):
    require_origin(request)
    expected = csrf_token(request.cookies.get(cookie_name(), ""))
    if not secrets.compare_digest(
        request.headers.get("x-csrf-token", "").encode(), expected.encode()
    ):
        raise HTTPException(403, "Request verification failed. Reload and try again.")
    return identity


async def fence_staff_write(database, request, identity, session):
    """Bind a transactional write to the still-enabled account and current session.

    Updating both records forces concurrent reset, disable or session withdrawal
    to conflict with the transaction, rather than trusting an earlier dependency.
    Call only after require_staff_write validated Origin and CSRF.
    """
    account = await database.staff_identities.update_one(
        {
            "_id": identity["_id"],
            "role": "staff",
            "enabled": True,
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"authorization_checks": 1}},
        session=session,
    )
    verified = await database.staff_sessions.update_one(
        {
            "_id": digest(request.cookies.get(cookie_name(), "")),
            "identity_id": identity["_id"],
            "revoked_at": None,
            "auth_version": identity["auth_version"],
            "expires_at": {"$gt": now()},
        },
        {"$inc": {"authorization_checks": 1}},
        session=session,
    )
    if not account.matched_count or not verified.matched_count:
        raise HTTPException(401, "Access changed. Please sign in again.")


@router.get("/auth/session")
async def current_session(request: Request, identity: Annotated[dict, Depends(require_staff)]):
    expires = request.state.staff_session["expires_at"].replace(tzinfo=UTC)
    return {
        "identity": public_identity(identity),
        "csrf_token": csrf_token(request.cookies[cookie_name()]),
        "expires_at": expires.isoformat(),
        "expires_in_seconds": max(1, int((expires - now()).total_seconds())),
    }


@router.post("/auth/logout", status_code=204)
async def logout(
    request: Request, response: Response, identity: Annotated[dict, Depends(require_staff_write)]
):
    with database_errors():
        await get_database().staff_sessions.update_one(
            {"_id": digest(request.cookies[cookie_name()])}, {"$set": {"revoked_at": now()}}
        )
    clear_cookie(response)


@router.get("/studio/home")
async def studio_home(identity: Annotated[dict, Depends(require_staff)]):
    return {"identity": public_identity(identity)}


async def fence_staff_session(database, request, identity, session):
    """Fence transactional writes against a concurrent logout/reset/disable."""
    current = request.state.staff_session
    account = await database.staff_identities.update_one(
        {
            "_id": identity["_id"],
            "enabled": True,
            "role": "staff",
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"transaction_checks": 1}},
        session=session,
    )
    active = await database.staff_sessions.update_one(
        {
            "_id": current["_id"],
            "revoked_at": None,
            "expires_at": {"$gt": now()},
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"transaction_checks": 1}},
        session=session,
    )
    if not account.matched_count or not active.matched_count:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
