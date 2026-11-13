"""Staff-configured resource definitions; configuration never reserves capacity."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pymongo import ReturnDocument

from auth import database_errors, fence_staff_write, require_staff, require_staff_write
from client_access import transaction
from db import get_database

router = APIRouter(prefix="/api/studio/booking-resources")
MAX_CAPACITY = 2**53 - 1  # Exact integer transport through browser JSON and BSON.
Kind = Literal["photographer", "assistant", "studio_room", "equipment"]


class ResourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    kind: Kind
    name: str = Field(min_length=1, max_length=120)
    capacity: int = Field(default=1, ge=1, le=MAX_CAPACITY, strict=True)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Provide a resource name.")
        return value


class ResourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    capacity: int | None = Field(default=None, ge=1, le=MAX_CAPACITY, strict=True)
    enabled: bool | None = Field(default=None, strict=True)

    @field_validator("name", "capacity", "enabled")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Omit unchanged fields.")
        if isinstance(value, str):
            return ResourceInput.clean_name(value)
        return value

    @model_validator(mode="after")
    def requires_change(self):
        if self.model_fields_set == {"expected_revision"}:
            raise ValueError("Provide a resource change.")
        return self


class Resource(BaseModel):
    id: UUID
    kind: Kind
    name: str
    capacity: int
    enabled: bool
    revision: int
    created_at: datetime
    updated_at: datetime


class ResourcePage(BaseModel):
    items: list[Resource]
    next_cursor: UUID | None


def public(item):
    result = {key: item[key] for key in Resource.model_fields if key != "id"}
    result["id"] = item["_id"]
    for key in ("created_at", "updated_at"):
        result[key] = result[key].replace(tzinfo=UTC)
    return result


def timestamp():
    current = datetime.now(UTC)
    return current.replace(microsecond=current.microsecond // 1000 * 1000)


@router.get("", response_model=ResourcePage)
async def list_resources(
    identity: Annotated[dict, Depends(require_staff)],
    after: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    with database_errors():
        items = (
            await get_database()
            .booking_resources.find({"_id": {"$gt": str(after)}} if after else {})
            .sort("_id", 1)
            .limit(limit + 1)
            .to_list(limit + 1)
        )
    return {
        "items": [public(item) for item in items[:limit]],
        "next_cursor": items[limit - 1]["_id"] if len(items) > limit else None,
    }


@router.post("", response_model=Resource)
async def create_resource(
    body: ResourceInput,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    database = get_database()
    creation = body.model_dump(mode="json", exclude={"id"})
    with database_errors():

        async def write(session):
            await fence_staff_write(database, request, identity, session)
            existing = await database.booking_resources.find_one(
                {"_id": str(body.id)}, session=session
            )
            if existing:
                if existing["creation_input"] != creation:
                    raise HTTPException(
                        409, "This creation ID was already used for another resource."
                    )
                # Later edits cannot alter the outcome of a committed creation retry.
                return public(existing["creation_receipt"])
            current = timestamp()
            item = {
                "_id": str(body.id),
                **creation,
                "enabled": True,
                "revision": 0,
                "created_at": current,
                "updated_at": current,
            }
            await database.booking_resources.insert_one(
                {
                    **item,
                    "creation_input": creation,
                    "creation_receipt": item.copy(),
                    "history": [
                        {
                            "action": "created",
                            "actor_id": str(identity["_id"]),
                            "at": current,
                            "after": creation | {"enabled": True},
                        }
                    ],
                },
                session=session,
            )
            return public(item)

        return await transaction(database, write)


@router.patch("/{resource_id}", response_model=Resource)
async def update_resource(
    resource_id: UUID,
    body: ResourceUpdate,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    database = get_database()
    with database_errors():

        async def write(session):
            await fence_staff_write(database, request, identity, session)
            current = await database.booking_resources.find_one(
                {"_id": str(resource_id)}, session=session
            )
            if not current:
                raise HTTPException(404, "Resource not found.")
            if current["revision"] != body.expected_revision:
                raise HTTPException(
                    409, "This resource changed. Review its latest version before saving."
                )
            changes = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
            at = timestamp()
            item = await database.booking_resources.find_one_and_update(
                {"_id": str(resource_id), "revision": body.expected_revision},
                {
                    "$set": changes | {"updated_at": at},
                    "$inc": {"revision": 1},
                    "$push": {
                        "history": {
                            "action": "updated",
                            "actor_id": str(identity["_id"]),
                            "at": at,
                            "before": {key: current[key] for key in changes},
                            "after": changes,
                        }
                    },
                },
                return_document=ReturnDocument.AFTER,
                session=session,
            )
            if not item:
                raise HTTPException(
                    409, "This resource changed. Review its latest version before saving."
                )
            return public(item)

        return await transaction(database, write)
