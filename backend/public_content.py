"""Staff-managed plain text narrative; commercial and media configuration excluded."""

from datetime import UTC
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import cookie_name, database_errors, digest, now, require_staff, require_staff_write
from client_access import transaction
from db import get_database

router = APIRouter(prefix="/api")
DEFAULTS = {
    "hero_description": (
        "For the moments that become your story. A boutique photography "
        "studio with a considered eye, a calm presence, and a love of beautiful light."
    ),
    "hero_footnote": "Thoughtfully captured. Personally yours.",
    "philosophy_title": "Not just how it looked. How it felt.",
    "philosophy_description": (
        "Beautiful light. Honest expression. The people you love, exactly as "
        "they are. These are the things we want you to remember."
    ),
}


class Content(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hero_description: str = Field(min_length=1, max_length=1000)
    hero_footnote: str = Field(min_length=1, max_length=200)
    philosophy_title: str = Field(min_length=1, max_length=200)
    philosophy_description: str = Field(min_length=1, max_length=1000)

    @field_validator("*")
    @classmethod
    def plain_text(cls, value):
        if not value.strip() or any(ord(char) < 32 and char not in "\n\t" for char in value):
            raise ValueError("Use nonempty plain text without control characters.")
        return value


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid")
    command_id: UUID
    expected_revision: int = Field(ge=0, strict=True)


class Save(Command):
    content: Content


class Restore(Command):
    source_revision: int = Field(ge=0, strict=True)


class PublicContent(BaseModel):
    content: Content
    revision: int | None


async def indexes(db):
    await db.public_content_commands.create_index([("actor_id", 1), ("command_id", 1)], unique=True)
    await db.public_content_history.create_index("revision", unique=True)


def seed():
    return {
        "_id": "site",
        "revision": 0,
        "draft": dict(DEFAULTS),
        "published": dict(DEFAULTS),
        "published_revision": None,
        "updated_at": None,
    }


def stamp(value):
    return (
        value.replace(tzinfo=UTC, microsecond=value.microsecond // 1000 * 1000) if value else None
    )


def state_public(state):
    return {
        "revision": state["revision"],
        "draft": Content.model_validate(state["draft"]).model_dump(),
        "published": Content.model_validate(state["published"]).model_dump(),
        "published_revision": state["published_revision"],
        "updated_at": stamp(state["updated_at"]),
    }


async def fence(db, request, identity, session):
    account = await db.staff_identities.update_one(
        {
            "_id": identity["_id"],
            "role": "staff",
            "enabled": True,
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"content_checks": 1}},
        session=session,
    )
    verified = await db.staff_sessions.update_one(
        {
            "_id": digest(request.cookies.get(cookie_name(), "")),
            "revoked_at": None,
            "auth_version": identity["auth_version"],
            "expires_at": {"$gt": now()},
        },
        {"$inc": {"content_checks": 1}},
        session=session,
    )
    if not account.matched_count or not verified.matched_count:
        raise HTTPException(401, "Access changed. Please sign in again.")


@router.get("/public/content", response_model=PublicContent)
async def public_content():
    with database_errors():
        state = await get_database().public_content.find_one({"_id": "site"}) or seed()
        return {
            "content": Content.model_validate(state["published"]),
            "revision": state["published_revision"],
        }


@router.get("/studio/content")
async def staff_content(identity: Annotated[dict, Depends(require_staff)]):
    with database_errors():
        return state_public(await get_database().public_content.find_one({"_id": "site"}) or seed())


async def mutate(action, body, request, identity):
    with database_errors():
        db = get_database()
        await indexes(db)
        payload = {"action": action, **body.model_dump(mode="json")}

        async def write(session):
            await fence(db, request, identity, session)
            key = {"actor_id": identity["_id"], "command_id": str(body.command_id)}
            prior = await db.public_content_commands.find_one(key, session=session)
            if prior:
                if prior["payload"] != payload:
                    raise HTTPException(409, "Command already used for a different change.")
                return prior["result"]
            state = await db.public_content.find_one({"_id": "site"}, session=session) or seed()
            if state["revision"] != body.expected_revision:
                raise HTTPException(409, "Content changed. Reload before editing.")
            if action == "save":
                state["draft"] = body.content.model_dump()
            elif action == "restore":
                source = await db.public_content_history.find_one(
                    {"revision": body.source_revision}, session=session
                )
                if body.source_revision == 0:
                    state["draft"] = dict(DEFAULTS)
                elif source:
                    state["draft"] = Content.model_validate(source["content"]).model_dump()
                else:
                    raise HTTPException(404, "Content version not found.")
            state["revision"] += 1
            state["updated_at"] = stamp(now())
            if action == "publish":
                state["published"] = dict(state["draft"])
                state["published_revision"] = state["revision"]
            await db.public_content.replace_one(
                {"_id": "site"}, state, upsert=True, session=session
            )
            await db.public_content_history.insert_one(
                {
                    "revision": state["revision"],
                    "action": action,
                    "actor_id": identity["_id"],
                    "at": state["updated_at"],
                    "content": dict(state["draft"]),
                },
                session=session,
            )
            result = state_public(state)
            await db.public_content_commands.insert_one(
                {**key, "payload": payload, "result": result}, session=session
            )
            return result

        return state_public_result(await transaction(db, write))


def state_public_result(result):
    return {**result, "updated_at": stamp(result["updated_at"])}


@router.post("/studio/content/draft")
async def save(
    body: Save, request: Request, identity: Annotated[dict, Depends(require_staff_write)]
):
    return await mutate("save", body, request, identity)


@router.post("/studio/content/publish")
async def publish(
    body: Command, request: Request, identity: Annotated[dict, Depends(require_staff_write)]
):
    return await mutate("publish", body, request, identity)


@router.post("/studio/content/restore")
async def restore(
    body: Restore, request: Request, identity: Annotated[dict, Depends(require_staff_write)]
):
    return await mutate("restore", body, request, identity)


@router.get("/studio/content/history")
async def history(
    identity: Annotated[dict, Depends(require_staff)], after: Annotated[int, Query(ge=-1)] = -1
):
    with database_errors():
        db = get_database()
        await indexes(db)
        rows = (
            await db.public_content_history.find({"revision": {"$gt": after}}, {"_id": 0})
            .sort("revision", 1)
            .limit(101)
            .to_list(101)
        )
    return {
        "items": [
            {
                **row,
                "at": stamp(row["at"]),
                "content": Content.model_validate(row["content"]).model_dump(),
            }
            for row in rows[:100]
        ],
        "next_after": rows[99]["revision"] if len(rows) > 100 else None,
    }
