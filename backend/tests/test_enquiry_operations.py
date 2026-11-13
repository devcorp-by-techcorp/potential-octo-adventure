"""Real MongoDB search, privacy-bounded export and per-record bulk CAS evidence."""

import asyncio
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pymongo.errors import ServerSelectionTimeoutError

import auth
import enquiry_operations as operations
from db import get_database
from tests.test_auth import ORIGIN, PASSWORD
from tests.test_studio_enquiries import authorized, record, staff  # noqa: F401

pytestmark = pytest.mark.usefixtures("authorized")
BASE = "/api/studio/operations"


@pytest.fixture(autouse=True)
async def real_mongodb():
    hello = await get_database().client.admin.command("hello")
    assert hello.get("setName"), "Enquiry search verification requires real MongoDB replica set"


async def records(count=1):
    values = [record(index=index + 1, studio_note="internal-only-secret") for index in range(count)]
    await get_database().booking_requests.insert_many(values)
    return values


async def headers(client):
    session = await client.get("/api/auth/session")
    return {"Origin": ORIGIN, "X-CSRF-Token": session.json()["csrf_token"]}


def batch(values, status="in_review", revision=0):
    return {
        "studio_status": status,
        "items": [{"id": item["_id"], "expected_revision": revision} for item in values],
    }


async def test_indexed_search_each_authorised_field_and_no_note_search(client):
    database = get_database()
    values = []
    for index, field in enumerate(operations.SEARCH_FIELDS):
        values.append(
            record(
                index=index + 1,
                **{field: "zebrastudiotoken" + str(index)},
                studio_note="internal-only-secret",
            )
        )
    await database.booking_requests.insert_many(values)
    for index in range(len(values)):
        response = await client.get(
            BASE + "/enquiries", params={"query": "zebrastudiotoken" + str(index)}
        )
        assert response.status_code == 200, response.text
        assert [item["id"] for item in response.json()["items"]] == [values[index]["_id"]]
        assert response.headers["cache-control"] == "no-store"
        assert "internal-only-secret" not in response.text
    assert (await client.get(BASE + "/enquiries", params={"query": "internal-only-secret"})).json()[
        "items"
    ] == []
    indexes = await database.booking_requests.index_information()
    assert set(indexes["studio_enquiry_search"]["weights"]) == set(operations.SEARCH_FIELDS)
    assert indexes["studio_enquiry_search"]["default_language"] == "none"


async def test_paged_export_allowlist_legacy_defaults_and_bounds(client):
    values = await records(3)
    database = get_database()
    await database.booking_requests.update_one(
        {"_id": values[0]["_id"]},
        {
            "$set": {
                "studio_status": None,
                "name": "=HYPERLINK(unsafe)",
                "payload_hash": "auth-secret",
            }
        },
    )
    await database.booking_requests.update_one(
        {"_id": values[1]["_id"]}, {"$set": {"studio_status": "unsupported"}}
    )
    first = await client.get(BASE + "/export", params={"limit": 2})
    assert first.status_code == 200, first.text
    page = first.json()
    assert len(page["items"]) == 2 and page["next_offset"] == 2
    next_page = (await client.get(BASE + "/export", params={"limit": 2, "offset": 2})).json()
    all_items = page["items"] + next_page["items"]
    assert len({item["id"] for item in all_items}) == 3 and next_page["next_offset"] is None
    assert all(set(item) == {"id", *operations.LIST_FIELDS} for item in all_items)
    assert "internal-only-secret" not in first.text and "auth-secret" not in first.text
    legacy = next(item for item in all_items if item["id"] == values[0]["_id"])
    assert legacy["studio_status"] == "new" and legacy["studio_revision"] == 0
    # JSON is data; formula-like customer text is never emitted as CSV cells.
    assert legacy["name"] == "=HYPERLINK(unsafe)"
    for params in (
        {"limit": 101},
        {"limit": 0},
        {"offset": 10001},
        {"offset": -1},
        {"query": " "},
        {"query": "x" * 201},
        {"status": "confirmed"},
    ):
        assert (await client.get(BASE + "/enquiries", params=params)).status_code == 422
    only_new = (await client.get(BASE + "/enquiries", params={"status": "new"})).json()
    assert len(only_new["items"]) == 2


async def test_bulk_partial_success_metadata_cas_retry_and_privacy(client):
    values = await records(2)
    database = get_database()
    await database.booking_requests.update_one(
        {"_id": values[1]["_id"]}, {"$set": {"studio_revision": 4}}
    )
    missing = {"_id": str(uuid4())}
    body = batch([*values, missing], status="archived")
    response = await client.post(BASE + "/bulk-triage", headers=await headers(client), json=body)
    assert response.status_code == 200, response.text
    assert [item["outcome"] for item in response.json()["results"]] == [
        "updated",
        "conflict",
        "not_found",
    ]
    assert "internal-only-secret" not in response.text and "private" not in response.text
    saved = await database.booking_requests.find_one({"_id": values[0]["_id"]})
    actor = await database.staff_identities.find_one({})
    assert saved["studio_status"] == "archived" and saved["studio_revision"] == 1
    assert saved["studio_updated_by"] == actor["_id"] and saved["studio_updated_at"]
    assert (
        saved["studio_note"] == "internal-only-secret" and saved["message"] == values[0]["message"]
    )
    retry = await client.post(BASE + "/bulk-triage", headers=await headers(client), json=body)
    assert [item["outcome"] for item in retry.json()["results"]] == [
        "conflict",
        "conflict",
        "not_found",
    ]
    assert await database.booking_requests.count_documents({}) == 2
    assert await database.booking_requests.find_one({"_id": values[0]["_id"]}) == saved


async def test_concurrent_bulk_confirms_exactly_one_revision_change(client):
    values = await records()
    request_headers = await headers(client)
    responses = await asyncio.gather(
        *[
            client.post(BASE + "/bulk-triage", headers=request_headers, json=batch(values))
            for _ in range(2)
        ]
    )
    assert sorted(response.json()["results"][0]["outcome"] for response in responses) == [
        "conflict",
        "updated",
    ]
    assert (await get_database().booking_requests.find_one({}))["studio_revision"] == 1


async def test_bulk_validation_and_csrf_change_nothing(client):
    values = await records()
    request_headers = await headers(client)
    invalid = [
        batch([]),
        batch(values * 2),
        batch(values, status="confirmed"),
        {**batch(values), "studio_note": "unsupported"},
        {"studio_status": "new", "items": [{"id": values[0]["_id"], "expected_revision": True}]},
        {
            "studio_status": "new",
            "items": [{"id": str(uuid4()), "expected_revision": 0} for _ in range(51)],
        },
    ]
    for body in invalid:
        assert (
            await client.post(BASE + "/bulk-triage", headers=request_headers, json=body)
        ).status_code == 422
    for invalid_headers in (
        {},
        {"Origin": ORIGIN, "X-CSRF-Token": "invalid"},
        {**request_headers, "Origin": "https://untrusted.example"},
    ):
        assert (
            await client.post(BASE + "/bulk-triage", headers=invalid_headers, json=batch(values))
        ).status_code == 403
    saved = await get_database().booking_requests.find_one({})
    assert "studio_revision" not in saved and "studio_updated_at" not in saved


async def test_authentication_expiry_cross_role_and_client_isolation(client, monkeypatch):
    values = await records()
    paths = [BASE + "/enquiries", BASE + "/export"]
    token = client.cookies[auth.cookie_name()]
    client.cookies.clear()
    for path in paths:
        response = await client.get(path, headers={"X-Role": "staff"})
        assert response.status_code == 401 and response.headers["cache-control"] == "no-store"
    assert (await client.post(BASE + "/bulk-triage", json=batch(values))).status_code == 401
    client.cookies.set(auth.cookie_name(), token)
    actual_now = auth.now()
    monkeypatch.setattr(auth, "now", lambda: actual_now + timedelta(days=1))
    assert (await client.get(paths[0])).status_code == 401
    monkeypatch.setattr(auth, "now", lambda: actual_now)
    database = get_database()
    await database.staff_identities.update_many({}, {"$set": {"role": "client"}})
    assert (await client.get(paths[1])).status_code == 403
    client.cookies.clear()
    identity = await database.staff_identities.find_one({})
    await database.client_identities.insert_one(
        {**identity, "_id": "operations-client", "email": "operations-client@example.test"}
    )
    signed_in = await client.post(
        "/api/auth/client/login",
        headers={"Origin": ORIGIN},
        json={"email": "operations-client@example.test", "password": PASSWORD},
    )
    assert signed_in.status_code == 200, signed_in.text
    for path in paths:
        assert (await client.get(path)).status_code == 401
    assert (
        await client.post(
            BASE + "/bulk-triage",
            headers={"Origin": ORIGIN, "X-CSRF-Token": signed_in.json()["csrf_token"]},
            json=batch(values),
        )
    ).status_code == 401


async def test_bulk_rechecks_authorisation_between_records(client, monkeypatch):
    values = await records(3)
    actual_update = operations.update_enquiry

    async def disable_after_first(*args, **kwargs):
        saved = await actual_update(*args, **kwargs)
        await get_database().staff_identities.update_many({}, {"$set": {"enabled": False}})
        return saved

    monkeypatch.setattr(operations, "update_enquiry", disable_after_first)
    response = await client.post(
        BASE + "/bulk-triage", headers=await headers(client), json=batch(values)
    )
    assert response.status_code == 200
    assert response.json()["authorization_lost"] is True
    assert [item["outcome"] for item in response.json()["results"]] == [
        "updated",
        "authorization_lost",
        "not_attempted",
    ]
    assert await get_database().booking_requests.count_documents({"studio_revision": 1}) == 1


async def test_bulk_database_failure_exposes_partial_result_without_retry(client, monkeypatch):
    values = await records(3)
    actual_update = operations.update_enquiry
    calls = 0

    async def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise HTTPException(503, "private database error")
        return await actual_update(*args, **kwargs)

    monkeypatch.setattr(operations, "update_enquiry", fail_second)
    response = await client.post(
        BASE + "/bulk-triage", headers=await headers(client), json=batch(values)
    )
    assert [item["outcome"] for item in response.json()["results"]] == [
        "updated",
        "unavailable",
        "not_attempted",
    ]
    assert "private database" not in response.text
    assert await get_database().booking_requests.count_documents({"studio_revision": 1}) == 1


async def test_search_database_failure_does_not_fabricate_empty_page(client, monkeypatch):
    async def unavailable(*args, **kwargs):
        raise ServerSelectionTimeoutError("private database configuration")

    monkeypatch.setattr(operations, "ensure_indexes", unavailable)
    response = await client.get(BASE + "/enquiries", params={"query": "example"})
    assert response.status_code == 503 and "items" not in response.json()
    assert "private database" not in response.text
    assert response.headers["cache-control"] == "no-store"
