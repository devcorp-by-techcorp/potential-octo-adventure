"""Client-only opaque sessions; shared staff password/origin/throttle primitives."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field, SecretStr, field_validator
from starlette.concurrency import run_in_threadpool

from auth import (
    AUTH_ERROR,
    DUMMY_HASH,
    PASSWORDS,
    LoginBody,
    database_errors,
    digest,
    normalize_email,
    now,
    public_identity,
    require_origin,
    throttle,
    verify_password,
)
from config import get_settings
from db import get_database


class ClientLoginBody(LoginBody):
    @field_validator("email", "password")
    @classmethod
    def utf8_input(cls, value):
        text = value.get_secret_value() if isinstance(value, SecretStr) else value
        try:
            text.encode("utf-8")
        except UnicodeError:
            raise ValueError("Provide valid sign-in details.") from None
        return value


class ClientIdentity(BaseModel):
    id: str
    email: str
    name: str


class ClientSessionResponse(BaseModel):
    identity: ClientIdentity
    csrf_token: str
    expires_at: datetime
    expires_in_seconds: int = Field(ge=1, le=604800)


def cookie_name():
    return "__Host-client_session" if get_settings().is_production else "client_session"


def csrf_token(token):
    return digest("client-csrf:" + token)


async def ensure_indexes(database):
    await database.client_identities.create_index("email", unique=True)
    await database.client_sessions.create_index("expires_at", expireAfterSeconds=0)
    await database.client_sessions.create_index("identity_id")
    await database.client_login_limits.create_index("expires_at", expireAfterSeconds=0)


async def login_budget(database, request, email):
    await throttle(
        database,
        "ip",
        request.client.host if request.client else "unknown",
        20,
        "client_login_limits",
    )
    await throttle(database, "email", email, 5, "client_login_limits")


async def insert_session(database, identity, token, session=None):
    expires = now() + timedelta(seconds=get_settings().auth_session_seconds)
    await database.client_sessions.insert_one(
        {
            "_id": digest(token),
            "scope": "client",
            "identity_id": identity["_id"],
            "auth_version": identity["auth_version"],
            "created_at": now(),
            "expires_at": expires,
            "revoked_at": None,
        },
        session=session,
    )
    return expires


def session_response(response, identity, token, expires):
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
        "expires_in_seconds": max(1, int((expires - now()).total_seconds())),
    }


async def require_client(request: Request):
    token = request.cookies.get(cookie_name(), "")
    denied = HTTPException(401, "Your client session has expired. Please sign in again.")
    if not token or len(token) > 128:
        raise denied
    with database_errors():
        database = get_database()
        session = await database.client_sessions.find_one({"_id": digest(token)})
        if (
            not session
            or session.get("scope") != "client"
            or session.get("revoked_at") is not None
            or session["expires_at"].replace(tzinfo=UTC) <= now()
        ):
            raise denied
        identity = await database.client_identities.find_one({"_id": session["identity_id"]})
        if (
            not identity
            or not identity.get("enabled")
            or identity.get("role") != "client"
            or identity.get("auth_version") != session["auth_version"]
        ):
            raise denied
    request.state.client_session = session
    return identity


async def require_client_write(
    request: Request, identity: Annotated[dict, Depends(require_client)]
):
    require_origin(request)
    if not secrets.compare_digest(
        request.headers.get("x-csrf-token", "").encode(),
        csrf_token(request.cookies[cookie_name()]).encode(),
    ):
        raise HTTPException(403, "Request verification failed. Reload and try again.")
    return identity


async def login(body: LoginBody, request, response):
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        email = normalize_email(body.email)
        await login_budget(database, request, email)
        identity = await database.client_identities.find_one({"email": email})
        eligible = identity and identity.get("enabled") and identity.get("role") == "client"
        encoded = identity["password_hash"] if eligible else DUMMY_HASH
        valid = await run_in_threadpool(verify_password, encoded, body.password.get_secret_value())
        if not eligible or not valid:
            raise HTTPException(401, AUTH_ERROR)
        if PASSWORDS.check_needs_rehash(encoded):
            replacement = await run_in_threadpool(PASSWORDS.hash, body.password.get_secret_value())
            await database.client_identities.update_one(
                {"_id": identity["_id"], "auth_version": identity["auth_version"]},
                {"$set": {"password_hash": replacement}},
            )
        token = secrets.token_urlsafe(32)
        expires = await insert_session(database, identity, token)
    return session_response(response, identity, token, expires)
