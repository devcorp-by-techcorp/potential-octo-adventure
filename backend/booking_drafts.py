"""Persistent proposals; confirmation waits for scheduling and evidence checks."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator

import client_auth
from auth import cookie_name, database_errors, digest, now, require_staff, require_staff_write
from client_access import transaction
from db import get_database

router = APIRouter(prefix="/api")
BLOCKER = (
    "Booking confirmation is disabled until resource capacity, scheduling, "
    "approval, contract and payment checks are implemented."
)


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    command_id: UUID
    starts_at: datetime
    ends_at: datetime
    timezone: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def valid_interval(self):
        try:
            zone = ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Use an IANA timezone.") from None
        for value in (self.starts_at, self.ends_at):
            if value.tzinfo is None or value.utcoffset() is None:
                raise ValueError("Date/time requires an explicit offset.")
            local = value.astimezone(zone)
            if value.utcoffset().total_seconds() != 0 and local.utcoffset() != value.utcoffset():
                raise ValueError("Offset must match the selected timezone at this date/time.")
        if milliseconds(self.ends_at) <= milliseconds(self.starts_at):
            raise ValueError("End must follow start.")
        return self


class Change(Schedule):
    expected_revision: int = Field(ge=0, strict=True)
    action: Literal["reschedule", "cancel", "confirm"]


FIELDS = (
    "enquiry_id",
    "reference",
    "state",
    "starts_at",
    "ends_at",
    "timezone",
    "revision",
    "created_at",
    "updated_at",
)


def milliseconds(value):
    return value.astimezone(UTC).replace(microsecond=value.microsecond // 1000 * 1000)


async def staff_fence(db, request, identity, session):
    account = await db.staff_identities.update_one(
        {
            "_id": identity["_id"],
            "role": "staff",
            "enabled": True,
            "auth_version": identity["auth_version"],
        },
        {"$inc": {"booking_checks": 1}},
        session=session,
    )
    verified = await db.staff_sessions.update_one(
        {
            "_id": digest(request.cookies.get(cookie_name(), "")),
            "revoked_at": None,
            "auth_version": identity["auth_version"],
            "expires_at": {"$gt": now()},
        },
        {"$inc": {"booking_checks": 1}},
        session=session,
    )
    if not account.matched_count or not verified.matched_count:
        raise HTTPException(401, "Access changed. Please sign in again.")


def public(item):
    result = {key: item[key] for key in FIELDS}
    result["id"] = item["_id"]
    for key in ("starts_at", "ends_at", "created_at", "updated_at"):
        result[key] = result[key].replace(
            tzinfo=UTC, microsecond=result[key].microsecond // 1000 * 1000
        )
    return result


async def indexes(db):
    await db.booking_drafts.create_index("enquiry_id", unique=True)
    await db.booking_drafts.create_index([("starts_at", 1), ("_id", 1)])
    await db.booking_draft_commands.create_index([("actor_id", 1), ("command_id", 1)], unique=True)
    await db.booking_draft_history.create_index([("draft_id", 1), ("revision", 1)], unique=True)


async def saved_command(db, actor, command, payload, session):
    saved = await db.booking_draft_commands.find_one(
        {"actor_id": actor, "command_id": command}, session=session
    )
    if saved:
        if saved["payload"] != payload:
            raise HTTPException(409, "This command was already used for a different change.")
        return saved["result"]
    return None


async def record_change(db, actor, body, item, action, session, payload):
    stamp = item["updated_at"]
    await db.booking_draft_history.insert_one(
        {
            "_id": str(uuid4()),
            "draft_id": item["_id"],
            "revision": item["revision"],
            "actor_id": actor,
            "at": stamp,
            "action": action,
            "snapshot": {key: item[key] for key in FIELDS},
        },
        session=session,
    )
    await db.booking_draft_commands.insert_one(
        {
            "_id": str(uuid4()),
            "actor_id": actor,
            "command_id": str(body.command_id),
            "payload": payload,
            "result": item,
        },
        session=session,
    )


@router.post("/studio/enquiries/{enquiry_id}/booking-draft")
async def create(
    enquiry_id: UUID,
    body: Schedule,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    db = get_database()
    actor = identity["_id"]
    payload = {"enquiry_id": str(enquiry_id), **body.model_dump(mode="json")}
    with database_errors():
        await indexes(db)

        async def write(session):
            await staff_fence(db, request, identity, session)
            retry = await saved_command(db, actor, str(body.command_id), payload, session)
            if retry:
                return retry
            enquiry = await db.booking_requests.find_one({"_id": str(enquiry_id)}, session=session)
            if not enquiry:
                raise HTTPException(404, "Enquiry not found.")
            if await db.booking_drafts.find_one({"enquiry_id": str(enquiry_id)}, session=session):
                raise HTTPException(409, "This enquiry already has a booking draft. Reload drafts.")
            stamp = milliseconds(now())
            item = {
                "_id": str(uuid4()),
                "enquiry_id": str(enquiry_id),
                "reference": enquiry["reference"],
                "state": "draft",
                "starts_at": milliseconds(body.starts_at),
                "ends_at": milliseconds(body.ends_at),
                "timezone": body.timezone,
                "revision": 0,
                "created_at": stamp,
                "updated_at": stamp,
            }
            await db.booking_drafts.insert_one(item, session=session)
            await record_change(db, actor, body, item, "created", session, payload)
            return item

        return public(await transaction(db, write))


@router.get("/studio/booking-drafts")
async def drafts(
    identity: Annotated[dict, Depends(require_staff)],
    offset: Annotated[int, Query(ge=0, le=10000)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
):
    with database_errors():
        db = get_database()
        await indexes(db)
        items = (
            await db.booking_drafts.find({})
            .sort([("starts_at", 1), ("_id", 1)])
            .skip(offset)
            .limit(limit + 1)
            .to_list(limit + 1)
        )
    return {
        "items": [public(item) for item in items[:limit]],
        "next_offset": offset + limit if len(items) > limit else None,
        "confirmation_enabled": False,
        "decision_required": BLOCKER,
    }


@router.patch("/studio/booking-drafts/{draft_id}")
async def change(
    draft_id: UUID,
    body: Change,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    if body.action == "confirm":
        raise HTTPException(409, BLOCKER)
    db = get_database()
    actor = identity["_id"]
    payload = {"draft_id": str(draft_id), **body.model_dump(mode="json")}
    with database_errors():
        await indexes(db)

        async def write(session):
            await staff_fence(db, request, identity, session)
            retry = await saved_command(db, actor, str(body.command_id), payload, session)
            if retry:
                return retry
            item = await db.booking_drafts.find_one({"_id": str(draft_id)}, session=session)
            if not item:
                raise HTTPException(404, "Draft not found.")
            if item["revision"] != body.expected_revision or item["state"] != "draft":
                raise HTTPException(409, "Draft changed or was cancelled. Reload before editing.")
            updates = {"updated_at": milliseconds(now()), "revision": item["revision"] + 1}
            if body.action == "cancel":
                updates["state"] = "cancelled"
            else:
                updates.update(
                    starts_at=milliseconds(body.starts_at),
                    ends_at=milliseconds(body.ends_at),
                    timezone=body.timezone,
                )
            await db.booking_drafts.update_one(
                {"_id": item["_id"], "revision": item["revision"]},
                {"$set": updates},
                session=session,
            )
            item.update(updates)
            await record_change(db, actor, body, item, body.action, session, payload)
            return item

        return public(await transaction(db, write))


@router.get("/studio/booking-drafts/{draft_id}/history")
async def history(
    draft_id: UUID,
    identity: Annotated[dict, Depends(require_staff)],
    after: Annotated[int, Query(ge=-1)] = -1,
):
    with database_errors():
        db = get_database()
        if not await db.booking_drafts.find_one({"_id": str(draft_id)}, {"_id": 1}):
            raise HTTPException(404, "Draft not found.")
        rows = (
            await db.booking_draft_history.find(
                {"draft_id": str(draft_id), "revision": {"$gt": after}}, {"_id": 0}
            )
            .sort("revision", 1)
            .limit(101)
            .to_list(101)
        )
    return {"items": rows[:100], "next_after": rows[99]["revision"] if len(rows) > 100 else None}


@router.get("/client/enquiries/{enquiry_id}/booking-draft")
async def client_draft(
    enquiry_id: UUID, identity: Annotated[dict, Depends(client_auth.require_client)]
):
    with database_errors():
        db = get_database()
        grant = await db.client_access.find_one(
            {"client_id": identity["_id"], "enquiry_id": str(enquiry_id), "revoked_at": None}
        )
        if not grant:
            raise HTTPException(404, "Enquiry unavailable.")
        item = await db.booking_drafts.find_one({"enquiry_id": str(enquiry_id)})
    return {"draft": public(item) if item else None, "confirmation_enabled": False}
