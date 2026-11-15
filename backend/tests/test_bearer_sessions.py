"""Staff bearer sessions beside cookie sessions, through the ASGI handlers and persistence."""

from datetime import timedelta
from uuid import uuid4

import pytest

import auth
from db import get_database
from staff import change_staff
from tests.test_auth import EMAIL, ORIGIN, PASSWORD, login

TOKEN_PATH = "/api/auth/token"


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def staff():
    await change_staff("provision", EMAIL, "Test Staff", PASSWORD)


async def token_login(client, password=PASSWORD, **kwargs):
    return await client.post(TOKEN_PATH, json={"email": EMAIL, "password": password}, **kwargs)


async def issue(client):
    response = await token_login(client)
    assert response.status_code == 200
    return response.json()["token"]


async def test_staff_token_login_returns_token_and_no_cookie(client, staff):
    response = await token_login(client)
    assert response.status_code == 200
    assert "set-cookie" not in response.headers
    body = response.json()
    token = body["token"]
    assert len(token) >= 32
    assert body["expires_in_seconds"] == 28800
    assert body["identity"]["email"] == EMAIL
    session = await get_database().staff_sessions.find_one({"_id": auth.digest(token)})
    assert session["transport"] == "bearer"
    assert token not in str(session)
    assert response.headers["cache-control"] == "no-store"


async def test_staff_token_login_needs_no_origin(client, staff):
    response = await token_login(client)
    assert "origin" not in response.request.headers
    assert response.status_code == 200


async def test_bearer_reads_and_writes_without_origin_or_csrf(client, staff):
    token = await issue(client)
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 200
    session = await client.get("/api/auth/session", headers=bearer(token))
    assert session.status_code == 200 and session.json()["csrf_token"] is None
    logout = await client.post("/api/auth/logout", headers=bearer(token))
    assert logout.status_code == 204
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 401


async def test_bearer_token_refused_as_cookie(client, staff):
    token = await issue(client)
    client.cookies["studio_session"] = token
    assert (await client.get("/api/studio/home")).status_code == 401


async def test_cookie_token_refused_as_bearer(client, staff):
    assert (await login(client)).status_code == 200
    token = client.cookies["studio_session"]
    client.cookies.clear()
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 401


async def test_both_credentials_refused(client, staff):
    token = await issue(client)
    assert (await login(client)).status_code == 200
    assert (await client.get("/api/studio/home")).status_code == 200
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 401


@pytest.mark.parametrize("change", ["expired", "revoked", "reset"])
async def test_bearer_expiry_revocation_and_auth_version(client, staff, change):
    token = await issue(client)
    sessions = get_database().staff_sessions
    if change == "expired":
        await sessions.update_one(
            {"_id": auth.digest(token)},
            {"$set": {"expires_at": auth.now() - timedelta(seconds=1)}},
        )
    elif change == "revoked":
        await sessions.update_one({"_id": auth.digest(token)}, {"$set": {"revoked_at": auth.now()}})
    else:
        await change_staff("reset", EMAIL, None, "another-long-password")
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 401


async def test_staff_token_cannot_reach_client_routes(client, staff):
    token = await issue(client)
    response = await client.get("/api/auth/client/session", headers=bearer(token))
    assert response.status_code == 401


async def test_token_login_throttled(client, staff):
    for _ in range(5):
        assert (await token_login(client, password="incorrect")).status_code == 401
    response = await token_login(client, password="incorrect")
    assert response.status_code == 429
    assert response.json()["detail"] == "Too many sign-in attempts. Please try again later."
    assert "retry-after" in response.headers


@pytest.mark.parametrize(
    "header", ["Basic abc", "Bearer", "Bearer ", "Bearer " + "x" * 129, "Token abc"]
)
async def test_malformed_authorization_headers(client, staff, header):
    response = await client.get("/api/studio/home", headers={"Authorization": header})
    assert response.status_code == 401


async def test_scheme_is_case_insensitive(client, staff):
    token = await issue(client)
    response = await client.get("/api/studio/home", headers={"Authorization": f"bearer {token}"})
    assert response.status_code == 200


async def test_cookie_writes_still_need_origin_and_csrf(client, staff):
    csrf = (await login(client)).json()["csrf_token"]
    assert (await client.post("/api/auth/logout", headers={"Origin": ORIGIN})).status_code == 403
    assert (
        await client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    ).status_code == 403


async def test_bearer_write_through_transactional_fence(client, staff):
    token = await issue(client)
    body = {"id": str(uuid4()), "name": "Bearer photographer", "kind": "photographer"}
    response = await client.post("/api/studio/booking-resources", headers=bearer(token), json=body)
    assert response.status_code == 200 and response.json()["name"] == "Bearer photographer"
