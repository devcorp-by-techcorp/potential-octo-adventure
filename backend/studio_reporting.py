"""Staff-only, aggregate operational counts; no customer records are returned."""

import asyncio
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import database_errors, require_staff
from db import get_database

router = APIRouter(prefix="/api/studio")
QUERY_TIMEOUT_MS = 5000


class StudioReport(BaseModel):
    observed_at: datetime
    enquiries: int = Field(ge=0)
    new_enquiries: int = Field(ge=0)
    in_review_enquiries: int = Field(ge=0)
    archived_enquiries: int = Field(ge=0)
    unclassified_enquiries: int = Field(ge=0)
    enabled_clients: int = Field(ge=0)
    active_access_grants: int = Field(ge=0)


async def ensure_indexes(database):
    await database.client_identities.create_index(
        [("role", 1), ("enabled", 1)], name="studio_reporting_enabled_clients"
    )
    await database.client_access.create_index(
        [("revoked_at", 1), ("client_id", 1)], name="studio_reporting_active_grants"
    )


@router.get("/reporting", response_model=StudioReport)
async def report(identity: Annotated[dict, Depends(require_staff)]):
    database = get_database()
    status = {"$ifNull": ["$studio_status", "new"]}
    enquiry_group = {"_id": None, "enquiries": {"$sum": 1}}
    for value, field in (
        ("new", "new_enquiries"),
        ("in_review", "in_review_enquiries"),
        ("archived", "archived_enquiries"),
    ):
        enquiry_group[field] = {"$sum": {"$cond": [{"$eq": [status, value]}, 1, 0]}}
    # Count only grants that could authorize an enabled client to an existing enquiry.
    grants_pipeline = [
        {"$match": {"revoked_at": None}},
        {
            "$lookup": {
                "from": "client_identities",
                "localField": "client_id",
                "foreignField": "_id",
                "as": "client",
            }
        },
        {"$unwind": "$client"},
        {"$match": {"client.enabled": True, "client.role": "client"}},
        {
            "$lookup": {
                "from": "booking_requests",
                "localField": "enquiry_id",
                "foreignField": "_id",
                "as": "enquiry",
            }
        },
        {"$match": {"enquiry.0": {"$exists": True}}},
        {"$count": "count"},
    ]
    with database_errors():
        await ensure_indexes(database)
        enquiry_rows, enabled_clients, grant_rows = await asyncio.gather(
            database.booking_requests.aggregate(
                [{"$group": enquiry_group}], maxTimeMS=QUERY_TIMEOUT_MS
            ).to_list(length=1),
            database.client_identities.count_documents(
                {"role": "client", "enabled": True}, maxTimeMS=QUERY_TIMEOUT_MS
            ),
            database.client_access.aggregate(grants_pipeline, maxTimeMS=QUERY_TIMEOUT_MS).to_list(
                length=1
            ),
        )
    counts = {
        key: 0
        for key in ("enquiries", "new_enquiries", "in_review_enquiries", "archived_enquiries")
    }
    if enquiry_rows:
        counts.update({key: enquiry_rows[0][key] for key in counts})
    return {
        **counts,
        "unclassified_enquiries": counts["enquiries"]
        - sum(
            counts[key] for key in ("new_enquiries", "in_review_enquiries", "archived_enquiries")
        ),
        "enabled_clients": enabled_clients,
        "active_access_grants": grant_rows[0]["count"] if grant_rows else 0,
        "observed_at": datetime.now(UTC),
    }
