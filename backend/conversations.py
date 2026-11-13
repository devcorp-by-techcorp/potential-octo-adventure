"""Private, persistent enquiry conversations for explicitly granted clients."""

from datetime import UTC
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ReturnDocument

import client_auth
from auth import database_errors, now, require_staff, require_staff_write
from client_access import transaction
from db import get_database

router = APIRouter(prefix="/api")


class MessageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def meaningful_text(cls, value):
        value = value.strip()
        if not value or "\x00" in value:
            raise ValueError("Enter a message without null characters.")
        return value


class ReadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sequence: int = Field(ge=0, le=9223372036854775807, strict=True)


class Message(BaseModel):
    id: UUID
    sequence: int
    sender_scope: Literal["studio", "client"]
    text: str
    created_at: str


class Page(BaseModel):
    items: list[Message]
    next_cursor: int | None
    latest_sequence: int
    read_sequence: int
    unread_count: int


async def ensure_indexes(database):
    await database.conversation_messages.create_index(
        [("conversation_id", 1), ("sequence", 1)], unique=True
    )
    await database.conversation_messages.create_index(
        [("conversation_id", 1), ("message_id", 1)], unique=True
    )
    await database.conversation_messages.create_index(
        [("conversation_id", 1), ("sender_scope", 1), ("sequence", 1)]
    )


def public_message(item):
    return {
        "id": item["message_id"],
        "sequence": item["sequence"],
        "sender_scope": item["sender_scope"],
        "text": item["text"],
        "created_at": item["created_at"].replace(tzinfo=UTC).isoformat(),
    }


async def fence(database, session, request, identity, scope, enquiry_id, client_id):
    """Serialize access checks with revocation, logout, disable and reset."""
    account_collection = (
        database.client_identities if scope == "client" else database.staff_identities
    )
    session_collection = database.client_sessions if scope == "client" else database.staff_sessions
    current = getattr(request.state, f"{scope if scope == 'client' else 'staff'}_session")
    valid = await account_collection.update_one(
        {
            "_id": identity["_id"],
            "enabled": True,
            "role": "client" if scope == "client" else "staff",
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"conversation_checks": 1}},
        session=session,
    )
    active = await session_collection.update_one(
        {
            "_id": current["_id"],
            "revoked_at": None,
            "expires_at": {"$gt": now()},
            "auth_version": identity["auth_version"],
            **({"scope": "client"} if scope == "client" else {}),
        },
        {"$inc": {"conversation_checks": 1}},
        session=session,
    )
    if not valid.matched_count or not active.matched_count:
        raise HTTPException(401, "Sign in again to use conversations.")
    grant = await database.client_access.find_one_and_update(
        {"enquiry_id": str(enquiry_id), "client_id": client_id, "revoked_at": None},
        {"$inc": {"conversation_checks": 1}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    if not grant or not await database.booking_requests.find_one(
        {"_id": str(enquiry_id)}, {"_id": 1}, session=session
    ):
        raise HTTPException(404, "Conversation not found or access unavailable.")
    return grant["_id"]


async def perform(request, identity, scope, enquiry_id, client_id, operation):
    with database_errors():
        database = get_database()
        await ensure_indexes(database)

        async def write(session):
            conversation_id = await fence(
                database, session, request, identity, scope, enquiry_id, client_id
            )
            return await operation(database, session, conversation_id)

        return await transaction(database, write)


def endpoints(scope):
    read_dependency = client_auth.require_client if scope == "client" else require_staff
    write_dependency = (
        client_auth.require_client_write if scope == "client" else require_staff_write
    )
    prefix = (
        "/client/enquiries/{enquiry_id}/conversation"
        if scope == "client"
        else "/studio/enquiries/{enquiry_id}/conversations/{client_id}"
    )

    @router.get(prefix, response_model=Page, name=f"{scope}_conversation")
    async def history(
        enquiry_id: UUID,
        request: Request,
        identity: Annotated[dict, Depends(read_dependency)],
        client_id: UUID | None = None,
        after: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
        limit: Annotated[int, Query(ge=1, le=100)] = 25,
    ):
        recipient = identity["_id"] if scope == "client" else str(client_id)

        async def read(database, session, key):
            head = await database.conversations.find_one({"_id": key}, session=session) or {}
            items = (
                await database.conversation_messages.find(
                    {"conversation_id": key, "sequence": {"$gt": after}}, session=session
                )
                .sort("sequence", 1)
                .limit(limit + 1)
                .to_list(limit + 1)
            )
            read_sequence = head.get(f"{scope}_read", 0)
            unread = await database.conversation_messages.count_documents(
                {
                    "conversation_id": key,
                    "sender_scope": {"$ne": scope},
                    "sequence": {"$gt": read_sequence},
                },
                session=session,
            )
            return {
                "items": [public_message(item) for item in items[:limit]],
                "next_cursor": items[limit - 1]["sequence"] if len(items) > limit else None,
                "latest_sequence": head.get("sequence", 0),
                "read_sequence": read_sequence,
                "unread_count": unread,
            }

        return await perform(request, identity, scope, enquiry_id, recipient, read)

    @router.post(prefix + "/messages", response_model=Message, name=f"{scope}_send_message")
    async def send(
        enquiry_id: UUID,
        request: Request,
        body: MessageBody,
        identity: Annotated[dict, Depends(write_dependency)],
        client_id: UUID | None = None,
    ):
        recipient = identity["_id"] if scope == "client" else str(client_id)

        async def write(database, session, key):
            existing = await database.conversation_messages.find_one(
                {"conversation_id": key, "message_id": str(body.id)}, session=session
            )
            if existing:
                if (
                    existing["actor_id"] != identity["_id"]
                    or existing["sender_scope"] != scope
                    or existing["text"] != body.text
                ):
                    raise HTTPException(
                        409, "Message identifier already used. Refresh the conversation."
                    )
                return public_message(existing)
            head = await database.conversations.find_one_and_update(
                {"_id": key},
                {"$inc": {"sequence": 1}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
                session=session,
            )
            current = now()
            item = {
                "conversation_id": key,
                "message_id": str(body.id),
                "sequence": head["sequence"],
                "sender_scope": scope,
                "actor_id": identity["_id"],
                "text": body.text,
                "created_at": current.replace(microsecond=(current.microsecond // 1000) * 1000),
            }
            await database.conversation_messages.insert_one(item, session=session)
            return public_message(item)

        return await perform(request, identity, scope, enquiry_id, recipient, write)

    @router.post(prefix + "/read", name=f"{scope}_read_conversation")
    async def mark_read(
        enquiry_id: UUID,
        request: Request,
        body: ReadBody,
        identity: Annotated[dict, Depends(write_dependency)],
        client_id: UUID | None = None,
    ):
        recipient = identity["_id"] if scope == "client" else str(client_id)

        async def write(database, session, key):
            head = await database.conversations.find_one({"_id": key}, session=session) or {}
            if body.sequence > head.get("sequence", 0):
                raise HTTPException(409, "Refresh before marking unseen messages read.")
            updated = await database.conversations.find_one_and_update(
                {"_id": key},
                {"$max": {f"{scope}_read": body.sequence}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
                session=session,
            )
            return {"read_sequence": updated[f"{scope}_read"]}

        return await perform(request, identity, scope, enquiry_id, recipient, write)


endpoints("studio")
endpoints("client")
