"""Own-account session counts and transactional, retry-safe session withdrawal."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

import client_auth
from auth import database_errors, now, require_staff, require_staff_write
from client_access import transaction
from db import get_database

router = APIRouter(prefix="/api/auth")


class RevokeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID


class SessionCounts(BaseModel):
    other_active_sessions: int = Field(ge=0)


class RevokeResult(BaseModel):
    revoked_count: int = Field(ge=0)


async def fence(database, request, identity, scope, session):
    accounts = database[f"{scope}_identities"]
    sessions = database[f"{scope}_sessions"]
    current = getattr(request.state, f"{scope}_session")
    valid = await accounts.update_one(
        {
            "_id": identity["_id"],
            "enabled": True,
            "role": scope,
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"session_management_checks": 1}},
        session=session,
    )
    active = await sessions.update_one(
        {
            "_id": current["_id"],
            "identity_id": identity["_id"],
            "auth_version": identity["auth_version"],
            "revoked_at": None,
            "expires_at": {"$gt": now()},
            **({"scope": "client"} if scope == "client" else {}),
        },
        {"$inc": {"session_management_checks": 1}},
        session=session,
    )
    if not valid.matched_count or not active.matched_count:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return current


def others(identity, current, scope):
    return {
        "identity_id": identity["_id"],
        "_id": {"$ne": current["_id"]},
        "auth_version": identity["auth_version"],
        "revoked_at": None,
        "expires_at": {"$gt": now()},
        **({"scope": "client"} if scope == "client" else {}),
    }


def endpoints(scope):
    read = client_auth.require_client if scope == "client" else require_staff
    write = client_auth.require_client_write if scope == "client" else require_staff_write
    prefix = "/client/sessions" if scope == "client" else "/sessions"

    @router.get(prefix, response_model=SessionCounts, name=f"{scope}_session_counts")
    async def counts(request: Request, identity: Annotated[dict, Depends(read)]):
        with database_errors():
            database = get_database()

            async def read_counts(session):
                current = await fence(database, request, identity, scope, session)
                count = await database[f"{scope}_sessions"].count_documents(
                    others(identity, current, scope),
                    session=session,
                )
                return {"other_active_sessions": count}

            return await transaction(database, read_counts)

    @router.post(
        prefix + "/revoke-others",
        response_model=RevokeResult,
        name=f"{scope}_revoke_other_sessions",
    )
    async def revoke(
        body: RevokeBody,
        request: Request,
        identity: Annotated[dict, Depends(write)],
    ):
        with database_errors():
            database = get_database()
            # Retry receipts have the same lifetime as the authorising session.
            await database.session_commands.create_index("expires_at", expireAfterSeconds=0)

            async def apply(session):
                current = await fence(database, request, identity, scope, session)
                key = f"{scope}:{current['_id']}:{body.id}"
                saved = await database.session_commands.find_one({"_id": key}, session=session)
                if saved:
                    return saved["result"]
                changed = await database[f"{scope}_sessions"].update_many(
                    others(identity, current, scope),
                    {"$set": {"revoked_at": now()}},
                    session=session,
                )
                result = {"revoked_count": changed.modified_count}
                await database.session_commands.insert_one(
                    {
                        "_id": key,
                        "result": result,
                        "created_at": now(),
                        "expires_at": current["expires_at"],
                    },
                    session=session,
                )
                return result

            return await transaction(database, apply)


endpoints("staff")
endpoints("client")
