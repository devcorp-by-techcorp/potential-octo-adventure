"""Staff bearer sessions beside cookie sessions, through the ASGI handlers and persistence."""

from datetime import timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

import auth
import client_auth
from clients import change_client
from db import get_database
from server import create_app
from staff import change_staff
from tests.test_auth import EMAIL, ORIGIN, PASSWORD, login
from tests.test_client_invitations import ACCEPT, CLIENT_PASSWORD, RECIPIENT, accept
from tests.test_client_invitations import issue as issue_invite
from tests.test_client_invitations import setup as invitation_setup  # noqa: F401
from tests.test_studio_enquiries import record

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


async def test_staff_token_cannot_reach_client_routes(client, client_account):
    staff_token = await issue(client)
    client_token = await client_issue(client)
    # The client bearer is valid for a different identity, so the refusal is about role.
    assert (await client.get(CLIENT_SESSION, headers=bearer(client_token))).status_code == 200
    assert (await client.get(CLIENT_SESSION, headers=bearer(staff_token))).status_code == 401
    assert (await client.get(CLIENT_ENQUIRIES, headers=bearer(staff_token))).status_code == 401


async def test_client_token_cannot_reach_staff_routes(client, client_account):
    token = await client_issue(client)
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 401
    assert (await client.get("/api/auth/session", headers=bearer(token))).status_code == 401


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


CLIENT_EMAIL = RECIPIENT
CLIENT_TOKEN_PATH = "/api/auth/client/token"
CLIENT_SESSION = "/api/auth/client/session"
CLIENT_ENQUIRIES = "/api/client/enquiries"


@pytest.fixture
async def client_account(client, invitation_setup):  # noqa: F811
    """A real client identity, enrolled through the invitation path (also provisions staff)."""
    _, token = await issue_invite(client, invitation_setup)
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="http://testserver"
    ) as enrolling:
        assert (await accept(enrolling, token)).status_code == 200
    client.cookies.clear()
    identity = await get_database().client_identities.find_one({"email": CLIENT_EMAIL})
    assert identity["role"] == "client"
    return identity


async def client_token_login(client, password=CLIENT_PASSWORD):
    return await client.post(CLIENT_TOKEN_PATH, json={"email": CLIENT_EMAIL, "password": password})


async def client_issue(client):
    response = await client_token_login(client)
    assert response.status_code == 200, response.text
    return response.json()["token"]


async def test_client_token_login_and_bearer_read(client, client_account):
    response = await client_token_login(client)
    assert response.status_code == 200
    assert "set-cookie" not in response.headers
    body = response.json()
    assert body["identity"] == {
        "id": client_account["_id"],
        "email": CLIENT_EMAIL,
        "name": client_account["name"],
    }
    assert body["expires_in_seconds"] == 28800
    token = body["token"]
    assert (await client.get(CLIENT_ENQUIRIES, headers=bearer(token))).status_code == 200
    session = await client.get(CLIENT_SESSION, headers=bearer(token))
    assert session.status_code == 200 and session.json()["csrf_token"] is None
    stored = await get_database().client_sessions.find_one({"_id": auth.digest(token)})
    assert stored["scope"] == "client" and stored["transport"] == "bearer"
    assert token not in str(stored)


async def test_client_token_login_throttled_and_rejects_bad_password(client, client_account):
    # Enrolment already spent part of the shared per-email budget of 5.
    statuses = [
        (await client_token_login(client, password="incorrect")).status_code for _ in range(5)
    ]
    assert statuses[0] == 401 and statuses[-1] == 429
    assert set(statuses) == {401, 429}


async def test_client_bearer_logout_without_origin_or_csrf(client, client_account):
    token = await client_issue(client)
    logout = await client.post("/api/auth/client/logout", headers=bearer(token), json={})
    assert logout.status_code == 204
    assert (await client.get(CLIENT_SESSION, headers=bearer(token))).status_code == 401


async def test_client_cross_transport_and_cross_role(client, client_account):
    token = await client_issue(client)
    client.cookies[client_auth.cookie_name()] = token
    assert (await client.get(CLIENT_SESSION)).status_code == 401
    client.cookies.clear()
    cookie_login = await client.post(
        "/api/auth/client/login",
        headers={"Origin": ORIGIN},
        json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD},
    )
    assert cookie_login.status_code == 200
    cookie_token = client.cookies[client_auth.cookie_name()]
    assert (await client.get(CLIENT_SESSION)).status_code == 200
    # Both credentials together.
    assert (await client.get(CLIENT_SESSION, headers=bearer(token))).status_code == 401
    client.cookies.clear()
    assert (await client.get(CLIENT_SESSION, headers=bearer(cookie_token))).status_code == 401
    assert (await client.get("/api/studio/home", headers=bearer(token))).status_code == 401
    assert (await client.get(CLIENT_SESSION, headers=bearer(token))).status_code == 200


@pytest.mark.parametrize("action", ["reset", "disable"])
async def test_client_bearer_invalidated_by_reset_and_disable(client, client_account, action):
    token = await client_issue(client)
    assert (await client.get(CLIENT_SESSION, headers=bearer(token))).status_code == 200
    await change_client(action, CLIENT_EMAIL, "another-long-password")
    assert (await client.get(CLIENT_SESSION, headers=bearer(token))).status_code == 401


async def test_session_counts_and_revoke_others_span_transports(client, client_account):
    cases = [
        ("/api/auth/login", TOKEN_PATH, "/api/auth", EMAIL, PASSWORD),
        (
            "/api/auth/client/login",
            CLIENT_TOKEN_PATH,
            "/api/auth/client",
            CLIENT_EMAIL,
            CLIENT_PASSWORD,
        ),
    ]
    for login_path, token_path, prefix, email, password in cases:
        client.cookies.clear()
        # Enrolment and staff set-up left earlier sessions; count only this test's.
        await get_database().client_sessions.delete_many({})
        await get_database().staff_sessions.delete_many({})
        credentials = {"email": email, "password": password}
        cookie = await client.post(login_path, headers={"Origin": ORIGIN}, json=credentials)
        assert cookie.status_code == 200
        csrf = cookie.json()["csrf_token"]
        cookie_jar = dict(client.cookies)
        client.cookies.clear()
        tokens = []
        for _ in range(2):
            issued = await client.post(token_path, json=credentials)
            assert issued.status_code == 200
            tokens.append(issued.json()["token"])
        client.cookies.update(cookie_jar)
        counts = await client.get(prefix + "/sessions", headers={"X-CSRF-Token": csrf})
        assert counts.json() == {"other_active_sessions": 2}
        client.cookies.clear()
        revoked = await client.post(
            prefix + "/sessions/revoke-others", headers=bearer(tokens[0]), json={"id": str(uuid4())}
        )
        assert revoked.status_code == 200 and revoked.json() == {"revoked_count": 2}
        session_path = prefix + "/session"
        assert (await client.get(session_path, headers=bearer(tokens[0]))).status_code == 200
        assert (await client.get(session_path, headers=bearer(tokens[1]))).status_code == 401
        client.cookies.update(cookie_jar)
        assert (await client.get(session_path)).status_code == 401


async def invite_other(client, index, email):
    """A fresh pending invitation for another enquiry, addressed to a different email."""
    await get_database().booking_requests.insert_one(
        record(index, email=email, name="Invited " + str(index))
    )
    login_response = await login(client)
    headers = {"Origin": ORIGIN, "X-CSRF-Token": login_response.json()["csrf_token"]}
    path = f"/api/studio/enquiries/{record(index)['_id']}/client-invitations"
    _, token = await issue_invite(client, headers, path)
    client.cookies.clear()
    return token


async def test_invitation_accept_ignores_bearer_header(client, client_account):
    bearer_token = await client_issue(client)
    anonymous_token = await invite_other(client, 2, "anonymous@example.test")
    carried_token = await invite_other(client, 3, "carried@example.test")
    anonymous = await accept(client, anonymous_token)
    assert anonymous.status_code == 200, anonymous.text
    client.cookies.clear()
    carried = await client.post(
        ACCEPT,
        headers={"Origin": ORIGIN, **bearer(bearer_token)},
        json={"token": carried_token, "password": CLIENT_PASSWORD},
    )
    assert carried.status_code == anonymous.status_code
    assert set(carried.json()) == set(anonymous.json())
    assert carried.json()["recovered"] is anonymous.json()["recovered"] is False
    assert carried.json()["identity"]["email"] == "carried@example.test"
    assert carried.json()["identity"]["id"] != str(client_account["_id"])
    database = get_database()
    session = await database.client_sessions.find_one(
        {"_id": auth.digest(client.cookies[client_auth.cookie_name()])}
    )
    owner = await database.client_identities.find_one({"_id": session["identity_id"]})
    assert owner["email"] == "carried@example.test"
    assert session["identity_id"] != client_account["_id"]
    assert session["transport"] == "cookie"
    # The invitation grant went to the invited identity, never to the bearer's client.
    assert await database.client_access.count_documents({"client_id": client_account["_id"]}) == 1


@pytest.mark.parametrize("header", ["Bearer anything", "Basic abc"])
async def test_invitation_accept_with_cookie_and_authorization_header_is_refused(
    client, client_account, header
):
    first = await invite_other(client, 2, "second@example.test")
    token = await invite_other(client, 3, "third@example.test")
    assert (await accept(client, first)).status_code == 200
    assert client.cookies[client_auth.cookie_name()]
    refused = await client.post(
        ACCEPT,
        headers={"Origin": ORIGIN, "Authorization": header},
        json={"token": token, "password": CLIENT_PASSWORD},
    )
    assert refused.status_code == 401
