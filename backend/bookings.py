"""Persistent, revisioned studio bookings derived from immutable enquiries."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator
from pymongo import ReturnDocument

from auth import database_errors, fence_staff_write, require_staff, require_staff_write
from client_access import transaction
from db import get_database

router = APIRouter(prefix="/api/studio")
State = Literal[
    "planning", "confirmed", "preparation", "shoot", "gallery_preparation", "delivered", "cancelled"
]
TRANSITIONS = {
    "planning": {"confirmed", "cancelled"},
    "confirmed": {"preparation", "cancelled"},
    "preparation": {"shoot", "cancelled"},
    "shoot": {"gallery_preparation", "cancelled"},
    "gallery_preparation": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": {"planning"},
}


def calendar_date(value: str) -> str:
    """Keep Melbourne calendar dates as strings, while rejecting impossible dates."""
    date.fromisoformat(value)
    return value


CalendarDate = Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$"), AfterValidator(calendar_date)]


class BookingSummary(BaseModel):
    id: UUID
    source_enquiry_id: UUID
    reference: str
    client_name: str
    event_type: str
    scheduled_date: str
    state: State
    revision: int
    created_at: datetime
    updated_at: datetime


class BookingDetail(BookingSummary):
    location: str = ""
    staff_note: str = ""
    history: list[dict]


class BookingPage(BaseModel):
    items: list[BookingSummary]


class CreateBooking(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scheduled_date: CalendarDate | None = None

    @field_validator("scheduled_date")
    @classmethod
    def provided_date_not_null(cls, value):
        if value is None:
            raise ValueError("Omit the planned date to use the enquiry date.")
        return value


class BookingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    scheduled_date: CalendarDate | None = None
    location: str | None = Field(default=None, max_length=300)
    staff_note: str | None = Field(default=None, max_length=2000)
    state: State | None = None

    @field_validator("scheduled_date", "location", "staff_note", "state")
    @classmethod
    def provided_change_not_null(cls, value):
        if value is None:
            raise ValueError("Booking changes cannot be null. Omit unchanged fields.")
        return value

    @model_validator(mode="after")
    def requires_change(self):
        if self.model_fields_set == {"expected_revision"}:
            raise ValueError("Provide a booking change.")
        return self


def _public(item, detail=False):
    keys = {
        "source_enquiry_id",
        "reference",
        "client_name",
        "event_type",
        "scheduled_date",
        "state",
        "revision",
        "created_at",
        "updated_at",
    }
    if detail:
        keys |= {"location", "staff_note", "history"}
    result = {key: item.get(key, "" if key in {"location", "staff_note"} else []) for key in keys}
    result["id"] = item["_id"]
    for key in ("created_at", "updated_at"):
        result[key] = result[key].replace(tzinfo=UTC)
    if detail:
        result["history"] = [
            {**event, "at": event["at"].replace(tzinfo=UTC)} for event in item["history"]
        ]
    return result


async def ensure_indexes(database):
    await database.bookings.create_index("source_enquiry_id", unique=True)
    await database.bookings.create_index([("state", 1), ("updated_at", -1), ("_id", -1)])
    await database.bookings.create_index([("updated_at", -1), ("_id", -1)])


@router.post("/enquiries/{enquiry_id}/booking", response_model=BookingDetail)
async def create_booking(
    enquiry_id: UUID,
    body: CreateBooking,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    database = get_database()
    with database_errors():
        await ensure_indexes(database)

        async def write(session):
            await fence_staff_write(database, request, identity, session)
            enquiry = await database.booking_requests.find_one(
                {"_id": str(enquiry_id)}, session=session
            )
            if not enquiry:
                raise HTTPException(404, "Enquiry not found.")
            existing = await database.bookings.find_one(
                {"source_enquiry_id": str(enquiry_id)}, session=session
            )
            if existing:
                return existing
            current = datetime.now(UTC)
            current = current.replace(microsecond=current.microsecond // 1000 * 1000)
            event = {
                "from": None, "to": "planning", "actor_id": str(identity["_id"]), "at": current
            }
            item = {
                "_id": str(uuid4()),
                "source_enquiry_id": str(enquiry_id),
                "reference": enquiry["reference"],
                "client_name": enquiry["name"],
                "event_type": enquiry["event_type"],
                "scheduled_date": body.scheduled_date or enquiry["preferred_date"],
                "location": enquiry.get("venue", ""),
                "staff_note": "",
                "state": "planning",
                "revision": 0,
                "created_at": current,
                "updated_at": current,
                "history": [event],
            }
            await database.bookings.insert_one(item, session=session)
            return item

        return _public(await transaction(database, write), True)


@router.get("/bookings", response_model=BookingPage)
async def list_bookings(
    identity: Annotated[dict, Depends(require_staff)],
    state: State | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        items = (
            await database.bookings.find({"state": state} if state else {})
            .sort([("updated_at", -1), ("_id", -1)])
            .limit(limit)
            .to_list(length=limit)
        )
    return {"items": [_public(item) for item in items]}


@router.get("/bookings/{booking_id}", response_model=BookingDetail)
async def detail_booking(booking_id: UUID, identity: Annotated[dict, Depends(require_staff)]):
    with database_errors():
        item = await get_database().bookings.find_one({"_id": str(booking_id)})
    if not item:
        raise HTTPException(404, "Booking not found.")
    return _public(item, True)


@router.patch("/bookings/{booking_id}", response_model=BookingDetail)
async def update_booking(
    booking_id: UUID,
    body: BookingUpdate,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    database = get_database()
    with database_errors():

        async def write(session):
            await fence_staff_write(database, request, identity, session)
            current = await database.bookings.find_one({"_id": str(booking_id)}, session=session)
            if not current:
                raise HTTPException(404, "Booking not found.")
            if current["revision"] != body.expected_revision:
                raise HTTPException(
                    409, "This booking changed. Review the latest version before saving."
                )
            changes = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
            next_state = changes.get("state", current["state"])
            if current["state"] == "planning" and next_state == "confirmed":
                raise HTTPException(
                    409,
                    "Confirmation is unavailable until resource capacity, scheduling, "
                    "approval, contract and payment checks are implemented.",
                )
            if next_state != current["state"] and next_state not in TRANSITIONS[current["state"]]:
                raise HTTPException(
                    409, f"A {current['state']} booking cannot move to {next_state}."
                )
            timestamp = datetime.now(UTC)
            update = {"$set": {**changes, "updated_at": timestamp}, "$inc": {"revision": 1}}
            if next_state != current["state"]:
                update["$push"] = {
                    "history": {
                        "from": current["state"],
                        "to": next_state,
                        "actor_id": str(identity["_id"]),
                        "at": timestamp,
                    }
                }
            item = await database.bookings.find_one_and_update(
                {"_id": str(booking_id), "revision": body.expected_revision},
                update,
                return_document=ReturnDocument.AFTER,
                session=session,
            )
            if not item:
                raise HTTPException(
                    409, "This booking changed. Review the latest version before saving."
                )
            return item

        return _public(await transaction(database, write), True)


@router.get("/dashboard")
async def dashboard(identity: Annotated[dict, Depends(require_staff)]):
    with database_errors():
        database = get_database()
        enquiry_count = await database.booking_requests.count_documents(
            {"studio_status": {"$ne": "archived"}}
        )
        rows = await database.bookings.aggregate(
            [{"$group": {"_id": "$state", "count": {"$sum": 1}}}]
        ).to_list(length=20)
    return {
        "active_enquiries": enquiry_count,
        "bookings": {row["_id"]: row["count"] for row in rows},
    }
