"""Private, versioned document uploads and explicit client publication."""

import hashlib
from datetime import UTC, timedelta
from typing import Annotated, Literal
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pymongo import ReturnDocument
from starlette.concurrency import run_in_threadpool
from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.responses import StreamingResponse

import client_auth
from auth import database_errors, now, require_staff, require_staff_write
from client_access import transaction
from conversations import fence
from db import get_database
from storage import StorageSettings, StorageUnavailable, get_storage

router = APIRouter(prefix="/api")
TYPES = Literal["application/pdf", "image/png", "image/jpeg"]
STUDIO = "/studio/enquiries/{enquiry_id}/documents/{client_id}"
CLIENT = "/client/enquiries/{enquiry_id}/documents"


class UploadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    document_id: UUID
    title: str = Field(min_length=1, max_length=160)
    filename: str = Field(min_length=1, max_length=160)
    content_type: TYPES
    size: int = Field(gt=0, le=100 * 1024 * 1024, strict=True)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @field_validator("title", "filename")
    @classmethod
    def plain_text(cls, value):
        if not value.strip() or any(ord(char) < 32 for char in value):
            raise ValueError("Provide a plain, nonempty title and filename.")
        return value.strip()

    @field_validator("filename")
    @classmethod
    def basename(cls, value):
        if "/" in value or "\\" in value or value in {".", ".."}:
            raise ValueError("Provide a filename without a path.")
        return value

    @model_validator(mode="after")
    def filename_type(self):
        extensions = {
            "application/pdf": (".pdf",),
            "image/png": (".png",),
            "image/jpeg": (".jpg", ".jpeg"),
        }
        if not self.filename.lower().endswith(extensions[self.content_type]):
            raise ValueError("The filename extension must match the supported file type.")
        return self


class PublishBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    published: bool = Field(strict=True)
    expected_revision: int = Field(ge=0, strict=True)


def timestamp():
    current = now()
    return current.replace(microsecond=(current.microsecond // 1000) * 1000)


async def ensure_indexes(database):
    await database.document_versions.create_index([("grant_id", 1), ("sequence", 1)], unique=True)
    await database.document_versions.create_index(
        [("grant_id", 1), ("document_id", 1), ("version", 1)], unique=True
    )
    await database.document_versions.create_index(
        [("grant_id", 1), ("published", 1), ("status", 1), ("sequence", 1)]
    )


def public(item, scope="studio"):
    fields = (
        "document_id",
        "title",
        "filename",
        "content_type",
        "size",
        "version",
        "sequence",
        "created_at",
    )
    result = {"id": item["_id"], **{key: item[key] for key in fields}}
    result["created_at"] = item["created_at"].replace(tzinfo=UTC).isoformat()
    if scope == "studio":
        result.update({key: item.get(key) for key in ("status", "published", "revision")})
        result["history"] = [
            {**event, "at": event["at"].replace(tzinfo=UTC).isoformat()}
            for event in item.get("history", [])
        ]
    return result


async def relation(request, identity, scope, enquiry_id, client_id, operation):
    with database_errors():
        database = get_database()
        await ensure_indexes(database)

        async def write(session):
            grant_id = await fence(
                database, session, request, identity, scope, enquiry_id, client_id
            )
            return await operation(database, session, grant_id)

        return await transaction(database, write)


def storage_or_503():
    try:
        return get_storage()
    except StorageUnavailable:
        raise HTTPException(
            503, "Private document storage is not configured or unavailable."
        ) from None


@router.post(STUDIO + "/uploads")
async def initiate(
    enquiry_id: UUID,
    client_id: UUID,
    request: Request,
    body: UploadBody,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    adapter = storage_or_503()
    if body.size > StorageSettings().document_max_bytes:
        raise HTTPException(413, "Document exceeds the configured upload limit.")

    async def write(database, session, grant_id):
        existing = await database.document_versions.find_one({"_id": str(body.id)}, session=session)
        expected = body.model_dump(mode="json", exclude={"id"})
        if existing:
            if (
                existing["grant_id"] != grant_id
                or existing["created_by"] != identity["_id"]
                or any(existing[key] != value for key, value in expected.items())
            ):
                raise HTTPException(409, "Upload identifier already used. Create a new version.")
            return public(existing)
        version_head = await database.document_version_heads.find_one_and_update(
            {"_id": grant_id + ":" + str(body.document_id)},
            {"$inc": {"version": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        head = await database.document_upload_heads.find_one_and_update(
            {"_id": grant_id},
            {"$inc": {"sequence": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        current = timestamp()
        item = {
            "_id": str(body.id),
            **expected,
            "grant_id": grant_id,
            "enquiry_id": str(enquiry_id),
            "client_id": str(client_id),
            "version": version_head["version"],
            "sequence": head["sequence"],
            "storage_backend": adapter.name,
            "object_key": f"documents/{grant_id}/{body.document_id}/{body.id}",
            "status": "uploading",
            "published": False,
            "revision": 0,
            "created_at": current,
            "created_by": identity["_id"],
            "history": [{"action": "upload_initiated", "actor_id": identity["_id"], "at": current}],
        }
        await database.document_versions.insert_one(item, session=session)
        return public(item)

    return await relation(request, identity, "studio", enquiry_id, str(client_id), write)


def validate_content(content, content_type):
    if content_type == "application/pdf":
        return content.startswith(b"%PDF-") and content.rstrip().endswith(b"%%EOF")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n") and content.endswith(
            b"\x00\x00\x00\x00IEND\xaeB`\x82"
        )
    if content_type == "image/jpeg":
        return (
            len(content) >= 4
            and content.startswith(b"\xff\xd8\xff")
            and content.endswith(b"\xff\xd9")
        )
    return False


async def multipart_content(request, max_bytes):
    # Authentication has completed before parsing. Bound the entire request even
    # without Content-Length; the old installed Starlette has no max_part_size.
    total = 0

    async def bounded_stream():
        nonlocal total
        async for chunk in request.stream():
            total += len(chunk)
            if total > max_bytes + 16384:
                raise HTTPException(413, "Document exceeds the configured upload limit.")
            yield chunk

    parser = MultiPartParser(request.headers, bounded_stream(), max_files=1, max_fields=0)
    try:
        form = await parser.parse()
        try:
            if (
                len(form.multi_items()) != 1
                or "file" not in form
                or not hasattr(form["file"], "read")
            ):
                raise HTTPException(422, "Upload exactly one document file.")
            upload = form["file"]
            content = await upload.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise HTTPException(413, "Document exceeds the configured upload limit.")
            return content, upload.content_type
        finally:
            await form.close()
    except MultiPartException:
        raise HTTPException(422, "Upload exactly one supported document file.") from None
    except BaseException:
        # parse() only closes temporary files on MultiPartException in this
        # Starlette version; close them also on size-limit and disconnect errors.
        for temporary in parser._files_to_close_on_error:
            temporary.close()
        raise


@router.post(STUDIO + "/{version_id}/content")
async def upload_content(
    enquiry_id: UUID,
    client_id: UUID,
    version_id: UUID,
    request: Request,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    adapter = storage_or_503()
    lease = str(uuid4())

    async def reserve(database, session, grant_id):
        item = await database.document_versions.find_one(
            {"_id": str(version_id), "grant_id": grant_id}, session=session
        )
        if not item:
            raise HTTPException(404, "Document not found.")
        if item["storage_backend"] != adapter.name:
            raise HTTPException(
                503, "This document requires its original private storage configuration."
            )
        if item["status"] == "ready":
            return item
        if item.get("lease_until") and item["lease_until"].replace(tzinfo=UTC) > now():
            raise HTTPException(409, "Upload is in progress. Refresh before retrying.")
        await database.document_versions.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "status": "uploading",
                    "lease": lease,
                    "lease_until": now() + timedelta(minutes=5),
                }
            },
            session=session,
        )
        return item

    item = await relation(request, identity, "studio", enquiry_id, str(client_id), reserve)
    error = None
    try:
        content, content_type = await multipart_content(
            request, min(item["size"], StorageSettings().document_max_bytes)
        )
        if (
            content_type != item["content_type"]
            or len(content) != item["size"]
            or hashlib.sha256(content).hexdigest() != item["sha256"]
            or not validate_content(content, content_type)
        ):
            raise HTTPException(
                422, "The file does not match its declared size, type, signature or digest."
            )
        if item["status"] != "ready":
            await run_in_threadpool(adapter.put, item["object_key"], content, item["content_type"])
    except HTTPException as failure:
        error = failure
    except StorageUnavailable:
        error = HTTPException(
            503, "Private upload failed. Retry this version or upload a new version."
        )

    async def finish(database, session, grant_id):
        if item["status"] == "ready":
            return public(item)
        updated = await database.document_versions.find_one_and_update(
            {"_id": item["_id"], "grant_id": grant_id, "lease": lease},
            {
                "$set": {"status": "failed" if error else "ready", "lease_until": timestamp()},
                "$inc": {"revision": 1},
                "$push": {
                    "history": {
                        "action": "upload_failed" if error else "upload_completed",
                        "actor_id": identity["_id"],
                        "at": timestamp(),
                    }
                },
            },
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        if not updated:
            raise HTTPException(409, "Upload ownership changed. Refresh the document status.")
        return public(updated)

    result = await relation(request, identity, "studio", enquiry_id, str(client_id), finish)
    if error:
        raise error
    return result


@router.post(STUDIO + "/{version_id}/publish")
async def publish(
    enquiry_id: UUID,
    client_id: UUID,
    version_id: UUID,
    request: Request,
    body: PublishBody,
    identity: Annotated[dict, Depends(require_staff_write)],
):
    async def write(database, session, grant_id):
        item = await database.document_versions.find_one(
            {"_id": str(version_id), "grant_id": grant_id}, session=session
        )
        if not item:
            raise HTTPException(404, "Document not found.")
        if item["status"] != "ready":
            raise HTTPException(409, "Only a completed upload can be published.")
        if item["revision"] != body.expected_revision:
            # Recover the exact immediately preceding committed retry.
            if (
                item["revision"] == body.expected_revision + 1
                and item["published"] == body.published
                and item["history"][-1].get("actor_id") == identity["_id"]
                and item["history"][-1]["action"]
                == ("published" if body.published else "unpublished")
            ):
                return public(item)
            raise HTTPException(409, "Document changed. Refresh before publishing.")
        if item["published"] == body.published:
            return public(item)
        updated = await database.document_versions.find_one_and_update(
            {"_id": item["_id"], "revision": body.expected_revision},
            {
                "$set": {"published": body.published},
                "$inc": {"revision": 1},
                "$push": {
                    "history": {
                        "action": "published" if body.published else "unpublished",
                        "actor_id": identity["_id"],
                        "at": timestamp(),
                    }
                },
            },
            return_document=ReturnDocument.AFTER,
            session=session,
        )
        return public(updated)

    return await relation(request, identity, "studio", enquiry_id, str(client_id), write)


def read_endpoints(scope):
    dependency = client_auth.require_client if scope == "client" else require_staff
    prefix = CLIENT if scope == "client" else STUDIO

    @router.get(prefix)
    async def versions(
        enquiry_id: UUID,
        request: Request,
        identity: Annotated[dict, Depends(dependency)],
        client_id: UUID | None = None,
        after: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
        limit: Annotated[int, Query(ge=1, le=100)] = 25,
    ):
        async def read(database, session, grant_id):
            query = {"grant_id": grant_id, "sequence": {"$gt": after}}
            if scope == "client":
                query.update({"status": "ready", "published": True})
            items = (
                await database.document_versions.find(query, session=session)
                .sort("sequence", 1)
                .limit(limit + 1)
                .to_list(limit + 1)
            )
            return {
                "items": [public(item, scope) for item in items[:limit]],
                "next_cursor": items[limit - 1]["sequence"] if len(items) > limit else None,
                "upload_max_bytes": StorageSettings().document_max_bytes
                if scope == "studio"
                else None,
            }

        return await relation(
            request,
            identity,
            scope,
            enquiry_id,
            identity["_id"] if scope == "client" else str(client_id),
            read,
        )

    @router.get(prefix + "/{version_id}/download")
    async def download(
        enquiry_id: UUID,
        version_id: UUID,
        request: Request,
        identity: Annotated[dict, Depends(dependency)],
        client_id: UUID | None = None,
    ):
        adapter = storage_or_503()

        async def read(database, session, grant_id):
            query = {"_id": str(version_id), "grant_id": grant_id, "status": "ready"}
            if scope == "client":
                query["published"] = True
            item = await database.document_versions.find_one(query, session=session)
            if not item:
                raise HTTPException(404, "Document not found or unavailable.")
            return item

        item = await relation(
            request,
            identity,
            scope,
            enquiry_id,
            identity["_id"] if scope == "client" else str(client_id),
            read,
        )
        if item["storage_backend"] != adapter.name:
            raise HTTPException(
                503, "This document requires its original private storage configuration."
            )
        try:
            content = await run_in_threadpool(adapter.get, item["object_key"], item["size"])
        except StorageUnavailable:
            raise HTTPException(503, "Private document is temporarily unavailable.") from None
        if len(content) != item["size"] or hashlib.sha256(content).hexdigest() != item["sha256"]:
            raise HTTPException(503, "Private document integrity check failed.")
        # A grant withdrawal or unpublish while storage is read must still deny
        # delivery. Bytes remain private until this final authorization check.
        await relation(
            request,
            identity,
            scope,
            enquiry_id,
            identity["_id"] if scope == "client" else str(client_id),
            read,
        )

        async def chunks():
            for offset in range(0, len(content), 65536):
                yield content[offset : offset + 65536]

        return StreamingResponse(
            chunks(),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename*=UTF-8''"
                + quote(item["filename"], safe=""),
                "Content-Length": str(len(content)),
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store",
            },
        )


read_endpoints("studio")
read_endpoints("client")
