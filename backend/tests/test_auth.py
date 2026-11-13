"""Authentication through the actual ASGI handlers and persistence queries."""

from datetime import timedelta

import pytest
from pymongo.errors import ServerSelectionTimeoutError

import auth
from db import get_database
from staff import change_staff

PASSWORD = "test-only-long-password"
EMAIL = "staff@example.test"
ORIGIN = "http://127.0.0.1:5173"


@pytest.fixture
async def staff():
    await change_staff("provision", EMAIL, "Test Staff", PASSWORD)
    return await get_database().staff_identities.find_one({"email": EMAIL})


async def login(client, password=PASSWORD, **extra):
    return await client.post(
        "/api/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": EMAIL, "password": password, **extra},
    )


async def test_login_session_hashing_and_logout(client, staff):
    assert staff["password_hash"].startswith("$argon2id$")
    assert PASSWORD not in str(staff)
    response = await login(client)
    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Max-Age=28800" in cookie and "Secure" not in cookie
    assert response.headers["cache-control"] == "no-store"
    token = client.cookies["studio_session"]
    session = await get_database().staff_sessions.find_one({"_id": auth.digest(token)})
    assert session and token not in str(session)
    assert PASSWORD not in response.text and token not in response.text
    assert (await client.get("/api/auth/session")).json()["identity"]["email"] == EMAIL
    assert (await client.get("/api/studio/home")).status_code == 200
    response = await client.post(
        "/api/auth/logout",
        headers={"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]},
    )
    assert response.status_code == 204 and "Max-Age=0" in response.headers["set-cookie"]
    assert (await client.get("/api/studio/home")).status_code == 401
    client.cookies.set("studio_session", token)
    assert (await client.get("/api/auth/session")).status_code == 401
    assert (await get_database().staff_sessions.find_one({"_id": auth.digest(token)}))["revoked_at"]


@pytest.mark.parametrize("kind", ["wrong", "unknown", "disabled", "client"])
async def test_generic_invalid_credentials(client, staff, kind):
    database = get_database()
    if kind == "unknown":
        await database.staff_identities.delete_many({})
    elif kind == "disabled":
        await change_staff("disable", EMAIL)
    elif kind == "client":
        await database.staff_identities.update_one({"email": EMAIL}, {"$set": {"role": "client"}})
    response = await login(client, password="incorrect" if kind == "wrong" else PASSWORD)
    assert response.status_code == 401 and response.json()["detail"] == auth.AUTH_ERROR
    assert "set-cookie" not in response.headers
    assert await database.staff_sessions.count_documents({}) == 0


@pytest.mark.parametrize("path", ["/api/auth/session", "/api/studio/home", "/api/auth/logout"])
async def test_unauthenticated_access(client, path):
    response = await (client.post(path) if path.endswith("logout") else client.get(path))
    assert response.status_code == 401


async def test_server_owned_roles(client, staff):
    injected = await login(client, role="staff")
    assert injected.status_code == 422
    assert PASSWORD not in injected.text
    assert (await login(client)).status_code == 200
    await get_database().staff_identities.update_one({"email": EMAIL}, {"$set": {"role": "client"}})
    assert (await client.get("/api/studio/home", headers={"X-Role": "staff"})).status_code == 403
    assert (await client.get("/api/auth/session")).status_code == 403
    assert (await client.post("/api/auth/logout")).status_code == 403


@pytest.mark.parametrize("kind", ["expired", "revoked", "reset", "disable", "deleted"])
async def test_session_invalidation(client, staff, kind, monkeypatch):
    await login(client)
    database = get_database()
    if kind == "expired":
        # Advance application time only: Mongo TTL cannot remove this future record.
        future = auth.now() + timedelta(seconds=28801)
        monkeypatch.setattr(auth, "now", lambda: future)
        assert await database.staff_sessions.count_documents({}) == 1
    elif kind == "revoked":
        await database.staff_sessions.update_many({}, {"$set": {"revoked_at": auth.now()}})
    elif kind in {"reset", "disable"}:
        await change_staff(kind, EMAIL, password="a-new-test-password")
    else:
        await database.staff_identities.delete_many({})
    assert (await client.get("/api/auth/session")).status_code == 401
    assert (await client.get("/api/studio/home")).status_code == 401
    if kind == "reset":
        assert (await login(client)).status_code == 401
        assert (await login(client, password="a-new-test-password")).status_code == 200


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Origin": ORIGIN},
        {"Origin": "https://evil.example", "X-CSRF-Token": "correct"},
        {"Origin": ORIGIN, "X-CSRF-Token": "incorrect"},
    ],
)
async def test_csrf_rejection(client, staff, headers):
    response = await login(client)
    if headers.get("X-CSRF-Token") == "correct":
        headers = {**headers, "X-CSRF-Token": response.json()["csrf_token"]}
    assert (await client.post("/api/auth/logout", headers=headers)).status_code == 403
    assert (await client.get("/api/auth/session")).status_code == 200


async def test_login_origin_and_content_type(client, staff):
    for headers in ({}, {"Origin": "https://evil.example"}):
        response = await client.post(
            "/api/auth/login", headers=headers, json={"email": EMAIL, "password": PASSWORD}
        )
        assert response.status_code == 403
    response = await client.post(
        "/api/auth/login", headers={"Origin": ORIGIN}, data={"email": EMAIL, "password": PASSWORD}
    )
    assert response.status_code == 422 and PASSWORD not in response.text


async def test_throttle_and_window_recovery(client, staff, monkeypatch):
    # Freeze near the middle of a window to avoid clock boundary flakes.
    timestamp = (int(auth.now().timestamp()) // 900) * 900 + 450
    current = auth.datetime.fromtimestamp(timestamp, auth.UTC)
    monkeypatch.setattr(auth, "now", lambda: current)
    for _ in range(5):
        assert (await login(client, "incorrect")).status_code == 401
    limited = await login(client)
    assert limited.status_code == 429 and int(limited.headers["retry-after"]) > 0
    current += timedelta(seconds=901)
    assert (await login(client)).status_code == 200
    limits = await get_database().staff_login_limits.find_one({})
    assert "expires_at" in limits and EMAIL not in str(limits)


async def test_ip_throttle_bounds_arbitrary_email_attempts(client, monkeypatch):
    # Keep every attempt in one future window: wall-clock boundaries and Mongo
    # TTL cleanup must not reset the bucket during this threshold assertion.
    window = auth.WINDOW_SECONDS
    timestamp = (int(auth.now().timestamp()) // window + 1) * window + window // 2
    current = auth.datetime.fromtimestamp(timestamp, auth.UTC)
    monkeypatch.setattr(auth, "now", lambda: current)
    for index in range(20):
        response = await client.post(
            "/api/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": f"unknown-{index}@example.test", "password": PASSWORD},
        )
        assert response.status_code == 401
    assert (await login(client)).status_code == 429
    assert await get_database().staff_login_limits.count_documents({}) == 21


@pytest.mark.parametrize("operation", ["login", "session", "home", "logout"])
async def test_database_failure_closed(client, staff, monkeypatch, operation):
    signed_in = await login(client)

    def unavailable():
        raise ServerSelectionTimeoutError("test-only database failure")

    monkeypatch.setattr(auth, "get_database", unavailable)
    if operation == "login":
        response = await login(client)
    elif operation == "logout":
        response = await client.post(
            "/api/auth/logout",
            headers={"Origin": ORIGIN, "X-CSRF-Token": signed_in.json()["csrf_token"]},
        )
    else:
        response = await client.get(
            "/api/auth/session" if operation == "session" else "/api/studio/home"
        )
    assert response.status_code == 503 and "test-only" not in response.text


async def test_failed_session_write_does_not_set_cookie(client, staff, monkeypatch):
    async def unavailable(*args, **kwargs):
        raise ServerSelectionTimeoutError("test-only failure")

    monkeypatch.setattr(type(get_database().staff_sessions), "insert_one", unavailable)
    response = await login(client)
    assert response.status_code == 503 and "set-cookie" not in response.headers


async def test_operator_duplicate_reset_disable(client, staff):
    from pymongo.errors import DuplicateKeyError

    with pytest.raises(DuplicateKeyError):
        await change_staff("provision", EMAIL.upper(), "Duplicate", PASSWORD)
    await change_staff("disable", EMAIL)
    await change_staff("reset", EMAIL, password="reset-test-password")
    assert (await login(client, "reset-test-password")).status_code == 401
    with pytest.raises(ValueError):
        await change_staff("reset", "missing@example.test", password=PASSWORD)
    with pytest.raises(ValueError):
        await change_staff("provision", "bad@example.test", "Bad", "short")


async def test_production_cookie_and_cors(client, staff, monkeypatch):
    from httpx import ASGITransport, AsyncClient

    from config import get_settings
    from server import create_app

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("AUTH_ALLOWED_ORIGINS", "https://studio.example.test")
    monkeypatch.setenv("CORS_ORIGINS", "https://studio.example.test")
    get_settings.cache_clear()
    async with AsyncClient(
        transport=ASGITransport(app=create_app()), base_url="https://api.example.test"
    ) as production:
        response = await production.post(
            "/api/auth/login",
            headers={"Origin": "https://studio.example.test"},
            json={"email": EMAIL, "password": PASSWORD},
        )
        assert response.status_code == 200
        cookie = response.headers["set-cookie"]
        assert "__Host-studio_session=" in cookie and "Secure" in cookie and "Domain=" not in cookie
        assert response.headers["access-control-allow-credentials"] == "true"
        assert response.headers["access-control-allow-origin"] == "https://studio.example.test"
        assert (await production.get("/api/studio/home")).status_code == 200


@pytest.mark.parametrize(
    "environment,origins,cors,regex",
    [
        ("production", "http://studio.example.test", "", ""),
        ("production", "https://studio.example.test", "*", ""),
        ("production", "https://studio.example.test", "", ".*"),
        ("test", "*", "", ""),
        ("test", "https://example.test/path", "", ""),
    ],
)
def test_reject_unsafe_configuration(environment, origins, cors, regex):
    from config import Settings

    with pytest.raises(ValueError):
        Settings(
            _env_file=None,
            environment=environment,
            auth_allowed_origins=origins,
            cors_origins=cors,
            cors_origin_regex=regex,
        )


async def test_failed_logout_write_preserves_session(client, staff, monkeypatch):
    signed_in = await login(client)

    async def unavailable(*args, **kwargs):
        raise ServerSelectionTimeoutError("test-only failure")

    monkeypatch.setattr(type(get_database().staff_sessions), "update_one", unavailable)
    response = await client.post(
        "/api/auth/logout",
        headers={"Origin": ORIGIN, "X-CSRF-Token": signed_in.json()["csrf_token"]},
    )
    assert response.status_code == 503 and "set-cookie" not in response.headers
    assert (await client.get("/api/auth/session")).status_code == 200


async def test_session_and_throttle_survive_new_app_instances(client, staff):
    from httpx import ASGITransport, AsyncClient

    from server import create_app

    response = await login(client)
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies=client.cookies,
    ) as restarted:
        assert (await restarted.get("/api/auth/session")).status_code == 200
        assert (await restarted.get("/api/studio/home")).json()["identity"]["email"] == EMAIL
        # IP/email counters persist outside any app instance as well.
        for _ in range(4):
            assert (await login(restarted, "incorrect")).status_code == 401
        assert (await login(client)).status_code == 429
        assert response.json()["expires_at"]


def test_cli_refuses_password_arguments_and_noninteractive_input(monkeypatch, capsys):
    import sys

    import staff as operator

    monkeypatch.setattr(sys, "argv", ["staff.py", "reset", EMAIL, "--password", PASSWORD])
    with pytest.raises(SystemExit) as rejected:
        operator.main()
    assert rejected.value.code == 2
    output = capsys.readouterr()
    assert PASSWORD not in output.err + output.out
    monkeypatch.setattr(sys, "argv", ["staff.py", "reset", EMAIL])
    monkeypatch.setattr(sys.stdin, "isatty", lambda: False)
    assert operator.main() == 1
    output = capsys.readouterr()
    assert "interactive terminal" in output.err
    assert PASSWORD not in output.err + output.out


def test_placeholder_environment_template_loads_defaults(monkeypatch):
    from pathlib import Path

    from config import Settings

    monkeypatch.delenv("AUTH_ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("AUTH_SESSION_SECONDS", raising=False)
    settings = Settings(_env_file=Path(__file__).parents[1] / ".env.example")
    assert settings.auth_session_seconds == 28800
    assert ORIGIN in settings.auth_origin_list()


def test_operator_cli_interactive_real_persistence():
    """Exercise secure terminal prompts and the normal database resolver in a subprocess."""
    import os
    import pty
    import select
    import subprocess
    import sys
    import time
    from pathlib import Path

    from pymongo import MongoClient

    uri = os.environ.get("TEST_MONGODB_URI")
    if not uri:
        pytest.skip("Real MongoDB operator CLI verification requires TEST_MONGODB_URI")
    database_name = get_database().name
    environment = {
        **os.environ,
        "MONGODB_URI": uri,
        "MONGODB_DB_NAME": database_name,
        "ENVIRONMENT": "test",
    }

    def command(action, password=None):
        master, slave = pty.openpty()
        arguments = [sys.executable, str(Path(__file__).parents[1] / "staff.py"), action, EMAIL]
        if action == "provision":
            arguments.extend(["--name", "CLI Staff"])
        process = subprocess.Popen(
            arguments,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            env=environment,
            start_new_session=True,
        )
        os.close(slave)
        transcript = ""
        sent = 0
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
                if process.poll() is not None and not ready:
                    break
            assert process.wait(timeout=2) == 0, transcript
            assert password is None or password not in transcript
            assert f"Staff {action} completed." in transcript
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            os.close(master)

    command("provision", PASSWORD)
    with MongoClient(uri) as mongo:
        collection = mongo[database_name].staff_identities
        provisioned = collection.find_one({"email": EMAIL})
        assert auth.verify_password(provisioned["password_hash"], PASSWORD)
        command("reset", "new-cli-test-password")
        reset = collection.find_one({"email": EMAIL})
        assert reset["auth_version"] != provisioned["auth_version"]
        assert auth.verify_password(reset["password_hash"], "new-cli-test-password")
        command("disable")
        disabled = collection.find_one({"email": EMAIL})
        assert not disabled["enabled"] and disabled["auth_version"] != reset["auth_version"]
