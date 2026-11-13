"""Transactional staff invitations and explicit, read-only client enquiry grants."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern
from starlette.concurrency import run_in_threadpool

import client_auth as clients
from auth import (
    database_errors,
    digest,
    fence_staff_session,
    normalize_email,
    now,
    password_hash,
    require_origin,
    require_staff,
    require_staff_write,
    verify_password,
)
from config import get_settings
from db import get_database
from studio_enquiries import next_cursor, page_query, projection, public_record

router = APIRouter(prefix="/api")
CLIENT_FIELDS = (
    "reference",
    "name",
    "email",
    "phone",
    "event_type",
    "preferred_date",
    "collection",
    "venue",
    "message",
    "consent",
    "state",
    "created_at",
)
INVALID = "This invitation is invalid. Ask the studio for a replacement."


class EmptyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TokenBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: SecretStr = Field(min_length=43, max_length=43)

    @field_validator("token")
    @classmethod
    def opaque_token(cls, value):
        if not set(value.get_secret_value()) <= set(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
        ):
            raise ValueError("Invalid invitation secret.")
        return value


class AcceptBody(TokenBody):
    password: SecretStr | None = Field(default=None, min_length=12, max_length=1024)
    recover: bool = Field(default=False, strict=True)

    @field_validator("password")
    @classmethod
    def utf8_password(cls, value):
        return clients.ClientLoginBody.utf8_input(value) if value is not None else value


class ClientEnquiry(BaseModel):
    id: UUID
    reference: str
    name: str
    email: str
    phone: str = ""
    event_type: str
    preferred_date: str
    collection: str
    venue: str = ""
    message: str = ""
    consent: bool
    state: Literal["awaiting_studio_confirmation"]
    created_at: datetime


class ClientPage(BaseModel):
    items: list[ClientEnquiry]
    next_cursor: str | None = None


class ClientBooking(BaseModel):
    id: UUID
    enquiry_id: UUID
    reference: str
    event_type: str
    scheduled_date: str
    location: str = ""
    state: Literal[
        "planning",
        "confirmed",
        "preparation",
        "shoot",
        "gallery_preparation",
        "delivered",
        "cancelled",
    ]
    updated_at: datetime


class InvitationResponse(BaseModel):
    id: UUID
    status: Literal["pending", "accepted", "revoked", "expired"]
    created_at: datetime
    expires_at: datetime


class IssuedInvitation(InvitationResponse):
    link: str


class InvitationPage(BaseModel):
    items: list[InvitationResponse]
    next_cursor: int | None = None


class PendingInvitation(BaseModel):
    status: Literal["pending"]
    email: str
    existing_account: bool


class ClosedInvitation(BaseModel):
    status: Literal["accepted", "revoked", "expired"]


class AcceptedInvitation(clients.ClientSessionResponse):
    enquiry_id: UUID
    recovered: bool


async def ensure_indexes(database):
    await clients.ensure_indexes(database)
    await database.client_invitations.create_index("token_hash", unique=True)
    await database.client_invitations.create_index(
        [("enquiry_id", 1), ("generation", -1)], unique=True
    )
    await database.client_invitations.create_index("cleanup_at", expireAfterSeconds=0)
    await database.client_access.create_index([("client_id", 1), ("enquiry_id", 1)], unique=True)
    await database.client_access.create_index(
        [("client_id", 1), ("created_at", -1), ("_id", -1)], name="client_access_page"
    )
    await database.client_access.create_index(
        [("enquiry_id", 1), ("granted_at", -1), ("_id", -1)], name="enquiry_access_page"
    )


async def transaction(database, callback):
    # A unique-index conflict between different invitations enrolling the same
    # email can require a fresh snapshot. No partially written outcome escapes.
    for attempt in range(3):
        try:
            async with await database.client.start_session() as session:
                return await session.with_transaction(
                    callback,
                    read_concern=ReadConcern("snapshot"),
                    write_concern=WriteConcern("majority"),
                    max_commit_time_ms=10000,
                )
        except DuplicateKeyError:
            if attempt == 2:
                raise HTTPException(
                    409, "Access changed. Sign in and check your enquiries."
                ) from None


def invitation_status(item):
    if item["status"] == "pending" and item["expires_at"].replace(tzinfo=UTC) <= now():
        return "expired"
    return item["status"]


def invitation_public(item):
    return {
        "id": item["_id"],
        "status": invitation_status(item),
        "created_at": item["created_at"].replace(tzinfo=UTC).isoformat(),
        "expires_at": item["expires_at"].replace(tzinfo=UTC).isoformat(),
    }


@router.post("/studio/enquiries/{enquiry_id}/client-invitations", response_model=IssuedInvitation)
async def issue(
    enquiry_id: UUID,
    body: EmptyBody,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    token = secrets.token_urlsafe(32)
    invitation_id = str(uuid4())
    with database_errors():
        database = get_database()
        await ensure_indexes(database)

        async def write(session):
            enquiry = await database.booking_requests.find_one(
                {"_id": str(enquiry_id)}, {"email": 1}, session=session
            )
            if not enquiry:
                raise HTTPException(404, "Enquiry not found.")
            email = normalize_email(enquiry["email"])
            if not email or "@" not in email or len(email) > 254:
                raise HTTPException(409, "The enquiry contact requires operator review.")
            head = await database.client_invitation_heads.find_one_and_update(
                {"_id": str(enquiry_id)},
                {"$inc": {"generation": 1}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
                session=session,
            )
            await database.client_invitations.update_many(
                {"enquiry_id": str(enquiry_id), "status": "pending", "expires_at": {"$gt": now()}},
                {"$set": {"status": "revoked", "revoked_at": now()}},
                session=session,
            )
            current = now()
            item = {
                "_id": invitation_id,
                "enquiry_id": str(enquiry_id),
                "email": email,
                "generation": head["generation"],
                "token_hash": digest(token),
                "status": "pending",
                "issued_by": str(identity["_id"]),
                "created_at": current,
                "expires_at": current + timedelta(seconds=get_settings().client_invitation_seconds),
                "cleanup_at": current + timedelta(days=14),
            }
            await database.client_invitations.insert_one(item, session=session)
            return item

        item = await transaction(database, write)
    # Only the issuing response contains the bearer secret; never a status API.
    return {
        **invitation_public(item),
        "link": request.headers["origin"] + "/client/accept#" + token,
    }


@router.get("/studio/enquiries/{enquiry_id}/client-invitations", response_model=InvitationPage)
async def invitation_list(
    enquiry_id: UUID,
    identity: Annotated[dict, Depends(require_staff)],
    cursor: Annotated[int | None, Query(ge=1, le=9223372036854775807)] = None,
):
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        if not await database.booking_requests.find_one({"_id": str(enquiry_id)}, {"_id": 1}):
            raise HTTPException(404, "Enquiry not found.")
        query = {"enquiry_id": str(enquiry_id)}
        if cursor:
            query["generation"] = {"$lt": cursor}
        items = (
            await database.client_invitations.find(
                query, {"status": 1, "created_at": 1, "expires_at": 1, "generation": 1}
            )
            .sort("generation", -1)
            .limit(26)
            .to_list(length=26)
        )
    return {
        "items": [invitation_public(item) for item in items[:25]],
        "next_cursor": items[24]["generation"] if len(items) > 25 else None,
    }


@router.post("/studio/client-invitations/{invitation_id}/revoke", response_model=InvitationResponse)
async def revoke(
    invitation_id: UUID, body: EmptyBody, identity: Annotated[dict, Depends(require_staff_write)]
):
    with database_errors():
        database = get_database()
        item = await database.client_invitations.find_one_and_update(
            {"_id": str(invitation_id), "status": "pending", "expires_at": {"$gt": now()}},
            {"$set": {"status": "revoked", "revoked_at": now()}},
            return_document=ReturnDocument.AFTER,
        )
        if not item:
            raise HTTPException(409, "Invitation is no longer pending. Refresh its status.")
    return invitation_public(item)


async def token_invitation(database, body, session=None):
    item = await database.client_invitations.find_one(
        {"token_hash": digest(body.token.get_secret_value())}, session=session
    )
    if not item:
        raise HTTPException(404, INVALID)
    return item


@router.post(
    "/auth/client/invitations/inspect",
    dependencies=[Depends(require_origin)],
    response_model=PendingInvitation | ClosedInvitation,
)
async def inspect_invitation(body: TokenBody):
    with database_errors():
        database = get_database()
        item = await token_invitation(database, body)
        status = invitation_status(item)
        if status != "pending":
            return {"status": status}
        identity = await database.client_identities.find_one({"email": item["email"]}, {"_id": 1})
    return {"status": status, "email": item["email"], "existing_account": bool(identity)}


@router.post(
    "/auth/client/invitations/accept",
    dependencies=[Depends(require_origin)],
    response_model=AcceptedInvitation,
)
async def accept(body: AcceptBody, request: Request, response: Response):
    authenticated = None
    if request.cookies.get(clients.cookie_name()):
        authenticated = await clients.require_client(request)
        await clients.require_client_write(request, authenticated)
    token = secrets.token_urlsafe(32)
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        await clients.throttle(
            database,
            "ip",
            request.client.host if request.client else "unknown",
            20,
            "client_login_limits",
        )
        initial = await token_invitation(database, body)
        await clients.throttle(database, "email", initial["email"], 5, "client_login_limits")
        encoded = (
            await run_in_threadpool(password_hash, body.password.get_secret_value())
            if body.password
            else None
        )

        async def write(session):
            item = await token_invitation(database, body, session)
            status = invitation_status(item)
            identity = await database.client_identities.find_one(
                {"email": item["email"]}, session=session
            )
            if status == "accepted" and body.recover:
                # Recovery confirms a committed outcome, never repeats a grant.
                if not identity or identity["_id"] != item["accepted_by"]:
                    raise HTTPException(409, "Sign in to check your enquiries.")
                eligible = identity.get("enabled") and identity.get("role") == "client"
                matched = authenticated and authenticated["_id"] == identity["_id"]
                password_ok = (
                    item.get("enrolled")
                    and body.password
                    and await run_in_threadpool(
                        verify_password, identity["password_hash"], body.password.get_secret_value()
                    )
                )
                if (
                    not eligible
                    or item["expires_at"].replace(tzinfo=UTC) <= now()
                    or not (matched or password_ok)
                ):
                    raise HTTPException(401, "Sign in to check the completed acceptance.")
                if not await database.client_access.find_one(
                    {
                        "client_id": identity["_id"],
                        "enquiry_id": item["enquiry_id"],
                        "revoked_at": None,
                    },
                    session=session,
                ):
                    raise HTTPException(409, "Access requires operator review.")
            elif status != "pending":
                raise HTTPException(409, f"This invitation is {status}. Ask the studio for help.")
            elif body.recover:
                raise HTTPException(
                    409, "Acceptance has not completed. Check status and accept again."
                )
            elif identity:
                if not authenticated or authenticated["_id"] != identity["_id"]:
                    raise HTTPException(409, "Sign in as the invited client before accepting.")
                if body.password:
                    raise HTTPException(
                        422, "Existing credentials cannot be changed by an invitation."
                    )
            else:
                if authenticated:
                    raise HTTPException(403, "Sign out before enrolling the invited client.")
                if not encoded:
                    raise HTTPException(422, "Choose a password of 12–1024 characters.")
                enquiry = await database.booking_requests.find_one(
                    {"_id": item["enquiry_id"]}, {"name": 1}, session=session
                )
                if not enquiry:
                    raise HTTPException(404, "Enquiry not found.")
                identity = {
                    "_id": str(uuid4()),
                    "email": item["email"],
                    "name": enquiry["name"],
                    "role": "client",
                    "enabled": True,
                    "password_hash": encoded,
                    "auth_version": str(uuid4()),
                    "created_at": now(),
                }
                await database.client_identities.insert_one(identity, session=session)
            # Fence acceptance/recovery against concurrent operator reset/disable.
            if not identity.get("enabled") or identity.get("role") != "client":
                raise HTTPException(401, "Client access is unavailable. Contact the studio.")
            if authenticated:
                current_session = await database.client_sessions.find_one(
                    {"_id": request.state.client_session["_id"]}, session=session
                )
                if (
                    not current_session
                    or current_session.get("scope") != "client"
                    or current_session.get("revoked_at") is not None
                    or current_session["expires_at"].replace(tzinfo=UTC) <= now()
                    or current_session["auth_version"] != identity["auth_version"]
                ):
                    raise HTTPException(401, "Sign in again before accepting.")
                # A concurrent logout conflicts with this transactional session write.
                await database.client_sessions.update_one(
                    {"_id": current_session["_id"]},
                    {"$inc": {"acceptance_checks": 1}},
                    session=session,
                )
            await database.client_identities.update_one(
                {"_id": identity["_id"], "auth_version": identity["auth_version"]},
                {"$inc": {"access_revision": 1}},
                session=session,
            )
            if status == "pending":
                changed = await database.client_invitations.update_one(
                    {"_id": item["_id"], "status": "pending", "expires_at": {"$gt": now()}},
                    {
                        "$set": {
                            "status": "accepted",
                            "accepted_by": identity["_id"],
                            "accepted_at": now(),
                            "enrolled": authenticated is None,
                        }
                    },
                    session=session,
                )
                if changed.modified_count != 1:
                    raise HTTPException(409, "Invitation is no longer pending.")
                enquiry = await database.booking_requests.find_one(
                    {"_id": item["enquiry_id"]}, {"created_at": 1}, session=session
                )
                if not enquiry:
                    raise HTTPException(404, "Enquiry not found.")
                await database.client_access.update_one(
                    {"client_id": identity["_id"], "enquiry_id": item["enquiry_id"]},
                    {
                        "$setOnInsert": {
                            "_id": str(uuid4()),
                            "created_at": enquiry["created_at"],
                            "granted_at": now(),
                            "invitation_id": item["_id"],
                        }
                    },
                    upsert=True,
                    session=session,
                )
            # Fence recovery against concurrent grant revocation. A new explicit
            # invitation acceptance can restore access; recovery never can.
            await database.client_access.update_one(
                {"client_id": identity["_id"], "enquiry_id": item["enquiry_id"]},
                {
                    "$inc": {"access_checks": 1},
                    **(
                        {
                            "$set": {
                                "revoked_at": None,
                                "revoked_by": None,
                                "invitation_id": item["_id"],
                                "granted_at": now(),
                            },
                            "$push": {
                                "history": {
                                    "action": "granted",
                                    "invitation_id": item["_id"],
                                    "actor_id": identity["_id"],
                                    "at": now(),
                                }
                            },
                        }
                        if status == "pending"
                        else {}
                    ),
                },
                session=session,
            )
            expires = await clients.insert_session(database, identity, token, session)
            return identity, expires, item["enquiry_id"], status == "accepted"

        identity, expires, enquiry_id, recovered = await transaction(database, write)
    return {
        **clients.session_response(response, identity, token, expires),
        "enquiry_id": enquiry_id,
        "recovered": recovered,
    }


@router.post(
    "/auth/client/login",
    dependencies=[Depends(require_origin)],
    response_model=clients.ClientSessionResponse,
)
async def login(body: clients.ClientLoginBody, request: Request, response: Response):
    return await clients.login(body, request, response)


@router.get("/auth/client/session", response_model=clients.ClientSessionResponse)
async def current_session(
    request: Request, identity: Annotated[dict, Depends(clients.require_client)]
):
    expires = request.state.client_session["expires_at"].replace(tzinfo=UTC)
    return {
        "identity": {
            key: str(identity["_id"]) if key == "id" else identity[key]
            for key in ("id", "email", "name")
        },
        "csrf_token": clients.csrf_token(request.cookies[clients.cookie_name()]),
        "expires_at": expires.isoformat(),
        "expires_in_seconds": max(1, int((expires - now()).total_seconds())),
    }


@router.post("/auth/client/logout", status_code=204)
async def logout(
    body: EmptyBody,
    request: Request,
    response: Response,
    identity: Annotated[dict, Depends(clients.require_client_write)],
):
    with database_errors():
        await get_database().client_sessions.update_one(
            {"_id": request.state.client_session["_id"]}, {"$set": {"revoked_at": now()}}
        )
    response.delete_cookie(
        clients.cookie_name(),
        path="/",
        secure=get_settings().is_production,
        httponly=True,
        samesite="lax",
    )


@router.get("/client/enquiries", response_model=ClientPage)
async def list_enquiries(
    identity: Annotated[dict, Depends(clients.require_client)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: Annotated[str | None, Query(min_length=1, max_length=512)] = None,
):
    query = {"client_id": identity["_id"], "revoked_at": None, **page_query(None, cursor)}
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        grants = (
            await database.client_access.find(query, {"enquiry_id": 1, "created_at": 1})
            .sort([("created_at", -1), ("_id", -1)])
            .limit(limit + 1)
            .to_list(length=limit + 1)
        )
        documents = (
            await database.booking_requests.find(
                {"_id": {"$in": [grant["enquiry_id"] for grant in grants[:limit]]}},
                projection(CLIENT_FIELDS),
            )
            .limit(limit)
            .to_list(length=limit)
        )
    by_id = {item["_id"]: item for item in documents}
    return {
        "items": [
            public_record(by_id[g["enquiry_id"]], CLIENT_FIELDS)
            for g in grants[:limit]
            if g["enquiry_id"] in by_id
        ],
        "next_cursor": next_cursor(grants[limit - 1], None) if len(grants) > limit else None,
    }


@router.get("/client/bookings", response_model=list[ClientBooking])
async def client_bookings(identity: Annotated[dict, Depends(clients.require_client)]):
    """Project bookings only through active, explicit enquiry grants."""
    with database_errors():
        database = get_database()
        grants = (
            await database.client_access.find(
                {"client_id": identity["_id"], "revoked_at": None}, {"enquiry_id": 1}
            )
            .limit(100)
            .to_list(length=100)
        )
        enquiry_ids = [grant["enquiry_id"] for grant in grants]
        items = (
            await database.bookings.find(
                {"source_enquiry_id": {"$in": enquiry_ids}},
                {
                    "source_enquiry_id": 1,
                    "reference": 1,
                    "event_type": 1,
                    "scheduled_date": 1,
                    "location": 1,
                    "state": 1,
                    "updated_at": 1,
                },
            )
            .sort("updated_at", -1)
            .limit(100)
            .to_list(length=100)
        )
    return [
        {
            "id": item["_id"],
            "enquiry_id": item["source_enquiry_id"],
            "reference": item["reference"],
            "event_type": item["event_type"],
            "scheduled_date": item["scheduled_date"],
            "location": item.get("location", ""),
            "state": item["state"],
            "updated_at": item["updated_at"].replace(tzinfo=UTC),
        }
        for item in items
    ]


@router.get("/client/enquiries/{enquiry_id}", response_model=ClientEnquiry)
async def detail(enquiry_id: UUID, identity: Annotated[dict, Depends(clients.require_client)]):
    with database_errors():
        database = get_database()
        grant = await database.client_access.find_one(
            {"client_id": identity["_id"], "enquiry_id": str(enquiry_id), "revoked_at": None},
            {"_id": 1},
        )
        if not grant:
            raise HTTPException(404, "Enquiry not found or unavailable to this client.")
        item = await database.booking_requests.find_one(
            {"_id": str(enquiry_id)}, projection(CLIENT_FIELDS)
        )
        if not item:
            raise HTTPException(404, "Enquiry not found or unavailable to this client.")
    return public_record(item, CLIENT_FIELDS)


def grant_public(grant, client):
    return {
        "id": grant["_id"],
        "client_id": grant["client_id"],
        "name": client.get("name", "Unavailable client identity")
        if client
        else "Unavailable client identity",
        "email": client.get("email", "") if client else "",
        "granted_at": grant["granted_at"].replace(tzinfo=UTC),
        "revoked_at": grant["revoked_at"].replace(tzinfo=UTC) if grant.get("revoked_at") else None,
    }


class GrantResponse(BaseModel):
    id: UUID
    client_id: UUID
    name: str
    email: str
    granted_at: datetime
    revoked_at: datetime | None = None


@router.get("/studio/enquiries/{enquiry_id}/client-access", response_model=list[GrantResponse])
async def grant_list(enquiry_id: UUID, identity: Annotated[dict, Depends(require_staff)]):
    with database_errors():
        database = get_database()
        if not await database.booking_requests.find_one({"_id": str(enquiry_id)}, {"_id": 1}):
            raise HTTPException(404, "Enquiry not found.")
        await ensure_indexes(database)
        grants = (
            await database.client_access.find({"enquiry_id": str(enquiry_id)})
            .sort([("granted_at", -1), ("_id", -1)])
            .limit(100)
            .to_list(100)
        )
        client_ids = [grant["client_id"] for grant in grants]
        clients_by_id = {
            client["_id"]: client
            for client in await database.client_identities.find(
                {"_id": {"$in": client_ids}}, {"name": 1, "email": 1}
            )
            .limit(100)
            .to_list(100)
        }
        return [grant_public(grant, clients_by_id.get(grant["client_id"])) for grant in grants]


@router.post(
    "/studio/enquiries/{enquiry_id}/client-access/{grant_id}/revoke", response_model=GrantResponse
)
async def revoke_grant(
    enquiry_id: UUID,
    grant_id: UUID,
    body: EmptyBody,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    with database_errors():
        database = get_database()

        async def write(session):
            await fence_staff_session(database, request, identity, session)
            grant = await database.client_access.find_one(
                {"_id": str(grant_id), "enquiry_id": str(enquiry_id)}, session=session
            )
            if not grant:
                raise HTTPException(404, "Client access not found.")
            if not grant.get("revoked_at"):
                current = now()
                current = current.replace(microsecond=(current.microsecond // 1000) * 1000)
                # Serialize revocation with invitation issuance so only a later
                # explicitly issued invitation can restore withdrawn access.
                await database.client_invitation_heads.find_one_and_update(
                    {"_id": str(enquiry_id)},
                    {"$inc": {"generation": 1}},
                    upsert=True,
                    session=session,
                )
                await database.client_access.update_one(
                    {"_id": grant["_id"]},
                    {
                        "$set": {"revoked_at": current, "revoked_by": str(identity["_id"])},
                        "$push": {
                            "history": {
                                "action": "revoked",
                                "actor_id": str(identity["_id"]),
                                "at": current,
                            }
                        },
                    },
                    session=session,
                )
                # Invalidate links issued before withdrawal; restoring access
                # requires the staff member to issue a new invitation.
                await database.client_invitations.update_many(
                    {"enquiry_id": str(enquiry_id), "status": "pending"},
                    {"$set": {"status": "revoked", "revoked_at": current}},
                    session=session,
                )
                grant["revoked_at"] = current
            client = await database.client_identities.find_one(
                {"_id": grant["client_id"]}, {"name": 1, "email": 1}, session=session
            )
            return grant_public(grant, client)

        return await transaction(database, write)
