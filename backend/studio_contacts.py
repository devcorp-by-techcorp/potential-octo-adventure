"""Staff contact roster uses existing canonical client identities and explicit grants."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import database_errors, require_staff
from db import get_database
from studio_enquiries import LIST_FIELDS, projection, public_record

router = APIRouter(prefix="/api/studio/contacts")


@router.get("")
async def contacts(
    identity: Annotated[dict, Depends(require_staff)],
    after: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
):
    with database_errors():
        db = get_database()
        await db.client_identities.create_index([("role", 1), ("_id", 1)])
        query = {"role": "client"}
        if after:
            query["_id"] = {"$gt": str(after)}
        rows = (
            await db.client_identities.find(query, {"name": 1, "email": 1, "enabled": 1})
            .sort("_id", 1)
            .limit(limit + 1)
            .to_list(limit + 1)
        )
    return {
        "items": [
            {
                "id": row["_id"],
                "name": row["name"],
                "email": row["email"],
                "enabled": bool(row.get("enabled")),
            }
            for row in rows[:limit]
        ],
        "next_cursor": rows[limit - 1]["_id"] if len(rows) > limit else None,
    }


@router.get("/{client_id}")
async def contact(
    client_id: UUID,
    identity: Annotated[dict, Depends(require_staff)],
    after: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
):
    with database_errors():
        db = get_database()
        row = await db.client_identities.find_one(
            {"_id": str(client_id), "role": "client"}, {"name": 1, "email": 1, "enabled": 1}
        )
        if not row:
            raise HTTPException(404, "Client contact not found.")
        await db.client_access.create_index([("client_id", 1), ("_id", 1)])
        query = {"client_id": str(client_id)}
        if after:
            query["_id"] = {"$gt": str(after)}
        grants = (
            await db.client_access.find(query).sort("_id", 1).limit(limit + 1).to_list(limit + 1)
        )
        records = await db.booking_requests.find(
            {"_id": {"$in": [grant["enquiry_id"] for grant in grants[:limit]]}},
            projection(LIST_FIELDS),
        ).to_list(limit)
        enquiries = {item["_id"]: public_record(item, LIST_FIELDS) for item in records}
    return {
        "identity": {
            "id": row["_id"],
            "name": row["name"],
            "email": row["email"],
            "enabled": bool(row.get("enabled")),
        },
        "relationships": [
            {
                "grant_id": grant["_id"],
                "enquiry": enquiries.get(grant["enquiry_id"]),
                "access_active": bool(row.get("enabled"))
                and not grant.get("revoked_at")
                and grant["enquiry_id"] in enquiries,
            }
            for grant in grants[:limit]
        ],
        "next_cursor": grants[limit - 1]["_id"] if len(grants) > limit else None,
    }
