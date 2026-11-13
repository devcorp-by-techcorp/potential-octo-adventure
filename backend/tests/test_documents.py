"""Real replica-set private documents plus storage provider-boundary tests."""

import asyncio
import hashlib
import io
from uuid import uuid4

import pytest

from db import get_database
from storage import LocalStorage, R2Storage, StorageSettings, StorageUnavailable
from tests.test_client_invitations import ID, enrolled
from tests.test_client_invitations import setup as invitation_setup

PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"


@pytest.fixture
async def documents(client, monkeypatch, tmp_path):
    monkeypatch.setitem(StorageSettings.model_config, "env_file", None)
    monkeypatch.setenv("DOCUMENT_STORAGE_BACKEND", "local")
    monkeypatch.setenv("DOCUMENT_STORAGE_LOCAL_ROOT", str(tmp_path / "objects"))
    setup = await invitation_setup.__wrapped__(client)
    _, _, client_headers = await enrolled(client, setup)
    grant = await get_database().client_access.find_one({})
    studio = f"/api/studio/enquiries/{ID}/documents/{grant['client_id']}"
    return studio, f"/api/client/enquiries/{ID}/documents", setup, client_headers, grant


def metadata(content=PDF, **overrides):
    return {
        "id": str(uuid4()),
        "document_id": str(uuid4()),
        "title": "Session information",
        "filename": "information.pdf",
        "content_type": "application/pdf",
        "size": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        **overrides,
    }


async def ready(client, documents, body=None):
    studio, _, staff, _, _ = documents
    body = body or metadata()
    initiated = await client.post(studio + "/uploads", headers=staff, json=body)
    assert initiated.status_code == 200, initiated.text
    response = await client.post(
        studio + "/" + body["id"] + "/content",
        headers=staff,
        files={"file": (body["filename"], PDF, body["content_type"])},
    )
    assert response.status_code == 200, response.text
    return body, response.json()


async def test_persisted_private_upload_download_and_publication(client, documents):
    studio, client_path, staff, headers, grant = documents
    body, version = await ready(client, documents)
    assert (
        version["status"] == "ready" and version["published"] is False and version["revision"] == 1
    )
    assert (await client.get(client_path)).json()["items"] == []
    assert (await client.get(client_path + "/" + body["id"] + "/download")).status_code == 404
    download = await client.get(studio + "/" + body["id"] + "/download")
    assert download.content == PDF
    assert download.headers["cache-control"] == "no-store"
    assert download.headers["x-content-type-options"] == "nosniff"
    assert download.headers["content-type"] == "application/octet-stream"
    assert download.headers["content-disposition"].startswith("attachment;")
    assert (await client.post(studio + "/uploads", headers=staff, json=body)).json() == version
    retry = await client.post(
        studio + "/" + body["id"] + "/content",
        headers=staff,
        files={"file": ("information.pdf", PDF, "application/pdf")},
    )
    assert retry.json() == version
    published = await client.post(
        studio + "/" + body["id"] + "/publish",
        headers=staff,
        json={"published": True, "expected_revision": 1},
    )
    assert published.status_code == 200
    assert (
        await client.post(
            studio + "/" + body["id"] + "/publish",
            headers=staff,
            json={"published": True, "expected_revision": 1},
        )
    ).json() == published.json()
    page = await client.get(client_path)
    assert len(page.json()["items"]) == 1
    assert set(page.json()["items"][0]) == {
        "id",
        "document_id",
        "title",
        "filename",
        "content_type",
        "size",
        "version",
        "sequence",
        "created_at",
    }
    assert (
        "object_key" not in page.text and "sha256" not in page.text and "actor_id" not in page.text
    )
    assert (await client.get(client_path + "/" + body["id"] + "/download")).content == PDF
    unpublished = await client.post(
        studio + "/" + body["id"] + "/publish",
        headers=staff,
        json={"published": False, "expected_revision": 2},
    )
    assert unpublished.status_code == 200
    assert (await client.get(client_path)).json()["items"] == []
    assert (await client.get(client_path + "/" + body["id"] + "/download")).status_code == 404
    stored = await get_database().document_versions.find_one({"_id": body["id"]})
    assert [event["action"] for event in stored["history"]] == [
        "upload_initiated",
        "upload_completed",
        "published",
        "unpublished",
    ]
    assert (await get_database().booking_requests.find_one({"_id": ID}))[
        "state"
    ] == "awaiting_studio_confirmation"


async def test_immutable_versions_concurrent_initiation_and_revision_conflicts(client, documents):
    studio, client_path, staff, headers, grant = documents
    body = metadata()
    responses = await asyncio.gather(
        *[client.post(studio + "/uploads", headers=staff, json=body) for _ in range(3)]
    )
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json() == responses[0].json() for response in responses)
    assert await get_database().document_versions.count_documents({}) == 1
    _, version = await ready(client, documents, body)
    second_body, second = await ready(client, documents, metadata(document_id=body["document_id"]))
    assert version["version"] == 1 and second["version"] == 2 and version["id"] != second["id"]
    assert await get_database().document_versions.count_documents({}) == 2
    conflict = await client.post(
        studio + "/uploads", headers=staff, json={**body, "title": "changed"}
    )
    assert conflict.status_code == 409
    publish = await client.post(
        studio + "/" + body["id"] + "/publish",
        headers=staff,
        json={"published": True, "expected_revision": 0},
    )
    assert publish.status_code == 409
    first_page = (await client.get(studio + "?limit=1")).json()
    assert first_page["items"][0]["version"] == 1 and first_page["next_cursor"] == 1
    second_page = (await client.get(studio + "?after=1&limit=1")).json()
    assert second_page["items"][0]["version"] == 2 and second_page["next_cursor"] is None
    assert (await client.get(studio + "?limit=101")).status_code == 422


async def test_failed_uploads_retries_validation_and_integrity(client, documents, monkeypatch):
    import documents as document_module

    studio, _, staff, _, _ = documents
    body = metadata()
    assert (await client.post(studio + "/uploads", headers=staff, json=body)).status_code == 200
    path = studio + "/" + body["id"]
    wrong = await client.post(
        path + "/content",
        headers=staff,
        files={"file": ("information.pdf", b"<html>unsafe</html>", "application/pdf")},
    )
    assert wrong.status_code == 422
    assert (await client.get(studio)).json()["items"][0]["status"] == "failed"
    assert (
        await client.post(
            path + "/publish", headers=staff, json={"published": True, "expected_revision": 1}
        )
    ).status_code == 409
    assert (await client.get(path + "/download")).status_code == 404
    _, complete = await ready(client, documents, body)
    assert complete["status"] == "ready"
    stored = await get_database().document_versions.find_one({"_id": body["id"]})
    adapter = document_module.get_storage()
    adapter.path(stored["object_key"]).write_bytes(b"corrupt")
    assert (await client.get(path + "/download")).status_code == 503
    for invalid in [
        metadata(content_type="text/html"),
        metadata(filename="../private.pdf"),
        metadata(title=" "),
        metadata(size=0),
    ]:
        assert (
            await client.post(studio + "/uploads", headers=staff, json=invalid)
        ).status_code == 422
    monkeypatch.setenv("DOCUMENT_MAX_BYTES", "10")
    assert (
        await client.post(studio + "/uploads", headers=staff, json=metadata())
    ).status_code == 413
    monkeypatch.setenv("DOCUMENT_STORAGE_BACKEND", "disabled")
    assert (
        await client.post(studio + "/uploads", headers=staff, json=metadata())
    ).status_code == 503


async def test_role_ownership_csrf_and_withdrawal(client, documents):
    from httpx import ASGITransport, AsyncClient

    import auth
    import client_auth
    from server import create_app

    studio, client_path, staff, headers, grant = documents
    body, version = await ready(client, documents)
    assert (await client.post(studio + "/uploads", json=metadata())).status_code == 403
    assert (
        await client.post(
            studio + "/uploads", headers={**staff, "Origin": "https://evil.test"}, json=metadata()
        )
    ).status_code == 403
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={client_auth.cookie_name(): client.cookies[client_auth.cookie_name()]},
    ) as only_client:
        assert (await only_client.get(studio)).status_code == 401
        assert (
            await only_client.post(studio + "/uploads", headers=headers, json=metadata())
        ).status_code == 401
        assert (
            await only_client.post(
                studio + "/" + body["id"] + "/publish",
                headers=headers,
                json={"published": True, "expected_revision": 1},
            )
        ).status_code == 401
    assert (await client.get(studio.replace(grant["client_id"], str(uuid4())))).status_code == 404
    assert (await client.get(studio + "/" + str(uuid4()) + "/download")).status_code == 404
    await get_database().client_access.update_one(
        {"_id": grant["_id"]}, {"$set": {"revoked_at": auth.now()}}
    )
    assert (await client.get(client_path)).status_code == 404
    assert (await client.get(studio + "/" + body["id"] + "/download")).status_code == 404
    assert (
        await client.post(
            studio + "/" + body["id"] + "/publish",
            headers=staff,
            json={"published": True, "expected_revision": 1},
        )
    ).status_code == 404


async def test_storage_failure_is_recorded_and_retryable(client, documents, monkeypatch):
    studio, _, staff, _, _ = documents
    original = LocalStorage.put

    def fail(*args):
        raise StorageUnavailable("synthetic private storage fault")

    body = metadata()
    assert (await client.post(studio + "/uploads", headers=staff, json=body)).status_code == 200
    monkeypatch.setattr(LocalStorage, "put", fail)
    failure = await client.post(
        studio + "/" + body["id"] + "/content",
        headers=staff,
        files={"file": ("information.pdf", PDF, "application/pdf")},
    )
    assert failure.status_code == 503
    assert (await client.get(studio)).json()["items"][0]["status"] == "failed"
    monkeypatch.setattr(LocalStorage, "put", original)
    await ready(client, documents, body)


def test_local_storage_traversal_symlinks_exclusivity_and_size(tmp_path):
    adapter = LocalStorage(tmp_path / "private")
    key = "documents/" + "/".join(str(uuid4()) for _ in range(3))
    for invalid in ("../secrets", key + "/../../secret", "documents/../../secret"):
        with pytest.raises(StorageUnavailable):
            adapter.put(invalid, PDF, "application/pdf")
    adapter.put(key, PDF, "application/pdf")
    adapter.put(key, PDF, "application/pdf")
    assert adapter.get(key, len(PDF)) == PDF
    with pytest.raises(StorageUnavailable):
        adapter.put(key, b"different", "application/pdf")
    with pytest.raises(StorageUnavailable):
        adapter.get(key, 1)
    symlink_key = "documents/" + "/".join(str(uuid4()) for _ in range(3))
    adapter.path(symlink_key).symlink_to(adapter.path(key))
    with pytest.raises(StorageUnavailable):
        adapter.get(symlink_key, len(PDF))


def test_r2_private_adapter_parameters_and_response_boundary():
    import boto3
    from botocore.stub import Stubber

    client = boto3.client(
        "s3",
        region_name="auto",
        endpoint_url="https://test.invalid",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    adapter = R2Storage(client, "private-test-bucket")
    key = "documents/" + "/".join(str(uuid4()) for _ in range(3))
    with Stubber(client) as stub:
        stub.add_response(
            "put_object",
            {},
            {
                "Bucket": adapter.bucket,
                "Key": key,
                "Body": PDF,
                "ContentLength": len(PDF),
                "ContentType": "application/pdf",
                "IfNoneMatch": "*",
            },
        )
        adapter.put(key, PDF, "application/pdf")
        stub.add_response(
            "get_object",
            {"Body": io.BytesIO(PDF), "ContentLength": len(PDF)},
            {"Bucket": adapter.bucket, "Key": key},
        )
        assert adapter.get(key, len(PDF)) == PDF
        stub.add_client_error(
            "put_object",
            service_error_code="PreconditionFailed",
            http_status_code=412,
            expected_params={
                "Bucket": adapter.bucket,
                "Key": key,
                "Body": PDF,
                "ContentLength": len(PDF),
                "ContentType": "application/pdf",
                "IfNoneMatch": "*",
            },
        )
        stub.add_response(
            "get_object",
            {"Body": io.BytesIO(PDF), "ContentLength": len(PDF)},
            {"Bucket": adapter.bucket, "Key": key},
        )
        adapter.put(key, PDF, "application/pdf")
        stub.add_client_error(
            "get_object",
            service_error_code="AccessDenied",
            http_status_code=403,
            expected_params={"Bucket": adapter.bucket, "Key": key},
        )
        with pytest.raises(StorageUnavailable):
            adapter.get(key, len(PDF))
        stub.assert_no_pending_responses()


async def test_chunked_upload_bound_without_content_length(client, documents):
    studio, _, staff, _, _ = documents
    body = metadata()
    assert (await client.post(studio + "/uploads", headers=staff, json=body)).status_code == 200
    raw = (
        b'--test-boundary\r\nContent-Disposition: form-data; name="file"; '
        b'filename="information.pdf"\r\nContent-Type: application/pdf\r\n\r\n'
        + b"A" * 30000
        + b"\r\n--test-boundary--\r\n"
    )

    async def chunks():
        for offset in range(0, len(raw), 4096):
            yield raw[offset : offset + 4096]

    response = await client.post(
        studio + "/" + body["id"] + "/content",
        headers={**staff, "Content-Type": "multipart/form-data; boundary=test-boundary"},
        content=chunks(),
    )
    assert response.status_code == 413
    assert (await client.get(studio)).json()["items"][0]["status"] == "failed"
    await ready(client, documents, body)


async def test_cross_account_download_denial_and_revocation_during_storage_read(
    client, documents, monkeypatch
):
    import os
    from datetime import timedelta

    from httpx import ASGITransport, AsyncClient
    from pymongo import MongoClient

    import auth
    import client_auth
    from server import create_app

    studio, client_path, staff, _, grant = documents
    body, version = await ready(client, documents)
    assert (
        await client.post(
            studio + "/" + body["id"] + "/publish",
            headers=staff,
            json={"published": True, "expected_revision": 1},
        )
    ).status_code == 200
    database = get_database()
    identity = await database.client_identities.find_one({"_id": grant["client_id"]})
    other_id = str(uuid4())
    await database.client_identities.insert_one(
        {**identity, "_id": other_id, "email": "other-documents@example.test"}
    )
    await database.client_sessions.insert_one(
        {
            "_id": auth.digest("other-document-token"),
            "scope": "client",
            "identity_id": other_id,
            "auth_version": identity["auth_version"],
            "expires_at": auth.now() + timedelta(hours=1),
            "revoked_at": None,
        }
    )
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={client_auth.cookie_name(): "other-document-token"},
    ) as other:
        assert (await other.get(client_path)).status_code == 404
        assert (await other.get(client_path + "/" + body["id"] + "/download")).status_code == 404
    original = LocalStorage.get

    def withdraw_during_read(adapter, key, max_bytes):
        content = original(adapter, key, max_bytes)
        with MongoClient(os.environ["TEST_MONGODB_URI"]) as mongo:
            mongo[database.name].client_access.update_one(
                {"_id": grant["_id"]}, {"$set": {"revoked_at": auth.now()}}
            )
        return content

    monkeypatch.setattr(LocalStorage, "get", withdraw_during_read)
    assert (await client.get(client_path + "/" + body["id"] + "/download")).status_code == 404
