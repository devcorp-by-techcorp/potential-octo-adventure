"""Private staff triage of the existing public booking_requests collection."""

import base64
import binascii
import json
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pymongo import ReturnDocument

from auth import database_errors, require_staff, require_staff_write
from db import get_database

router = APIRouter(prefix="/api/studio/enquiries")
Status = Literal["new", "in_review", "archived"]
SORT = [("created_at", -1), ("_id", -1)]
LIST_FIELDS = (
    "reference",
    "name",
    "event_type",
    "preferred_date",
    "collection",
    "created_at",
    "studio_status",
    "studio_revision",
)
DETAIL_FIELDS = (
    *LIST_FIELDS,
    "email",
    "phone",
    "venue",
    "message",
    "consent",
    "state",
    "studio_note",
    "studio_updated_at",
    "studio_updated_by",
)


class EnquirySummary(BaseModel):
    id: UUID
    reference: str
    name: str
    event_type: str
    preferred_date: str
    collection: str
    created_at: datetime
    studio_status: Status = "new"
    studio_revision: int = 0


class EnquiryDetail(EnquirySummary):
    email: str
    phone: str = ""
    venue: str = ""
    message: str = ""
    consent: bool
    state: Literal["awaiting_studio_confirmation"]
    studio_note: str = ""
    studio_updated_at: datetime | None = None
    studio_updated_by: str | None = None


class EnquiryPage(BaseModel):
    items: list[EnquirySummary]
    next_cursor: str | None = None


class TriageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, le=9223372036854775806, strict=True)
    studio_status: Status | None = None
    studio_note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def mutation_required(self):
        changes = self.model_fields_set - {"expected_revision"}
        if not changes or any(getattr(self, key) is None for key in changes):
            raise ValueError("Provide a status or note.")
        return self


class Cursor(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal[1]
    status: Status | None
    sort: Literal["created_at_desc_id_desc"]
    created_at: datetime
    id: UUID

    @model_validator(mode="after")
    def utc_timestamp(self):
        if self.created_at.tzinfo is None or self.created_at.utcoffset().total_seconds() != 0:
            raise ValueError("UTC timestamp required.")
        return self


async def ensure_indexes(database):
    # Repeatable and non-destructive: no legacy record rewrite required.
    await database.booking_requests.create_index(SORT, name="studio_enquiries_created_id")
    await database.booking_requests.create_index(
        [("studio_status", 1), *SORT], name="studio_enquiries_status_created_id"
    )


def projection(fields):
    return {"_id": 1, **dict.fromkeys(fields, 1)}


def public_record(document, fields):
    result = {key: document[key] for key in fields if key in document}
    result["id"] = document["_id"]
    for key in ("created_at", "studio_updated_at"):
        if result.get(key):
            result[key] = result[key].replace(tzinfo=UTC)
    return result


def page_query(status, cursor):
    query = {}
    if status:
        # Mongo null equality also matches absent legacy status. Small equality
        # union supports a sorted merge using the compound status index.
        query["studio_status"] = {"$in": ["new", None]} if status == "new" else status
    if cursor:
        try:
            raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
            position = Cursor.model_validate(json.loads(raw))
            if position.status != status:
                raise ValueError("Filter mismatch")
        except (ValueError, ValidationError, binascii.Error, UnicodeError):
            raise HTTPException(422, "Invalid enquiry cursor. Refresh the inbox.") from None
        timestamp = position.created_at
        query["$or"] = [
            {"created_at": {"$lt": timestamp}},
            {"created_at": timestamp, "_id": {"$lt": str(position.id)}},
        ]
    return query


def next_cursor(document, status):
    value = Cursor(
        version=1,
        status=status,
        sort="created_at_desc_id_desc",
        created_at=document["created_at"].replace(tzinfo=UTC),
        id=document["_id"],
    )
    return base64.urlsafe_b64encode(value.model_dump_json().encode()).decode().rstrip("=")


@router.get("", response_model=EnquiryPage)
async def list_enquiries(
    identity: Annotated[dict, Depends(require_staff)],
    status: Status | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: Annotated[str | None, Query(min_length=1, max_length=512)] = None,
):
    query = page_query(status, cursor)
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        documents = (
            await database.booking_requests.find(query, projection(LIST_FIELDS))
            .sort(SORT)
            .limit(limit + 1)
            .to_list(length=limit + 1)
        )
    more = len(documents) > limit
    items = documents[:limit]
    return {
        "items": [public_record(item, LIST_FIELDS) for item in items],
        "next_cursor": next_cursor(items[-1], status) if more else None,
    }


@router.get("/{enquiry_id}", response_model=EnquiryDetail)
async def detail_enquiry(enquiry_id: UUID, identity: Annotated[dict, Depends(require_staff)]):
    with database_errors():
        document = await get_database().booking_requests.find_one(
            {"_id": str(enquiry_id)}, projection(DETAIL_FIELDS)
        )
    if document is None:
        raise HTTPException(404, "Enquiry not found.")
    return public_record(document, DETAIL_FIELDS)


@router.patch("/{enquiry_id}", response_model=EnquiryDetail)
async def update_enquiry(
    enquiry_id: UUID,
    body: TriageUpdate,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    query = {"_id": str(enquiry_id)}
    if body.expected_revision == 0:
        query["$or"] = [{"studio_revision": 0}, {"studio_revision": {"$exists": False}}]
    else:
        query["studio_revision"] = body.expected_revision
    changes = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
    changes.update(studio_updated_at=datetime.now(UTC), studio_updated_by=str(identity["_id"]))
    # Normalize only the missing legacy fields on the first authorized write.
    # Pipeline keeps the revision comparison and all defaults in one atomic operation.
    with database_errors():
        collection = get_database().booking_requests
        document = await collection.find_one_and_update(
            query,
            [
                {
                    "$set": {
                        "studio_status": {"$ifNull": ["$studio_status", "new"]},
                        "studio_note": {"$ifNull": ["$studio_note", ""]},
                        "studio_revision": {"$add": [{"$ifNull": ["$studio_revision", 0]}, 1]},
                    }
                },
                {"$set": {key: {"$literal": value} for key, value in changes.items()}},
            ],
            projection=projection(DETAIL_FIELDS),
            return_document=ReturnDocument.AFTER,
        )
        if document is None:
            exists = await collection.find_one({"_id": str(enquiry_id)}, {"_id": 1})
            if exists is None:
                raise HTTPException(404, "Enquiry not found.")
            raise HTTPException(
                409, "This enquiry changed. Review the latest version before saving."
            )
    return public_record(document, DETAIL_FIELDS)
