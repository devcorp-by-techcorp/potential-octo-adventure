"""Bounded staff search, allowlisted JSON export and revision-checked bulk triage."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator

from auth import database_errors, require_staff, require_staff_write
from db import get_database
from studio_enquiries import (
    LIST_FIELDS,
    SORT,
    EnquirySummary,
    Status,
    TriageUpdate,
    projection,
    public_record,
    update_enquiry,
)

router = APIRouter(prefix="/api/studio/operations")
QUERY_TIMEOUT_MS = 5000
MAX_OFFSET = 10000
SEARCH_FIELDS = ("reference", "name", "event_type", "venue", "message")


class OperationalSummary(EnquirySummary):
    # Unknown legacy triage statuses remain visible to staff for correction.
    studio_status: str = "new"


class OperationPage(BaseModel):
    items: list[OperationalSummary]
    next_offset: int | None = None
    window_exhausted: bool = False


class BulkTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    expected_revision: int = Field(ge=0, le=9223372036854775806, strict=True)


class BulkTriage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    studio_status: Status
    items: list[BulkTarget] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def distinct_targets(self):
        if len({target.id for target in self.items}) != len(self.items):
            raise ValueError("Select each enquiry once.")
        return self


class BulkResult(BaseModel):
    id: UUID
    outcome: Literal[
        "updated", "conflict", "not_found", "unavailable", "authorization_lost", "not_attempted"
    ]
    studio_revision: int | None = None


class BulkResponse(BaseModel):
    results: list[BulkResult]
    authorization_lost: bool = False


async def ensure_indexes(database):
    await database.booking_requests.create_index(
        [(field, "text") for field in SEARCH_FIELDS],
        name="studio_enquiry_search",
        default_language="none",
        language_override="studio_search_language",
    )
    await database.booking_requests.create_index(SORT, name="studio_enquiries_created_id")


async def read_page(query, status, limit, offset):
    selection = {}
    if query is not None:
        query = query.strip()
        if not query:
            raise HTTPException(422, "Enter search words or clear the search field.")
        selection["$text"] = {"$search": query, "$language": "none"}
    if status:
        selection["studio_status"] = {"$in": ["new", None]} if status == "new" else status
    with database_errors():
        database = get_database()
        await ensure_indexes(database)
        rows = await (
            database.booking_requests.find(selection, projection(LIST_FIELDS))
            .sort(SORT)
            .skip(offset)
            .limit(limit + 1)
            .max_time_ms(QUERY_TIMEOUT_MS)
        ).to_list(length=limit + 1)
    items = []
    for row in rows[:limit]:
        item = public_record(row, LIST_FIELDS)
        if item.get("studio_status") is None:
            item["studio_status"] = "new"
        items.append(item)
    more = len(rows) > limit
    following = offset + limit
    return {
        "items": items,
        "next_offset": following if more and following <= MAX_OFFSET else None,
        "window_exhausted": more and following > MAX_OFFSET,
    }


@router.get("/enquiries", response_model=OperationPage)
@router.get("/export", response_model=OperationPage)
async def enquiries(
    identity: Annotated[dict, Depends(require_staff)],
    query: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    status: Status | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0, le=MAX_OFFSET)] = 0,
):
    # Both paths intentionally have the same minimal field allowlist. The
    # export is one JSON page, never a silent dump of private detail fields.
    return await read_page(query, status, limit, offset)


@router.post("/bulk-triage", response_model=BulkResponse)
async def bulk_triage(
    body: BulkTriage,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    results = []
    stopped = False
    authorization_lost = False
    for target in body.items:
        if stopped:
            results.append({"id": target.id, "outcome": "not_attempted"})
            continue
        try:
            # Recheck the current session for each record, including disable,
            # reset or role changes that happen during this bounded operation.
            actor = await require_staff_write(request, await require_staff(request))
            saved = await update_enquiry(
                target.id,
                TriageUpdate(
                    expected_revision=target.expected_revision, studio_status=body.studio_status
                ),
                actor,
            )
            results.append(
                {"id": target.id, "outcome": "updated", "studio_revision": saved["studio_revision"]}
            )
        except HTTPException as failure:
            if failure.status_code in (401, 403):
                outcome = "authorization_lost"
                stopped = authorization_lost = True
            elif failure.status_code == 503:
                outcome = "unavailable"
                stopped = True
            elif failure.status_code == 404:
                outcome = "not_found"
            elif failure.status_code == 409:
                outcome = "conflict"
            else:
                raise
            results.append({"id": target.id, "outcome": outcome})
    return {"results": results, "authorization_lost": authorization_lost}
