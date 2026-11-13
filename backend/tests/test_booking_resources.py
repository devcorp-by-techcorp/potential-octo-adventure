"""Configured resource persistence, retries, CAS and transaction authorization."""

import asyncio
from datetime import timedelta
from typing import Annotated
from uuid import uuid4

import pytest
from fastapi import Depends, Request
from pymongo.errors import ServerSelectionTimeoutError

import auth
import booking_resources
from db import get_database
from tests.test_auth import ORIGIN, login
from tests.test_auth import staff as staff_fixture

PATH = "/api/studio/booking-resources"


@pytest.fixture
async def setup(client):
    await staff_fixture.__wrapped__()
    session = await login(client)
    assert session.status_code == 200
    return {"Origin": ORIGIN, "X-CSRF-Token": session.json()["csrf_token"]}


def resource(**values):
    return {"id": str(uuid4()), "name": "Configured photographer", "kind": "photographer", **values}


async def test_persistent_retry_revision_history_and_no_reservations(client, setup):
    body = resource()
    first, retry = await asyncio.gather(
        client.post(PATH, headers=setup, json=body), client.post(PATH, headers=setup, json=body)
    )
    assert first.status_code == retry.status_code == 200
    assert first.json() == retry.json()
    assert first.json()["capacity"] == 1 and first.json()["revision"] == 0
    before = first.json()
    edit = await client.patch(
        PATH + "/" + body["id"],
        headers=setup,
        json={"expected_revision": 0, "name": "Lead", "capacity": 2, "enabled": False},
    )
    assert edit.status_code == 200
    assert edit.json()["revision"] == 1 and edit.json()["enabled"] is False
    assert (await client.post(PATH, headers=setup, json=body)).json() == before
    assert (await client.get(PATH)).json()["items"] == [edit.json()]
    conflict = await client.post(PATH, headers=setup, json={**body, "name": "Different"})
    assert conflict.status_code == 409
    database = get_database()
    stored = await database.booking_resources.find_one({"_id": body["id"]})
    assert [entry["action"] for entry in stored["history"]] == ["created", "updated"]
    assert all(entry["actor_id"] for entry in stored["history"])
    assert stored["history"][1]["before"]["capacity"] == 1
    assert stored["history"][1]["after"]["capacity"] == 2
    assert await database.bookings.count_documents({}) == 0
    assert await database.booking_requests.count_documents({}) == 0
    assert await database.client_access.count_documents({}) == 0
    assert "creation_receipt" not in first.text and "actor_id" not in first.text


async def test_concurrent_edits_have_one_winner(client, setup):
    body = resource()
    assert (await client.post(PATH, headers=setup, json=body)).status_code == 200
    responses = await asyncio.gather(
        *[
            client.patch(
                PATH + "/" + body["id"], headers=setup, json={"expected_revision": 0, "name": name}
            )
            for name in ("First editor", "Second editor")
        ]
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    stored = await get_database().booking_resources.find_one({"_id": body["id"]})
    assert stored["revision"] == 1 and len(stored["history"]) == 2


async def test_bounded_pagination_and_private_reads(client, setup):
    for kind in ("photographer", "assistant", "studio_room", "equipment"):
        assert (await client.post(PATH, headers=setup, json=resource(kind=kind))).status_code == 200
    first = await client.get(PATH, params={"limit": 2})
    assert first.headers["cache-control"] == "no-store"
    second = await client.get(PATH, params={"limit": 2, "after": first.json()["next_cursor"]})
    ids = [item["id"] for page in (first, second) for item in page.json()["items"]]
    assert len(set(ids)) == 4 and second.json()["next_cursor"] is None
    assert (await client.get(PATH, params={"limit": 101})).status_code == 422
    assert (await client.get(PATH, params={"after": "invalid"})).status_code == 422
    client.cookies.clear()
    assert (await client.get(PATH)).status_code == 401
    assert (await client.post(PATH, headers=setup, json=resource())).status_code == 401


@pytest.mark.parametrize("capacity", [0, -1, 1.5, True, "2", None, 2**64])
async def test_invalid_capacity_never_persists(client, setup, capacity):
    assert (
        await client.post(PATH, headers=setup, json=resource(capacity=capacity))
    ).status_code == 422
    assert await get_database().booking_resources.count_documents({}) == 0


async def test_write_input_origin_csrf_and_immutable_kind(client, setup):
    body = resource()
    for headers in ({}, {"Origin": "https://evil.test", "X-CSRF-Token": setup["X-CSRF-Token"]}):
        assert (await client.post(PATH, headers=headers, json=body)).status_code == 403
    for values in ({"name": "   "}, {"kind": "invented"}, {"enabled": True}, {"price": 99}):
        assert (await client.post(PATH, headers=setup, json={**body, **values})).status_code == 422
    assert (await client.post(PATH, headers=setup, json=body)).status_code == 200
    for values in (
        {"kind": "equipment"},
        {"enabled": None},
        {"name": "  "},
        {"capacity": False},
        {},
    ):
        assert (
            await client.patch(
                PATH + "/" + body["id"], headers=setup, json={"expected_revision": 0, **values}
            )
        ).status_code == 422
    assert (
        await client.patch(
            PATH + "/" + str(uuid4()),
            headers=setup,
            json={"expected_revision": 0, "enabled": False},
        )
    ).status_code == 404


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("change", ["disabled", "role", "reset", "revoked", "expired"])
async def test_authorization_loss_aborts_configuration(client, setup, operation, change):
    body = resource()
    database = get_database()
    if operation == "update":
        assert (await client.post(PATH, headers=setup, json=body)).status_code == 200
    before = await database.booking_resources.find({}).to_list(10)

    async def invalidate(request: Request, identity: Annotated[dict, Depends(auth.require_staff)]):
        identity = await auth.require_staff_write(request, identity)
        if change in {"disabled", "role", "reset"}:
            changes = {
                "disabled": {"enabled": False},
                "role": {"role": "client"},
                "reset": {"auth_version": "reset"},
            }
            await database.staff_identities.update_one(
                {"_id": identity["_id"]}, {"$set": changes[change]}
            )
        else:
            changes = (
                {"revoked_at": auth.now()}
                if change == "revoked"
                else {"expires_at": auth.now() - timedelta(seconds=1)}
            )
            await database.staff_sessions.update_one(
                {"_id": auth.digest(request.cookies[auth.cookie_name()])}, {"$set": changes}
            )
        return identity

    app = client._transport.app
    app.dependency_overrides[auth.require_staff_write] = invalidate
    try:
        result = await (
            client.post(PATH, headers=setup, json=body)
            if operation == "create"
            else client.patch(
                PATH + "/" + body["id"], headers=setup, json={"expected_revision": 0, "capacity": 2}
            )
        )
    finally:
        app.dependency_overrides.clear()
    assert result.status_code == 401
    assert await database.booking_resources.find({}).to_list(10) == before


async def test_database_failure_aborts_resource_and_fences(client, setup, monkeypatch):
    database = get_database()
    accounts = await database.staff_identities.find({}).to_list(10)
    sessions = await database.staff_sessions.find({}).to_list(10)

    original = type(database.booking_resources).insert_one

    async def fail(collection, *args, **kwargs):
        if collection.name == "booking_resources":
            raise ServerSelectionTimeoutError("private diagnostic")
        return await original(collection, *args, **kwargs)

    monkeypatch.setattr(type(database.booking_resources), "insert_one", fail)
    result = await client.post(PATH, headers=setup, json=resource())
    assert result.status_code == 503 and "private diagnostic" not in result.text
    assert await database.booking_resources.count_documents({}) == 0
    assert await database.staff_identities.find({}).to_list(10) == accounts
    assert await database.staff_sessions.find({}).to_list(10) == sessions


async def test_snapshot_retry_rechecks_resource_authorization(client, setup, monkeypatch):
    original, calls = booking_resources.fence_staff_write, 0

    async def conflict(db, request, identity, session):
        nonlocal calls
        calls += 1
        if calls == 1:
            await db.staff_identities.find_one({"_id": identity["_id"]}, session=session)
            await db.staff_identities.update_one(
                {"_id": identity["_id"]}, {"$set": {"enabled": False}}
            )
        await original(db, request, identity, session)

    monkeypatch.setattr(booking_resources, "fence_staff_write", conflict)
    assert (await client.post(PATH, headers=setup, json=resource())).status_code == 401
    assert calls >= 2 and await get_database().booking_resources.count_documents({}) == 0
