"""Booking writes must fence authorization lost after dependency validation."""

from datetime import timedelta
from typing import Annotated

import pytest
from fastapi import Depends, Request

import auth
from db import get_database
from tests.test_bookings import setup as booking_setup


@pytest.fixture
async def setup(client):
    return await booking_setup.__wrapped__(client)


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("change", ["disabled", "role", "reset", "revoked", "expired"])
async def test_booking_write_denied_after_authorization_check(client, setup, operation, change):
    enquiry, headers = setup
    database = get_database()
    create_path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
    if operation == "update":
        created = await client.post(create_path, headers=headers, json={})
        assert created.status_code == 200
        path = f"/api/studio/bookings/{created.json()['id']}"
        payload = {"expected_revision": 0, "staff_note": "Must never persist"}
    else:
        path, payload = create_path, {}
    before = await database.bookings.find({}).to_list(100)
    source = await database.booking_requests.find_one({"_id": enquiry["_id"]})

    async def invalidate(
        request: Request, identity: Annotated[dict, Depends(auth.require_staff)]
    ):
        # Run the real Origin/CSRF validation, then invalidate the same account or
        # browser session before the route's persistence work starts.
        identity = await auth.require_staff_write(request, identity)
        session_id = auth.digest(request.cookies[auth.cookie_name()])
        if change in {"disabled", "role", "reset"}:
            updates = {
                "disabled": {"enabled": False},
                "role": {"role": "client"},
                "reset": {"auth_version": "changed-by-operator"},
            }
            await database.staff_identities.update_one(
                {"_id": identity["_id"]}, {"$set": updates[change]}
            )
        else:
            updates = (
                {"expires_at": auth.now() - timedelta(seconds=1)}
                if change == "expired"
                else {"revoked_at": auth.now()}
            )
            await database.staff_sessions.update_one({"_id": session_id}, {"$set": updates})
        return identity

    app = client._transport.app
    app.dependency_overrides[auth.require_staff_write] = invalidate
    try:
        response = await (
            client.post(path, headers=headers, json=payload)
            if operation == "create"
            else client.patch(path, headers=headers, json=payload)
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401, response.text
    assert await database.bookings.find({}).to_list(100) == before
    assert await database.booking_requests.find_one({"_id": enquiry["_id"]}) == source


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("record_kind", ["account", "session"])
async def test_snapshot_conflict_retries_revalidate_authorization(
    client, setup, monkeypatch, operation, record_kind
):
    import bookings

    enquiry, headers = setup
    database = get_database()
    path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
    payload = {}
    if operation == "update":
        created = await client.post(path, headers=headers, json={})
        assert created.status_code == 200
        path = f"/api/studio/bookings/{created.json()['id']}"
        payload = {"expected_revision": 0, "state": "cancelled"}
    before = await database.bookings.find({}).to_list(100)
    original = bookings.fence_staff_write
    attempts = 0

    async def conflict(db, request, identity, session):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            # Establish a transaction snapshot before a separately committed
            # operator change. The attempted fence must conflict, then retry
            # against a new snapshot and reject the now-denied authorization.
            await db.staff_identities.find_one({"_id": identity["_id"]}, session=session)
            await db.staff_sessions.find_one(
                {"_id": auth.digest(request.cookies[auth.cookie_name()])}, session=session
            )
            if record_kind == "account":
                await db.staff_identities.update_one(
                    {"_id": identity["_id"]}, {"$set": {"enabled": False}}
                )
            else:
                await db.staff_sessions.update_one(
                    {"_id": auth.digest(request.cookies[auth.cookie_name()])},
                    {"$set": {"revoked_at": auth.now()}},
                )
        await original(db, request, identity, session)

    monkeypatch.setattr(bookings, "fence_staff_write", conflict)
    response = await (
        client.post(path, headers=headers, json=payload)
        if operation == "create"
        else client.patch(path, headers=headers, json=payload)
    )
    assert response.status_code == 401, response.text
    assert attempts >= 2
    assert await database.bookings.find({}).to_list(100) == before
    checks = await database.staff_identities.count_documents(
        {"authorization_checks": {"$gt": 0}}
    )
    assert checks == (1 if operation == "update" else 0)


@pytest.mark.parametrize("operation", ["create", "update"])
async def test_booking_failure_rolls_back_authorization_fences(
    client, setup, monkeypatch, operation
):
    from pymongo.errors import ServerSelectionTimeoutError

    enquiry, headers = setup
    database = get_database()
    path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
    payload = {}
    if operation == "update":
        created = await client.post(path, headers=headers, json={})
        assert created.status_code == 200
        path = f"/api/studio/bookings/{created.json()['id']}"
        payload = {"expected_revision": 0, "state": "cancelled"}
    before = await database.bookings.find({}).to_list(100)
    account = await database.staff_identities.find_one({})
    session_record = await database.staff_sessions.find_one({})
    method = "insert_one" if operation == "create" else "find_one_and_update"
    original = getattr(type(database.bookings), method)

    async def fail(collection, *args, **kwargs):
        if collection.name == "bookings":
            raise ServerSelectionTimeoutError("private-db-diagnostic")
        return await original(collection, *args, **kwargs)

    monkeypatch.setattr(type(database.bookings), method, fail)
    response = await (
        client.post(path, headers=headers, json=payload)
        if operation == "create"
        else client.patch(path, headers=headers, json=payload)
    )
    assert response.status_code == 503 and "private-db-diagnostic" not in response.text
    assert await database.bookings.find({}).to_list(100) == before
    assert await database.staff_identities.find_one({}) == account
    assert await database.staff_sessions.find_one({}) == session_record


async def test_distinct_staff_concurrent_creation_and_revision_edits(client, setup):
    import asyncio
    from uuid import uuid4

    from httpx import ASGITransport, AsyncClient

    from server import create_app
    from tests.test_auth import ORIGIN, PASSWORD

    enquiry, headers = setup
    database = get_database()
    identity = await database.staff_identities.find_one({})
    second_identity = {**identity, "_id": str(uuid4()), "email": "other-booking@example.test"}
    await database.staff_identities.insert_one(second_identity)
    original_source = await database.booking_requests.find_one({"_id": enquiry["_id"]})
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as other:
        login = await other.post(
            "/api/auth/login", headers={"Origin": ORIGIN},
            json={"email": second_identity["email"], "password": PASSWORD},
        )
        assert login.status_code == 200
        other_headers = {"Origin": ORIGIN, "X-CSRF-Token": login.json()["csrf_token"]}
        create_path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
        first, second = await asyncio.gather(
            client.post(create_path, headers=headers, json={}),
            other.post(create_path, headers=other_headers, json={}),
        )
        assert first.status_code == second.status_code == 200
        assert first.json() == second.json()
        assert await database.bookings.count_documents({}) == 1
        path = f"/api/studio/bookings/{first.json()['id']}"
        responses = await asyncio.gather(
            client.patch(
                path, headers=headers, json={"expected_revision": 0, "staff_note": "First"}
            ),
            other.patch(
                path, headers=other_headers, json={"expected_revision": 0, "staff_note": "Second"}
            ),
        )
        assert sorted(result.status_code for result in responses) == [200, 409]
        saved = await database.bookings.find_one({})
        assert saved["revision"] == 1 and len(saved["history"]) == 1
        assert (await client.post(create_path, headers=headers, json={})).json()["revision"] == 1
    assert await database.booking_requests.find_one({"_id": enquiry["_id"]}) == original_source
