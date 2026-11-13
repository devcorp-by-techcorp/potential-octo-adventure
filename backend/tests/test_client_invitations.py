"""Phase 3 real handlers/replica-set transactions: ownership, races and recovery."""

import asyncio
import json
import os
import platform
import statistics
import time
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo.errors import ServerSelectionTimeoutError

import auth
import client_access as access
import client_auth as clients
from clients import change_client
from config import Settings
from db import get_database
from server import create_app
from staff import change_staff
from tests.test_auth import EMAIL, ORIGIN, PASSWORD, login
from tests.test_studio_enquiries import record

CLIENT_PASSWORD = "client-test-password-long"
RECIPIENT = "client@example.test"
ID = record()["_id"]
ISSUE = f"/api/studio/enquiries/{ID}/client-invitations"
ACCEPT = "/api/auth/client/invitations/accept"
INSPECT = "/api/auth/client/invitations/inspect"
SESSION = "/api/auth/client/session"
LOGIN = "/api/auth/client/login"
LOGOUT = "/api/auth/client/logout"
LIST = "/api/client/enquiries"
DETAIL = LIST + "/" + ID


@pytest.fixture
async def setup(client):
    database = get_database()
    hello = await database.client.admin.command("hello")
    assert hello.get("setName"), "Phase 3 verification requires real MongoDB replica-set fixtures"
    await change_staff("provision", EMAIL, "Test Staff", PASSWORD)
    response = await login(client)
    await database.booking_requests.insert_one(
        record(
            email=" Client@Example.Test ",
            studio_note="private-studio-secret",
            studio_status="archived",
            studio_revision=3,
            studio_updated_by="private-staff-id",
            future_private_field="future-secret",
        )
    )
    return {"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}


async def issue(client, setup, path=ISSUE):
    response = await client.post(path, headers=setup, json={})
    assert response.status_code == 200, response.text
    item = response.json()
    return item, item["link"].split("#")[1]


async def accept(client, token, **extra):
    return await client.post(
        ACCEPT,
        headers={"Origin": ORIGIN},
        json={"token": token, "password": CLIENT_PASSWORD, **extra},
    )


async def enrolled(client, setup):
    item, token = await issue(client, setup)
    result = await accept(client, token)
    assert result.status_code == 200, result.text
    return item, token, {"Origin": ORIGIN, "X-CSRF-Token": result.json()["csrf_token"]}


async def test_lifecycle_hashes_privacy_persistence_and_scope(client, setup):
    database = get_database()
    original = await database.booking_requests.find_one({})
    item, token = await issue(client, setup)
    assert len(token) == 43 and item["link"] == ORIGIN + "/client/accept#" + token
    stored = await database.client_invitations.find_one({})
    assert stored["email"] == RECIPIENT and stored["token_hash"] == auth.digest(token)
    assert token not in str(stored)
    assert (stored["expires_at"] - stored["created_at"]).total_seconds() == 86400
    status = await client.get(ISSUE)
    assert token not in status.text and "token_hash" not in status.text
    assert status.json()["items"][0]["status"] == "pending"
    assert (await client.get(SESSION)).status_code == 401  # staff cookie only
    response = await accept(client, token)
    assert response.status_code == 200 and response.json()["recovered"] is False
    assert response.headers["cache-control"] == "no-store"
    identity = await database.client_identities.find_one({})
    assert identity["email"] == RECIPIENT and identity["password_hash"].startswith("$argon2id$")
    assert auth.verify_password(identity["password_hash"], CLIENT_PASSWORD)
    raw = client.cookies[clients.cookie_name()]
    session = await database.client_sessions.find_one({"_id": auth.digest(raw)})
    assert session["scope"] == "client" and raw not in str(session)
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert (await client.get(ISSUE)).json()["items"][0]["status"] == "accepted"
    detail = await client.get(DETAIL)
    assert set(detail.json()) == {"id", *access.CLIENT_FIELDS}
    assert detail.json()["reference"] == original["reference"]
    assert detail.json()["state"] == "awaiting_studio_confirmation"
    assert "private-studio-secret" not in detail.text and '"studio_' not in detail.text
    assert "payload_hash" not in detail.text and "future-secret" not in detail.text
    assert detail.headers["cache-control"] == "no-store"
    assert (await client.get(LIST)).json()["items"][0] == detail.json()
    assert await database.booking_requests.find_one({}) == original
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={clients.cookie_name(): raw},
    ) as another:
        assert (await another.get(DETAIL)).json() == detail.json()
        assert (await another.get("/api/studio/enquiries")).status_code == 401
        assert (
            await another.patch(
                "/api/studio/enquiries/" + ID,
                json={"expected_revision": 3, "studio_note": "attack"},
            )
        ).status_code == 401
        assert (await another.get("/api/auth/session")).status_code == 401
    # Cookie substitution cannot bridge scopes, even with a raw known session token.
    for cookie, value, endpoint in [
        ("client_session", client.cookies["studio_session"], SESSION),
        ("studio_session", raw, "/api/auth/session"),
    ]:
        async with AsyncClient(
            transport=ASGITransport(app=create_app()),
            base_url="http://testserver",
            cookies={cookie: value},
        ) as other:
            assert (await other.get(endpoint)).status_code == 401


@pytest.mark.parametrize("kind", ["absent", "expired", "revoked", "reset", "disabled", "role"])
async def test_staff_denial_all_invitation_operations(client, setup, kind, monkeypatch):
    database = get_database()
    item, token = await issue(client, setup)
    if kind == "absent":
        client.cookies.clear()
    elif kind == "expired":
        future = auth.now() + timedelta(days=1)
        monkeypatch.setattr(auth, "now", lambda: future)
    elif kind == "revoked":
        await database.staff_sessions.update_many({}, {"$set": {"revoked_at": auth.now()}})
    elif kind in {"reset", "disabled"}:
        await change_staff("disable" if kind == "disabled" else "reset", EMAIL, password=PASSWORD)
    else:
        await database.staff_identities.update_many({}, {"$set": {"role": "client"}})
    before = await database.client_invitations.find_one({})
    for method, path in [
        ("GET", ISSUE),
        ("POST", ISSUE),
        ("POST", "/api/studio/client-invitations/" + item["id"] + "/revoke"),
    ]:
        result = await client.request(
            method, path, headers=setup, **({"json": {}} if method == "POST" else {})
        )
        assert result.status_code == (403 if kind == "role" else 401)
        assert token not in result.text and result.headers["cache-control"] == "no-store"
    assert await database.client_invitations.find_one({}) == before


@pytest.mark.parametrize("kind", ["origin", "missing-origin", "csrf", "missing-csrf"])
async def test_staff_write_verification_no_writes(client, setup, kind):
    database = get_database()
    item, _ = await issue(client, setup)
    headers = dict(setup)
    key = "Origin" if "origin" in kind else "X-CSRF-Token"
    if kind.startswith("missing"):
        headers.pop(key)
    else:
        headers[key] = "https://attacker.example"
    before = await database.client_invitations.find_one({})
    for path in (ISSUE, "/api/studio/client-invitations/" + item["id"] + "/revoke"):
        assert (await client.post(path, headers=headers, json={})).status_code == 403
    assert await database.client_invitations.find_one({}) == before


@pytest.mark.parametrize("field", ["email", "role", "client_id", "enquiry_id", "owner", "access"])
async def test_injected_input_is_private_and_cannot_grant(client, setup, field, caplog):
    database = get_database()
    secret = "private-injected-credential"
    response = await client.post(ISSUE, headers=setup, json={field: secret})
    assert response.status_code == 422 and secret not in response.text
    assert await database.client_invitations.count_documents({}) == 0
    _, token = await issue(client, setup)
    for path, body in [
        (ACCEPT, {"token": token, "password": CLIENT_PASSWORD, field: secret}),
        (INSPECT, {"token": token, field: secret}),
        (LOGIN, {"email": RECIPIENT, "password": CLIENT_PASSWORD, field: secret}),
    ]:
        result = await client.post(path, headers={"Origin": ORIGIN}, json=body)
        assert result.status_code == (401 if path == LOGIN and field == "email" else 422)
        assert secret not in result.text
        assert result.headers["cache-control"] == "no-store"
    assert secret not in caplog.text and CLIENT_PASSWORD not in caplog.text
    assert await database.client_identities.count_documents({}) == 0
    assert await database.client_access.count_documents({}) == 0


@pytest.mark.parametrize("kind", ["invalid", "expired", "revoked", "replaced"])
async def test_unusable_invites_zero_grants(client, setup, kind, monkeypatch):
    database = get_database()
    item, token = await issue(client, setup)
    if kind == "invalid":
        token = "x" * 43
    elif kind == "expired":
        future = auth.now() + timedelta(days=2)
        monkeypatch.setattr(access, "now", lambda: future)
    elif kind == "revoked":
        response = await client.post(
            "/api/studio/client-invitations/" + item["id"] + "/revoke", headers=setup, json={}
        )
        assert response.json()["status"] == "revoked"
    else:
        new, new_token = await issue(client, setup)
        assert new_token != token and new["id"] != item["id"]
        assert (await client.get(ISSUE)).json()["items"][1]["status"] == "revoked"
    result = await accept(client, token)
    assert result.status_code in {404, 409}
    assert await database.client_identities.count_documents({}) == 0
    assert await database.client_access.count_documents({}) == 0


async def test_existing_matching_account_never_overwrites_password(client, setup):
    database = get_database()
    _, _, headers = await enrolled(client, setup)
    identity = await database.client_identities.find_one({})
    second = record(2, email=RECIPIENT)
    await database.booking_requests.insert_one(second)
    _, token = await issue(
        client, setup, "/api/studio/enquiries/" + second["_id"] + "/client-invitations"
    )
    assert (await client.post(INSPECT, headers={"Origin": ORIGIN}, json={"token": token})).json()[
        "existing_account"
    ]
    # Neither password enrollment nor staff login substitutes for matching client auth.
    raw = client.cookies[clients.cookie_name()]
    client.cookies.delete(clients.cookie_name())
    assert (await accept(client, token)).status_code == 409
    client.cookies.set(clients.cookie_name(), raw)
    assert (
        await client.post(
            ACCEPT, headers=headers, json={"token": token, "password": "new-password-forced"}
        )
    ).status_code == 422
    assert (
        await client.post(ACCEPT, headers={"Origin": ORIGIN}, json={"token": token})
    ).status_code == 403
    result = await client.post(ACCEPT, headers=headers, json={"token": token})
    assert result.status_code == 200
    assert (await database.client_identities.find_one({}))["password_hash"] == identity[
        "password_hash"
    ]
    assert await database.client_identities.count_documents({}) == 1
    assert await database.client_access.count_documents({}) == 2
    assert {x["id"] for x in (await client.get(LIST)).json()["items"]} == {ID, second["_id"]}


async def test_two_clients_explicit_enquiry_isolation_and_no_email_auto_grant(client, setup):
    database = get_database()
    _, _, _ = await enrolled(client, setup)
    raw = client.cookies[clients.cookie_name()]
    second = record(2, email="second@example.test", name="Second Client")
    same_email = record(3, email=RECIPIENT)
    await database.booking_requests.insert_many([second, same_email])
    assert len((await client.get(LIST)).json()["items"]) == 1
    assert (await client.get(LIST + "/" + same_email["_id"])).status_code == 404
    client.cookies.delete(clients.cookie_name())
    _, token = await issue(
        client, setup, "/api/studio/enquiries/" + second["_id"] + "/client-invitations"
    )
    response = await accept(client, token)
    assert response.status_code == 200
    assert (
        await client.get(
            DETAIL, headers={"X-Client-Id": response.json()["identity"]["id"], "X-Role": "staff"}
        )
    ).status_code == 404
    assert [x["id"] for x in (await client.get(LIST)).json()["items"]] == [second["_id"]]
    new_header = {"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}
    _, first_token = await issue(client, setup)
    assert (
        await client.post(ACCEPT, headers=new_header, json={"token": first_token})
    ).status_code == 409
    client.cookies.set(clients.cookie_name(), raw)
    assert (await client.get(LIST + "/" + second["_id"])).status_code == 404
    assert (await client.get(DETAIL)).status_code == 200


@pytest.mark.parametrize(
    "kind", ["absent", "expired", "revoked", "reset", "disabled", "role", "scope", "deleted"]
)
async def test_current_client_authorization_every_request(client, setup, kind, monkeypatch):
    _, _, headers = await enrolled(client, setup)
    database = get_database()
    if kind == "absent":
        client.cookies.delete(clients.cookie_name())
    elif kind == "expired":
        future = auth.now() + timedelta(days=1)
        monkeypatch.setattr(clients, "now", lambda: future)
    elif kind == "revoked":
        await database.client_sessions.update_many({}, {"$set": {"revoked_at": auth.now()}})
    elif kind in {"reset", "disabled"}:
        await change_client(
            "disable" if kind == "disabled" else "reset", RECIPIENT, CLIENT_PASSWORD
        )
    elif kind == "deleted":
        await database.client_identities.delete_many({})
    elif kind == "scope":
        await database.client_sessions.update_many({}, {"$set": {"scope": "staff"}})
    else:
        await database.client_identities.update_many({}, {"$set": {"role": "staff"}})
    for path in (SESSION, LIST, DETAIL, LOGOUT):
        response = await (
            client.post(path, headers=headers, json={}) if path == LOGOUT else client.get(path)
        )
        assert response.status_code == 401
        assert response.headers["cache-control"] == "no-store"
        assert RECIPIENT not in response.text and "private" not in response.text


async def test_login_logout_operator_recovery_and_shared_throttle(client, setup, monkeypatch):
    _, _, headers = await enrolled(client, setup)
    database = get_database()
    token = client.cookies[clients.cookie_name()]
    assert (await client.post(LOGOUT, json={})).status_code == 403
    assert (await client.post(LOGOUT, headers=headers, json={})).status_code == 204
    assert (await client.get(SESSION)).status_code == 401
    client.cookies.set(clients.cookie_name(), token)
    assert (await client.get(SESSION)).status_code == 401
    client.cookies.clear()
    for _ in range(4):
        result = await client.post(
            LOGIN,
            headers={"Origin": ORIGIN},
            json={"email": " CLIENT@EXAMPLE.TEST ", "password": "wrong"},
        )
        assert result.status_code == 401
    result = await client.post(
        LOGIN, headers={"Origin": ORIGIN}, json={"email": RECIPIENT, "password": CLIENT_PASSWORD}
    )
    assert result.status_code == 429 and int(result.headers["retry-after"]) > 0
    stored = await database.client_login_limits.find_one({})
    assert RECIPIENT not in str(stored)
    future = auth.now() + timedelta(seconds=901)
    monkeypatch.setattr(auth, "now", lambda: future)
    assert (
        await client.post(
            LOGIN,
            headers={"Origin": ORIGIN},
            json={"email": RECIPIENT, "password": CLIENT_PASSWORD},
        )
    ).status_code == 200
    await change_client("reset", RECIPIENT, "replacement-password-long")
    assert (await client.get(SESSION)).status_code == 401
    result = await client.post(
        LOGIN,
        headers={"Origin": ORIGIN},
        json={"email": RECIPIENT, "password": "replacement-password-long"},
    )
    assert result.status_code == 200
    await change_client("disable", RECIPIENT)
    await change_client("reset", RECIPIENT, CLIENT_PASSWORD)
    assert not (await database.client_identities.find_one({}))["enabled"]
    assert (
        await client.post(
            LOGIN,
            headers={"Origin": ORIGIN},
            json={"email": RECIPIENT, "password": CLIENT_PASSWORD},
        )
    ).status_code == 401


@pytest.mark.parametrize("path", [LOGIN, ACCEPT, INSPECT])
async def test_client_origin_denial_zero_writes(client, setup, path):
    _, token = await issue(client, setup)
    body = {"email": RECIPIENT, "password": CLIENT_PASSWORD} if path == LOGIN else {"token": token}
    for headers in ({}, {"Origin": "https://evil.example"}):
        assert (await client.post(path, headers=headers, json=body)).status_code == 403
    assert await get_database().client_identities.count_documents({}) == 0
    assert await get_database().client_sessions.count_documents({}) == 0


async def test_concurrent_single_acceptance_and_no_duplicate_accounts_grants(client, setup):
    database = get_database()
    _, token = await issue(client, setup)

    async def attempt():
        async with AsyncClient(
            transport=ASGITransport(app=create_app()), base_url="http://testserver"
        ) as other:
            return await accept(other, token)

    results = await asyncio.gather(*[attempt() for _ in range(4)])
    assert sorted(x.status_code for x in results) == [200, 409, 409, 409]
    assert await database.client_identities.count_documents({}) == 1
    assert await database.client_access.count_documents({}) == 1
    assert await database.client_sessions.count_documents({}) == 1
    assert (await database.client_invitations.find_one({}))["status"] == "accepted"


@pytest.mark.parametrize("race", ["revoke", "replacement", "parallel-issue"])
async def test_atomic_lifecycle_races(client, setup, race):
    database = get_database()
    item, token = await issue(client, setup)
    if race == "parallel-issue":
        results = await asyncio.gather(
            *[client.post(ISSUE, headers=setup, json={}) for _ in range(4)]
        )
        assert all(r.status_code == 200 for r in results)
        assert await database.client_invitations.count_documents({"status": "pending"}) == 1
        return

    async def mutate():
        if race == "revoke":
            return await client.post(
                "/api/studio/client-invitations/" + item["id"] + "/revoke", headers=setup, json={}
            )
        return await client.post(ISSUE, headers=setup, json={})

    accepted, mutation = await asyncio.gather(accept(client, token), mutate())
    saved = await database.client_invitations.find_one({"_id": item["id"]})
    if accepted.status_code == 200:
        assert saved["status"] == "accepted"
        assert mutation.status_code == (409 if race == "revoke" else 200)
        assert await database.client_access.count_documents({}) == 1
    else:
        assert accepted.status_code == 409 and saved["status"] == "revoked"
        assert mutation.status_code == 200
        assert await database.client_identities.count_documents({}) == 0
        assert await database.client_access.count_documents({}) == 0
    # A committed revocation/replacement always denies every later acceptance.
    client.cookies.delete(clients.cookie_name())
    assert (await accept(client, token)).status_code == 409


async def test_transaction_rollback_and_uncertain_response_recovery(client, setup, monkeypatch):
    database = get_database()
    _, token = await issue(client, setup)
    real_insert = clients.insert_session

    async def fail_insert(*args, **kwargs):
        raise ServerSelectionTimeoutError("private service credential")

    monkeypatch.setattr(clients, "insert_session", fail_insert)
    failed = await accept(client, token)
    assert failed.status_code == 503 and "private" not in failed.text
    assert await database.client_identities.count_documents({}) == 0
    assert await database.client_access.count_documents({}) == 0
    assert (await database.client_invitations.find_one({}))["status"] == "pending"
    monkeypatch.setattr(clients, "insert_session", real_insert)
    real_transaction = access.transaction

    async def lost_response(*args):
        await real_transaction(*args)
        raise ServerSelectionTimeoutError("private post-commit failure")

    monkeypatch.setattr(access, "transaction", lost_response)
    failed = await accept(client, token)
    assert failed.status_code == 503 and clients.cookie_name() not in client.cookies
    assert await database.client_identities.count_documents({}) == 1
    assert await database.client_access.count_documents({}) == 1
    monkeypatch.setattr(access, "transaction", real_transaction)
    assert (await accept(client, token)).status_code == 409
    recovered = await accept(client, token, recover=True)
    assert recovered.status_code == 200 and recovered.json()["recovered"] is True
    assert (await client.get(DETAIL)).status_code == 200
    assert await database.client_identities.count_documents({}) == 1
    assert await database.client_access.count_documents({}) == 1
    client.cookies.delete(clients.cookie_name())
    assert (
        await client.post(
            ACCEPT,
            headers={"Origin": ORIGIN},
            json={"token": token, "password": "wrong-password-long", "recover": True},
        )
    ).status_code == 401


@pytest.mark.parametrize(
    "operation",
    [
        "issue",
        "status",
        "revoke",
        "inspect",
        "accept",
        "login",
        "session",
        "logout",
        "list",
        "detail",
    ],
)
@pytest.mark.parametrize("failure", ["connection", "operation"])
async def test_database_failures_sanitized_and_fail_closed(
    client, setup, operation, failure, monkeypatch, caplog
):
    item, token, headers = await enrolled(client, setup)
    # A fresh pending link for acceptance failures; existing client remains authenticated.
    if operation in {"accept", "inspect"}:
        item, token = await issue(client, setup)
    database = get_database()
    before = await database.client_access.count_documents({})

    def fail(*args, **kwargs):
        raise ServerSelectionTimeoutError("private-db-password-token")

    async def fail_async(*args, **kwargs):
        fail()

    if failure == "connection":
        monkeypatch.setattr(access, "get_database", fail)
        monkeypatch.setattr(clients, "get_database", fail)
    else:
        # Inject into the exact new operation, after successful auth where relevant.
        collection, method = {
            "issue": ("client_invitation_heads", "find_one_and_update"),
            "status": ("client_invitations", "find"),
            "revoke": ("client_invitations", "find_one_and_update"),
            "inspect": ("client_invitations", "find_one"),
            "accept": ("client_invitations", "update_one"),
            "login": ("client_sessions", "insert_one"),
            "session": ("client_sessions", "find_one"),
            "logout": ("client_sessions", "update_one"),
            "list": ("client_access", "find"),
            "detail": ("client_access", "find_one"),
        }[operation]
        original = getattr(AsyncIOMotorCollection, method)

        async def injected_async(self, *args, **kwargs):
            if self.name == collection:
                fail()
            return await original(self, *args, **kwargs)

        def injected_sync(self, *args, **kwargs):
            if self.name == collection:
                fail()
            return original(self, *args, **kwargs)

        monkeypatch.setattr(
            AsyncIOMotorCollection, method, injected_sync if method == "find" else injected_async
        )
    method, path, body, request_headers = {
        "issue": ("POST", ISSUE, {}, setup),
        "status": ("GET", ISSUE, None, {}),
        "revoke": ("POST", "/api/studio/client-invitations/" + item["id"] + "/revoke", {}, setup),
        "inspect": ("POST", INSPECT, {"token": token}, {"Origin": ORIGIN}),
        "accept": ("POST", ACCEPT, {"token": token}, headers),
        "login": (
            "POST",
            LOGIN,
            {"email": RECIPIENT, "password": CLIENT_PASSWORD},
            {"Origin": ORIGIN},
        ),
        "session": ("GET", SESSION, None, {}),
        "logout": ("POST", LOGOUT, {}, headers),
        "list": ("GET", LIST, None, {}),
        "detail": ("GET", DETAIL, None, {}),
    }[operation]
    result = await client.request(
        method, path, headers=request_headers, **({"json": body} if body is not None else {})
    )
    assert result.status_code == 503, result.text
    assert "private-db-password-token" not in result.text + caplog.text
    assert result.headers["cache-control"] == "no-store"
    # Inspect real persistence after restoring injected operation.
    monkeypatch.undo()
    assert await database.client_access.count_documents({}) == before


@pytest.mark.parametrize("seconds", [0, 59, 604801, "not-a-number"])
def test_invitation_lifetime_validated(seconds):
    with pytest.raises(ValueError):
        Settings(client_invitation_seconds=seconds)


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "cursor=bad", "cursor=" + "x" * 513])
async def test_client_list_bounds_and_private_errors(client, setup, query):
    await enrolled(client, setup)
    result = await client.get(LIST + "?" + query)
    assert result.status_code == 422 and result.headers["cache-control"] == "no-store"


async def test_keyset_indexes_and_local_latency(client, setup):
    database = get_database()
    _, token, _ = await enrolled(client, setup)
    identity = await database.client_identities.find_one({})
    # Fixture-only grants make a representative 1,000-enquiry client dataset.
    documents = [record(i, email=RECIPIENT) for i in range(2, 1001)]
    await database.booking_requests.insert_many(documents)
    await database.client_access.insert_many(
        [
            {
                "_id": d["_id"],
                "enquiry_id": d["_id"],
                "client_id": identity["_id"],
                "created_at": d["created_at"],
            }
            for d in documents
        ]
    )
    visited, cursor, first_cursor = [], None, None
    while True:
        page = (
            await client.get(LIST, params={"limit": 100, **({"cursor": cursor} if cursor else {})})
        ).json()
        visited.extend(x["id"] for x in page["items"])
        assert len(page["items"]) <= 100
        if first_cursor is None:
            first_cursor = page["next_cursor"]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert len(visited) == len(set(visited)) == 1000
    grants = (
        await database.client_access.find({})
        .sort([("created_at", -1), ("_id", -1)])
        .limit(1001)
        .to_list(length=1001)
    )
    assert visited == [grant["enquiry_id"] for grant in grants]
    evidence = {}
    for name, collection, query, sort in [
        ("token", "client_invitations", {"token_hash": auth.digest(token)}, None),
        ("grant", "client_access", {"client_id": identity["_id"], "enquiry_id": ID}, None),
        ("page", "client_access", {"client_id": identity["_id"]}, {"created_at": -1, "_id": -1}),
        (
            "page_cursor",
            "client_access",
            {"client_id": identity["_id"], **access.page_query(None, first_cursor)},
            {"created_at": -1, "_id": -1},
        ),
        (
            "invitation_history", "client_invitations", {"enquiry_id": ID},
            {"generation": -1},
        ),
    ]:
        bound = 26 if name == "invitation_history" else 101 if sort else 1
        command = {"find": collection, "filter": query, "limit": bound}
        if sort:
            command["sort"] = sort
        explain = await database.command("explain", command, verbosity="executionStats")
        plan = explain["queryPlanner"]["winningPlan"]
        stages = []

        def inspect_plan(value, stages=stages):
            if isinstance(value, dict):
                if "stage" in value:
                    stages.append(value["stage"])
                for child in value.values():
                    inspect_plan(child)
            elif isinstance(value, list):
                for child in value:
                    inspect_plan(child)

        inspect_plan(plan)
        assert "IXSCAN" in stages and not {"COLLSCAN", "SORT"}.intersection(stages)
        evidence[name] = {"plan": plan, "stats": explain["executionStats"]}
    latencies = {}
    for path in (LIST, DETAIL):
        samples = []
        for _ in range(30):
            start = time.perf_counter()
            assert (await client.get(path)).status_code == 200
            samples.append((time.perf_counter() - start) * 1000)
        latencies[path] = {
            "samples": 30,
            "median_ms": statistics.median(samples),
            "p95_ms": sorted(samples)[28],
        }
    output = {
        "dataset": 1000,
        "runtime": {
            "python": platform.python_version(),
            "mongodb": (await database.client.server_info())["version"],
        },
        "explain": evidence,
        "latency": latencies,
        "method": (
            "30 warm sequential authenticated httpx ASGI handler requests; "
            "real local Motor/MongoDB replica set; perf_counter, nearest-rank p95; "
            "no production SLA"
        ),
    }
    if os.getenv("CLIENT_PERFORMANCE_OUTPUT"):
        Path(os.environ["CLIENT_PERFORMANCE_OUTPUT"]).write_text(
            json.dumps(output, default=str, indent=2)
        )


async def test_client_unique_compound_and_ttl_indexes(client, setup):
    from pymongo.errors import DuplicateKeyError

    await enrolled(client, setup)
    database = get_database()
    expected = {
        "client_identities": {"email_1": {"key": [("email", 1)], "unique": True}},
        "client_sessions": {
            "expires_at_1": {"key": [("expires_at", 1)], "expireAfterSeconds": 0},
            "identity_id_1": {"key": [("identity_id", 1)]},
        },
        "client_login_limits": {
            "expires_at_1": {"key": [("expires_at", 1)], "expireAfterSeconds": 0},
        },
        "client_invitations": {
            "token_hash_1": {"key": [("token_hash", 1)], "unique": True},
            "enquiry_id_1_generation_-1": {
                "key": [("enquiry_id", 1), ("generation", -1)], "unique": True,
            },
            "cleanup_at_1": {"key": [("cleanup_at", 1)], "expireAfterSeconds": 0},
        },
        "client_access": {
            "client_id_1_enquiry_id_1": {
                "key": [("client_id", 1), ("enquiry_id", 1)], "unique": True,
            },
            "client_access_page": {
                "key": [("client_id", 1), ("created_at", -1), ("_id", -1)],
            },
        },
    }
    for collection, indexes in expected.items():
        actual = await database[collection].index_information()
        for name, options in indexes.items():
            assert all(actual[name][key] == value for key, value in options.items())
    for collection in ("client_identities", "client_access", "client_invitations"):
        original = await database[collection].find_one({})
        with pytest.raises(DuplicateKeyError):
            await database[collection].insert_one({**original, "_id": str(uuid4())})


@pytest.mark.parametrize("kind", ["expired", "missing-grant", "reset", "disabled"])
async def test_completed_enrollment_recovery_fails_closed(client, setup, kind):
    database = get_database()
    item, token, _ = await enrolled(client, setup)
    client.cookies.delete(clients.cookie_name())
    if kind == "expired":
        await database.client_invitations.update_one(
            {"_id": item["id"]}, {"$set": {"expires_at": auth.now() - timedelta(seconds=1)}}
        )
    elif kind == "missing-grant":
        await database.client_access.delete_many({})
    else:
        await change_client(
            "disable" if kind == "disabled" else "reset", RECIPIENT, "reset-recovery-password"
        )
    before = await database.client_sessions.count_documents({})
    response = await accept(client, token, recover=True)
    assert response.status_code == (409 if kind == "missing-grant" else 401)
    assert response.headers["cache-control"] == "no-store"
    assert clients.cookie_name() not in client.cookies
    assert await database.client_sessions.count_documents({}) == before
    assert await database.client_identities.count_documents({}) == 1
    assert await database.client_access.count_documents({}) == (0 if kind == "missing-grant" else 1)


async def test_pending_replacement_revocation_preserves_accepted_access(client, setup):
    database = get_database()
    await enrolled(client, setup)
    original = await database.client_access.find_one({})
    item, token = await issue(client, setup)
    response = await client.post(
        "/api/studio/client-invitations/" + item["id"] + "/revoke", headers=setup, json={}
    )
    assert response.status_code == 200
    assert await database.client_access.find_one({}) == original
    assert (await client.get(DETAIL)).status_code == 200
    client.cookies.delete(clients.cookie_name())
    assert (await accept(client, token)).status_code == 409


async def test_invitation_history_traversal_with_concurrent_new_issue(client, setup):
    database = get_database()
    item, _ = await issue(client, setup)
    original = await database.client_invitations.find_one({"_id": item["id"]})
    history = [
        {
            **original, "_id": str(uuid4()), "generation": generation,
            "token_hash": auth.digest(str(uuid4())), "status": "revoked",
        }
        for generation in range(2, 62)
    ]
    await database.client_invitations.insert_many(history)
    await database.client_invitation_heads.update_one(
        {"_id": ID}, {"$set": {"generation": 61}}
    )
    expected = [entry["_id"] for entry in reversed(history)] + [item["id"]]
    page = (await client.get(ISSUE)).json()
    visited = [entry["id"] for entry in page["items"]]
    assert len(visited) == 25
    cursor = page["next_cursor"]
    newest, _ = await issue(client, setup)
    while cursor:
        page = (await client.get(ISSUE, params={"cursor": cursor})).json()
        assert len(page["items"]) <= 25
        visited.extend(entry["id"] for entry in page["items"])
        cursor = page["next_cursor"]
    assert visited == expected and len(set(visited)) == 61
    assert newest["id"] not in visited
    assert (await client.get(ISSUE)).json()["items"][0]["id"] == newest["id"]


async def test_private_response_models_exclude_internal_helper_fields(client, setup, monkeypatch):
    public = access.invitation_public

    def polluted_invitation(item):
        return {
            **public(item), "token_hash": item.get("token_hash", "private-token-hash"),
            "issued_by": "private-actor",
        }

    monkeypatch.setattr(access, "invitation_public", polluted_invitation)
    item, token = await issue(client, setup)
    assert set(item) == {"id", "status", "created_at", "expires_at", "link"}
    listed = await client.get(ISSUE)
    assert "token_hash" not in listed.text and "private-actor" not in listed.text
    response = clients.session_response

    def polluted_session(*args):
        result = response(*args)
        return {
            **result, "raw_token": args[2], "password_hash": "private-hash",
            "identity": {**result["identity"], "auth_version": "private-version"},
        }

    monkeypatch.setattr(clients, "session_response", polluted_session)
    accepted = await accept(client, token)
    assert accepted.status_code == 200
    assert not {"raw_token", "password_hash"}.intersection(accepted.json())
    assert set(accepted.json()["identity"]) == {"id", "name", "email"}
    assert client.cookies[clients.cookie_name()] not in accepted.text
    client.cookies.delete(clients.cookie_name())
    signed_in = await client.post(
        LOGIN, headers={"Origin": ORIGIN}, json={"email": RECIPIENT, "password": CLIENT_PASSWORD}
    )
    assert signed_in.status_code == 200
    assert "private-hash" not in signed_in.text and "private-version" not in signed_in.text
    assert client.cookies[clients.cookie_name()] not in signed_in.text
    replacement, _ = await issue(client, setup)
    revoked = await client.post(
        "/api/studio/client-invitations/" + replacement["id"] + "/revoke", headers=setup, json={}
    )
    assert revoked.status_code == 200 and "token_hash" not in revoked.text


@pytest.mark.parametrize("mutation", ["revoke", "replacement"])
async def test_revocation_committed_before_acceptance_transition(
    client, setup, mutation, monkeypatch
):
    database = get_database()
    item, token = await issue(client, setup)
    ready, proceed = asyncio.Event(), asyncio.Event()
    original = AsyncIOMotorCollection.find_one
    paused = False

    async def snapshot(self, *args, **kwargs):
        nonlocal paused
        result = await original(self, *args, **kwargs)
        if self.name == "client_invitations" and kwargs.get("session") and not paused:
            paused = True
            ready.set()
            await proceed.wait()
        return result

    monkeypatch.setattr(AsyncIOMotorCollection, "find_one", snapshot)
    task = asyncio.create_task(accept(client, token))
    await asyncio.wait_for(ready.wait(), 10)
    path = (
        "/api/studio/client-invitations/" + item["id"] + "/revoke"
        if mutation == "revoke"
        else ISSUE
    )
    assert (await client.post(path, headers=setup, json={})).status_code == 200
    assert (await database.client_invitations.find_one({"_id": item["id"]}))["status"] == "revoked"
    proceed.set()
    assert (await asyncio.wait_for(task, 10)).status_code == 409
    assert await database.client_identities.count_documents({}) == 0
    assert await database.client_access.count_documents({}) == 0


@pytest.mark.parametrize("mutation", ["reset", "disable", "logout"])
async def test_operator_or_logout_committed_during_existing_acceptance(
    client, setup, mutation, monkeypatch
):
    database = get_database()
    _, _, headers = await enrolled(client, setup)
    second = record(2, email=RECIPIENT)
    await database.booking_requests.insert_one(second)
    _, token = await issue(
        client, setup, "/api/studio/enquiries/" + second["_id"] + "/client-invitations"
    )
    ready, proceed = asyncio.Event(), asyncio.Event()
    original = AsyncIOMotorCollection.find_one
    paused = False

    async def snapshot(self, *args, **kwargs):
        nonlocal paused
        result = await original(self, *args, **kwargs)
        if self.name == "client_identities" and kwargs.get("session") and not paused:
            paused = True
            ready.set()
            await proceed.wait()
        return result

    monkeypatch.setattr(AsyncIOMotorCollection, "find_one", snapshot)
    task = asyncio.create_task(client.post(ACCEPT, headers=headers, json={"token": token}))
    await asyncio.wait_for(ready.wait(), 10)
    if mutation == "logout":
        assert (await client.post(LOGOUT, headers=headers, json={})).status_code == 204
    else:
        await change_client(mutation, RECIPIENT, "reset-password-for-race")
    proceed.set()
    assert (await asyncio.wait_for(task, 10)).status_code == 401
    assert await database.client_access.count_documents({}) == 1
    assert (await database.client_invitations.find_one({"token_hash": auth.digest(token)}))[
        "status"
    ] == "pending"


async def test_concurrent_distinct_invitations_one_normalized_identity(client, setup):
    database = get_database()
    _, first = await issue(client, setup)
    second = record(2, email=" CLIENT@example.TEST ")
    await database.booking_requests.insert_one(second)
    _, other = await issue(
        client, setup, "/api/studio/enquiries/" + second["_id"] + "/client-invitations"
    )

    async def attempt(token):
        async with AsyncClient(
            transport=ASGITransport(app=create_app()), base_url="http://testserver"
        ) as view:
            return await accept(view, token)

    results = await asyncio.gather(attempt(first), attempt(other))
    assert sorted(r.status_code for r in results) == [200, 409]
    assert await database.client_identities.count_documents({}) == 1
    assert await database.client_access.count_documents({}) == 1
    assert await database.client_invitations.count_documents({"status": "accepted"}) == 1
    assert await database.client_invitations.count_documents({"status": "pending"}) == 1


async def test_existing_acceptance_recovery_and_repeated_grant(client, setup, monkeypatch):
    database = get_database()
    _, _, headers = await enrolled(client, setup)
    identity = await database.client_identities.find_one({})
    _, token = await issue(client, setup)
    real_transaction = access.transaction

    async def lost(*args):
        await real_transaction(*args)
        raise ServerSelectionTimeoutError("private committed outcome")

    monkeypatch.setattr(access, "transaction", lost)
    assert (await client.post(ACCEPT, headers=headers, json={"token": token})).status_code == 503
    monkeypatch.setattr(access, "transaction", real_transaction)
    assert await database.client_access.count_documents({}) == 1
    result = await client.post(ACCEPT, headers=headers, json={"token": token, "recover": True})
    assert result.status_code == 200 and result.json()["recovered"] is True
    client.cookies.delete(clients.cookie_name())
    assert (await accept(client, token, recover=True)).status_code == 401
    assert (await database.client_identities.find_one({}))["password_hash"] == identity[
        "password_hash"
    ]


@pytest.mark.parametrize(
    "collection,method",
    [
        ("client_identities", "insert_one"),
        ("client_invitations", "update_one"),
        ("client_access", "update_one"),
        ("client_sessions", "insert_one"),
    ],
)
async def test_each_durable_acceptance_failure_rolls_back(
    client, setup, monkeypatch, collection, method
):
    database = get_database()
    _, token = await issue(client, setup)
    original = getattr(AsyncIOMotorCollection, method)

    async def injected(self, *args, **kwargs):
        if self.name == collection:
            raise ServerSelectionTimeoutError("private transactional failure")
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(AsyncIOMotorCollection, method, injected)
    assert (await accept(client, token)).status_code == 503
    assert await database.client_identities.count_documents({}) == 0
    assert await database.client_access.count_documents({}) == 0
    assert await database.client_sessions.count_documents({}) == 0
    assert (await database.client_invitations.find_one({}))["status"] == "pending"


async def test_recovery_pending_never_enrolls_or_claims_completed(client, setup):
    _, token = await issue(client, setup)
    assert (await accept(client, token, recover=True)).status_code == 409
    assert await get_database().client_identities.count_documents({}) == 0
    assert await get_database().client_access.count_documents({}) == 0


async def test_shared_ip_bound_before_password_hash_and_email_key_growth(
    client, setup, monkeypatch
):
    database = get_database()
    calls = 0
    original = clients.verify_password

    def counted(*args):
        nonlocal calls
        calls += 1
        return original(*args)

    monkeypatch.setattr(clients, "verify_password", counted)
    for index in range(20):
        result = await client.post(
            LOGIN,
            headers={"Origin": ORIGIN},
            json={"email": f"missing-{index}@example.test", "password": "wrong"},
        )
        assert result.status_code == 401
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as other:
        result = await other.post(
            LOGIN,
            headers={"Origin": ORIGIN},
            json={"email": "new-missing@example.test", "password": "wrong"},
        )
    assert result.status_code == 429 and calls == 20
    assert await database.client_login_limits.count_documents({}) == 21

    def should_not_hash(*args):
        raise AssertionError("Hashing must follow IP throttling")

    monkeypatch.setattr(access, "password_hash", should_not_hash)
    assert (await accept(client, "x" * 43)).status_code == 429


async def test_production_client_cookies_and_credentialed_cors(client, setup, monkeypatch):
    from config import get_settings

    _, token = await issue(client, setup)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("AUTH_ALLOWED_ORIGINS", "https://studio.example.test")
    monkeypatch.setenv("CORS_ORIGINS", "https://studio.example.test")
    get_settings.cache_clear()
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="https://api.example.test"
    ) as production:
        result = await production.post(
            ACCEPT,
            headers={"Origin": "https://studio.example.test"},
            json={"token": token, "password": CLIENT_PASSWORD},
        )
        assert result.status_code == 200
        cookie = result.headers["set-cookie"]
        for required in ("__Host-client_session=", "Secure", "HttpOnly", "SameSite=lax", "Path=/"):
            assert required in cookie
        assert "Domain=" not in cookie
        assert result.headers["access-control-allow-credentials"] == "true"
        assert result.headers["access-control-allow-origin"] == "https://studio.example.test"
        assert (await production.get(DETAIL)).status_code == 200
        csrf = result.json()["csrf_token"]
        result = await production.post(
            LOGOUT, headers={"Origin": "https://studio.example.test", "X-CSRF-Token": csrf}, json={}
        )
        assert result.status_code == 204 and "Max-Age=0" in result.headers["set-cookie"]


async def test_fresh_motor_instance_and_repeatable_indexes_preserve_records(
    client, setup, monkeypatch
):
    from motor.motor_asyncio import AsyncIOMotorClient

    await enrolled(client, setup)
    database = get_database()
    before = await database.booking_requests.find_one({})
    await access.ensure_indexes(database)
    await access.ensure_indexes(database)
    assert await database.booking_requests.find_one({}) == before
    mongo = AsyncIOMotorClient(os.environ["TEST_MONGODB_URI"])
    try:
        monkeypatch.setattr(access, "get_database", lambda: mongo[database.name])
        monkeypatch.setattr(clients, "get_database", lambda: mongo[database.name])
        async with AsyncClient(
            transport=ASGITransport(app=create_app()),
            base_url="http://testserver",
            cookies={clients.cookie_name(): client.cookies[clients.cookie_name()]},
        ) as view:
            assert (await view.get(DETAIL)).json()["reference"] == before["reference"]
    finally:
        mongo.close()


@pytest.mark.parametrize(
    "body",
    [
        {"token": "private-token"},
        {"token": "x" * 43, "password": "short"},
        {"token": "x" * 43, "password": "x" * 1025},
        {"token": {"$ne": None}},
        {"token": "x" * 43, "recover": "true"},
        {"token": "\ud800" * 43},
        {"token": "x" * 43, "password": "\ud800" * 12},
    ],
)
async def test_malformed_secrets_do_not_echo(client, setup, body, caplog):
    result = await client.post(
        ACCEPT,
        headers={"Origin": ORIGIN, "Content-Type": "application/json"},
        content=json.dumps(body).encode(),
    )
    assert result.status_code == 422
    assert "private-token" not in result.text + caplog.text
    assert "short" not in result.text + caplog.text
    assert await get_database().client_access.count_documents({}) == 0


async def test_client_operator_cli_real_terminal_recovery(client, setup):
    import pty
    import select
    import subprocess
    import sys

    await enrolled(client, setup)
    database = get_database()
    identity = await database.client_identities.find_one({})
    environment = {
        **os.environ,
        "MONGODB_URI": os.environ["TEST_MONGODB_URI"],
        "MONGODB_DB_NAME": database.name,
        "ENVIRONMENT": "test",
    }

    def command(action, password=None):
        master, slave = pty.openpty()
        process = subprocess.Popen(
            [sys.executable, str(Path(__file__).parents[1] / "clients.py"), action, RECIPIENT],
            stdin=slave,
            stdout=slave,
            stderr=slave,
            env=environment,
            start_new_session=True,
        )
        os.close(slave)
        transcript, sent = "", 0
        deadline = time.monotonic() + 15
        try:
            while time.monotonic() < deadline:
                ready, _, _ = select.select([master], [], [], 0.1)
                if ready:
                    try:
                        chunk = os.read(master, 4096)
                    except OSError:
                        break
                    if not chunk:
                        break
                    transcript += chunk.decode()
                    if password and sent == 0 and "New password" in transcript:
                        os.write(master, (password + "\n").encode())
                        sent = 1
                    if password and sent == 1 and "Confirm password" in transcript:
                        os.write(master, (password + "\n").encode())
                        sent = 2
            assert process.wait(timeout=2) == 0
            assert not password or password not in transcript
            assert f"Client {action} completed." in transcript
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            os.close(master)

    command("reset", "new-client-cli-password")
    updated = await database.client_identities.find_one({})
    assert updated["auth_version"] != identity["auth_version"]
    assert auth.verify_password(updated["password_hash"], "new-client-cli-password")
    assert (await client.get(SESSION)).status_code == 401
    command("disable")
    assert not (await database.client_identities.find_one({}))["enabled"]


def test_operator_no_password_arguments_or_piped_input(monkeypatch, capsys):
    import sys

    import clients as operator

    monkeypatch.setattr(
        sys, "argv", ["clients.py", "reset", RECIPIENT, "private-password-argument"]
    )
    with pytest.raises(SystemExit):
        operator.main()
    assert "private-password-argument" not in capsys.readouterr().err
    monkeypatch.setattr(sys, "argv", ["clients.py", "reset", RECIPIENT])
    monkeypatch.setattr(sys.stdin, "isatty", lambda: False)
    assert operator.main() == 1
    assert "interactive terminal" in capsys.readouterr().err


@pytest.mark.parametrize("field", ["email", "password"])
async def test_client_login_malformed_unicode_sanitized(client, setup, field):
    body = {"email": RECIPIENT, "password": CLIENT_PASSWORD, field: "\ud800" * 12}
    response = await client.post(
        LOGIN,
        headers={"Origin": ORIGIN, "Content-Type": "application/json"},
        content=json.dumps(body).encode(),
    )
    assert response.status_code == 422
    assert response.headers["cache-control"] == "no-store"
    assert await get_database().client_sessions.count_documents({}) == 0


async def test_invitation_history_and_route_bounds(client, setup):
    for query in ("cursor=0", "cursor=" + "9" * 50, "cursor=private-input"):
        result = await client.get(ISSUE + "?" + query)
        assert result.status_code == 422 and "private-input" not in result.text
    for method in ("GET", "POST"):
        path = "/api/studio/enquiries/" + str(uuid4()) + "/client-invitations"
        result = await client.request(
            method, path, headers=setup, **({"json": {}} if method == "POST" else {})
        )
        assert result.status_code == 404
    assert (
        await client.post(
            "/api/auth/client/register",
            headers={"Origin": ORIGIN},
            json={"email": RECIPIENT, "password": CLIENT_PASSWORD, "role": "staff"},
        )
    ).status_code == 404
    assert await get_database().client_identities.count_documents({}) == 0
