"""Own-account withdrawal through real handlers and replica-set transactions."""

import asyncio
from datetime import timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pymongo.errors import ServerSelectionTimeoutError

import account_sessions
import auth
import client_auth
from db import get_database
from server import create_app

ORIGIN = "http://127.0.0.1:5173"
PASSWORD = "session-management-test-password"


@pytest.fixture(params=["staff", "client"])
async def setup(request):
    scope = request.param
    database = get_database()
    identity = {
        "_id": "session-owner",
        "email": "session-owner@example.test",
        "name": "Session Owner",
        "enabled": True,
        "role": scope,
        "auth_version": str(uuid4()),
        "password_hash": auth.password_hash(PASSWORD),
    }
    await database[f"{scope}_identities"].insert_one(identity)
    prefix = "/api/auth/client" if scope == "client" else "/api/auth"
    clients = []
    headers = []
    try:
        for _ in range(3):
            signed_in = AsyncClient(
                transport=ASGITransport(app=create_app()), base_url="http://testserver"
            )
            clients.append(signed_in)
            result = await signed_in.post(
                prefix + "/login",
                headers={"Origin": ORIGIN},
                json={"email": identity["email"], "password": PASSWORD},
            )
            assert result.status_code == 200, result.text
            headers.append({"Origin": ORIGIN, "X-CSRF-Token": result.json()["csrf_token"]})
        yield scope, identity, prefix, clients, headers
    finally:
        for signed_in in clients:
            await signed_in.aclose()


async def test_counts_revocation_persistence_and_isolation(setup):
    scope, identity, prefix, clients, headers = setup
    first, second, third = clients
    database = get_database()
    sessions = database[f"{scope}_sessions"]
    sample = await sessions.find_one({})
    # Other accounts, scope, versions and expired sessions do not enter counts.
    await sessions.insert_many(
        [
            {**sample, "_id": "another-account", "identity_id": "different-owner"},
            {**sample, "_id": "old-version", "auth_version": "old"},
            {**sample, "_id": "expired", "expires_at": auth.now() - timedelta(seconds=10)},
            {**sample, "_id": "revoked", "revoked_at": auth.now()},
        ]
    )
    other_scope = "staff" if scope == "client" else "client"
    await database[f"{other_scope}_sessions"].insert_one({**sample, "_id": "other-scope"})
    before = await first.get(prefix + "/sessions")
    assert before.json() == {"other_active_sessions": 2}
    assert before.headers["cache-control"] == "no-store"
    assert identity["email"] not in before.text and sample["_id"] not in before.text
    response = await first.post(
        prefix + "/sessions/revoke-others", headers=headers[0], json={"id": str(uuid4())}
    )
    assert response.json() == {"revoked_count": 2}
    assert (await first.get(prefix + "/session")).status_code == 200
    assert (await second.get(prefix + "/session")).status_code == 401
    assert (await third.get(prefix + "/session")).status_code == 401
    assert (await first.get(prefix + "/sessions")).json() == {"other_active_sessions": 0}
    assert (await sessions.find_one({"_id": "another-account"}))["revoked_at"] is None
    assert (await database[f"{other_scope}_sessions"].find_one({}))["revoked_at"] is None
    # Restarted application sees the persisted withdrawal and current session.
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies=first.cookies,
    ) as restarted:
        assert (await restarted.get(prefix + "/sessions")).json() == {"other_active_sessions": 0}


async def test_simultaneous_retry_and_later_login_preservation(setup):
    scope, identity, prefix, clients, headers = setup
    body = {"id": str(uuid4())}
    responses = await asyncio.gather(
        *[
            clients[0].post(prefix + "/sessions/revoke-others", headers=headers[0], json=body)
            for _ in range(4)
        ]
    )
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json() == {"revoked_count": 2} for response in responses)
    assert await get_database().session_commands.count_documents({}) == 1
    signed_in = await clients[1].post(
        prefix + "/login",
        headers={"Origin": ORIGIN},
        json={"email": identity["email"], "password": PASSWORD},
    )
    assert signed_in.status_code == 200
    replay = await clients[0].post(
        prefix + "/sessions/revoke-others", headers=headers[0], json=body
    )
    assert replay.json() == responses[0].json()
    assert (await clients[1].get(prefix + "/session")).status_code == 200
    fresh = await clients[0].post(
        prefix + "/sessions/revoke-others", headers=headers[0], json={"id": str(uuid4())}
    )
    assert fresh.json() == {"revoked_count": 1}


async def test_two_sessions_cannot_both_withdraw_each_other(setup):
    scope, identity, prefix, clients, headers = setup
    responses = await asyncio.gather(
        *[
            clients[index].post(
                prefix + "/sessions/revoke-others",
                headers=headers[index],
                json={"id": str(uuid4())},
            )
            for index in range(2)
        ]
    )
    assert sorted(response.status_code for response in responses) == [200, 401]
    assert await get_database()[f"{scope}_sessions"].count_documents({"revoked_at": None}) == 1


async def test_csrf_input_and_scope_boundaries(setup, client):
    scope, identity, prefix, clients, headers = setup
    path = prefix + "/sessions/revoke-others"
    for invalid_headers in (
        {},
        {"Origin": ORIGIN},
        {**headers[0], "Origin": "https://evil.example"},
    ):
        assert (
            await clients[0].post(path, headers=invalid_headers, json={"id": str(uuid4())})
        ).status_code == 403
    for body in ({}, {"id": "invalid"}, {"id": str(uuid4()), "identity_id": "other"}):
        assert (await clients[0].post(path, headers=headers[0], json=body)).status_code == 422
    assert (await client.get(prefix + "/sessions")).status_code == 401
    opposite = "/api/auth/sessions" if scope == "client" else "/api/auth/client/sessions"
    assert (await clients[0].get(opposite)).status_code == 401
    assert (
        await clients[0].post(
            opposite + "/revoke-others", headers=headers[0], json={"id": str(uuid4())}
        )
    ).status_code == 401
    assert await get_database().session_commands.count_documents({}) == 0


@pytest.mark.parametrize("change", ["logout", "reset", "disable", "expire"])
async def test_invalidation_between_dependency_and_transaction(setup, monkeypatch, change):
    scope, identity, prefix, clients, headers = setup
    database = get_database()
    original = account_sessions.transaction
    module = client_auth if scope == "client" else auth
    current_id = auth.digest(clients[0].cookies[module.cookie_name()])

    async def invalidate(database, callback):
        if change in {"logout", "expire"}:
            update = (
                {"revoked_at": auth.now()}
                if change == "logout"
                else {"expires_at": auth.now() - timedelta(seconds=1)}
            )
            await database[f"{scope}_sessions"].update_one({"_id": current_id}, {"$set": update})
        else:
            update = {"enabled": False} if change == "disable" else {"auth_version": str(uuid4())}
            await database[f"{scope}_identities"].update_one(
                {"_id": identity["_id"]}, {"$set": update}
            )
        return await original(database, callback)

    monkeypatch.setattr(account_sessions, "transaction", invalidate)
    result = await clients[0].post(
        prefix + "/sessions/revoke-others", headers=headers[0], json={"id": str(uuid4())}
    )
    assert result.status_code == 401
    assert await database.session_commands.count_documents({}) == 0
    assert (
        await database[f"{scope}_sessions"].count_documents(
            {"_id": {"$ne": current_id}, "revoked_at": None}
        )
        == 2
    )


async def test_receipt_failure_rolls_back_revocation(setup, monkeypatch):
    scope, identity, prefix, clients, headers = setup
    database = get_database()
    original = type(database.session_commands).insert_one

    async def unavailable(collection, *args, **kwargs):
        if collection.name == "session_commands":
            raise ServerSelectionTimeoutError("private-provider-detail")
        return await original(collection, *args, **kwargs)

    monkeypatch.setattr(type(database.session_commands), "insert_one", unavailable)
    result = await clients[0].post(
        prefix + "/sessions/revoke-others", headers=headers[0], json={"id": str(uuid4())}
    )
    assert result.status_code == 503 and "private-provider-detail" not in result.text
    assert await database[f"{scope}_sessions"].count_documents({"revoked_at": None}) == 3
    assert await database.session_commands.count_documents({}) == 0
