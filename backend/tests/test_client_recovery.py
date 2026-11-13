"""Opt-in recovery against real replica-set transactions and fake email boundary."""

import asyncio
from datetime import timedelta

import httpx
import pytest
from cryptography.fernet import Fernet
from httpx import ASGITransport, AsyncClient

import auth
import client_recovery as recovery

ORIGINAL_SEND = recovery.send_recovery_email
from config import get_settings
from db import get_database
from server import create_app

BASE = "/api/auth/client/recovery"
ORIGIN = "http://127.0.0.1:5173"
EMAIL = "recovery@example.test"
PASSWORD = "test-recovery-password"
NEW_PASSWORD = "new-client-password-long"


@pytest.fixture
async def enabled(monkeypatch):
    monkeypatch.setenv("CLIENT_RECOVERY_ENABLED", "true")
    monkeypatch.setenv("CLIENT_RECOVERY_SENDER_VERIFIED", "true")
    monkeypatch.setenv("CLIENT_RECOVERY_ORIGIN", ORIGIN)
    monkeypatch.setenv("CLIENT_RECOVERY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("RESEND_API_KEY", "test-provider-key")
    monkeypatch.setenv("BOOKING_FROM_EMAIL", "Studio <recovery-sender@example.test>")
    get_settings.cache_clear()
    database = get_database()
    assert (await database.client.admin.command("hello")).get("setName")
    await database.client_identities.insert_one(
        {
            "_id": "recovery-client",
            "email": EMAIL,
            "name": "Test Client",
            "role": "client",
            "enabled": True,
            "auth_version": "recovery-v1",
            "password_hash": auth.password_hash(PASSWORD),
        }
    )
    sent = []

    async def fake(payload, key):
        sent.append((payload, key))

    monkeypatch.setattr(recovery, "send_recovery_email", fake)
    return sent


@pytest.fixture
async def api():
    app = create_app()
    if not any(route.path == BASE + "/status" for route in app.routes):
        app.include_router(recovery.router)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        yield client


async def request(api, email=EMAIL):
    return await api.post(BASE + "/request", headers={"Origin": ORIGIN}, json={"email": email})


def token(sent):
    return sent[-1][0]["text"].split("/client/recovery#")[1].split("\n")[0]


async def reset(api, value, password=NEW_PASSWORD):
    return await api.post(
        BASE + "/reset", headers={"Origin": ORIGIN}, json={"token": value, "password": password}
    )


async def test_disabled_and_misconfigured_recovery_creates_nothing(api, monkeypatch):
    assert (await api.get(BASE + "/status")).json() == {"enabled": False}
    assert (await request(api)).status_code == 503
    assert await get_database().client_recovery_tokens.count_documents({}) == 0
    monkeypatch.setenv("CLIENT_RECOVERY_ENABLED", "true")
    monkeypatch.setenv("CLIENT_RECOVERY_ENCRYPTION_KEY", "invalid")
    assert (await api.get(BASE + "/status")).json() == {"enabled": False}


async def test_generic_unknown_disabled_wrong_role_and_no_plaintext(api, enabled):
    database = get_database()
    await database.client_identities.insert_many(
        [
            {
                "_id": "disabled",
                "email": "disabled@example.test",
                "enabled": False,
                "role": "client",
            },
            {"_id": "staff", "email": "staff@example.test", "enabled": True, "role": "staff"},
        ]
    )
    for email in (EMAIL, "unknown@example.test", "disabled@example.test", "staff@example.test"):
        result = await request(api, email)
        assert result.status_code == 202 and result.json() == {"message": recovery.GENERIC}
        assert result.headers["cache-control"] == "no-store"
    assert len(enabled) == 1
    value = token(enabled)
    stored = await database.client_recovery_tokens.find_one({})
    assert stored["_id"] == auth.digest(value) and len(value) == 43
    assert (stored["expires_at"] - stored["created_at"]).total_seconds() <= 1800
    assert value not in str(stored)
    job = await database.client_recovery_outbox.find_one({})
    assert job["state"] == "sent" and "ciphertext" not in job and value not in str(job)
    limits = await database.client_recovery_limits.find({}).to_list(length=100)
    assert EMAIL not in str(limits) and "testclient" not in str(limits)


async def test_reset_single_use_invalidates_every_old_session_and_other_links(api, enabled):
    signed = await api.post(
        "/api/auth/client/login",
        headers={"Origin": ORIGIN},
        json={"email": EMAIL, "password": PASSWORD},
    )
    assert signed.status_code == 200
    old_cookie = api.cookies["client_session"]
    assert (await request(api)).status_code == 202
    first = token(enabled)
    assert (await request(api)).status_code == 202
    second = token(enabled)
    result = await reset(api, first)
    assert result.status_code == 200 and "set-cookie" in result.headers
    assert (await reset(api, first)).status_code == 400
    assert (await reset(api, second)).status_code == 400
    api.cookies.set("client_session", old_cookie)
    assert (await api.get("/api/auth/client/session")).status_code == 401
    identity = await get_database().client_identities.find_one({"_id": "recovery-client"})
    assert identity["enabled"] and identity["auth_version"] != "recovery-v1"
    assert auth.verify_password(identity["password_hash"], NEW_PASSWORD)
    assert not auth.verify_password(identity["password_hash"], PASSWORD)
    login = await api.post(
        "/api/auth/client/login",
        headers={"Origin": ORIGIN},
        json={"email": EMAIL, "password": NEW_PASSWORD},
    )
    assert login.status_code == 200
    assert await get_database().client_access.count_documents({}) == 0


async def test_disabled_operator_reset_role_change_and_expiry_deny_reset(api, enabled):
    database = get_database()
    original = await database.client_identities.find_one({"_id": "recovery-client"})
    for kind in ("disabled", "operator-reset", "role", "expired"):
        await database.client_identities.replace_one({"_id": original["_id"]}, original)
        await database.client_recovery_limits.delete_many({})
        assert (await request(api)).status_code == 202
        value = token(enabled)
        if kind == "expired":
            await database.client_recovery_tokens.update_one(
                {"_id": auth.digest(value)},
                {"$set": {"expires_at": auth.now() - timedelta(seconds=1)}},
            )
        else:
            field, replacement = {
                "disabled": ("enabled", False),
                "operator-reset": ("auth_version", "changed"),
                "role": ("role", "staff"),
            }[kind]
            await database.client_identities.update_one(
                {"_id": original["_id"]}, {"$set": {field: replacement}}
            )
        before = await database.client_identities.find_one({"_id": original["_id"]})
        result = await reset(api, value)
        assert result.status_code == 400 and result.json()["detail"] == recovery.INVALID
        assert await database.client_identities.find_one({"_id": original["_id"]}) == before


async def test_concurrent_consumption_changes_exactly_once(api, enabled):
    await request(api)
    value = token(enabled)
    results = await asyncio.gather(reset(api, value), reset(api, value, "other-password-long"))
    assert sorted(result.status_code for result in results) == [200, 400]
    assert (await get_database().client_recovery_tokens.find_one({}))["consumed_at"]


async def test_origin_validation_payload_bounds_and_throttling(api, enabled):
    for endpoint, body in (
        ("request", {"email": EMAIL}),
        ("reset", {"token": "x" * 43, "password": NEW_PASSWORD}),
    ):
        for origin in (None, "https://untrusted.example"):
            assert (
                await api.post(
                    BASE + "/" + endpoint, headers={"Origin": origin} if origin else {}, json=body
                )
            ).status_code == 403
    for body in ({"email": EMAIL, "role": "staff"}, {"email": "x\n@example.test"}):
        assert (
            await api.post(BASE + "/request", headers={"Origin": ORIGIN}, json=body)
        ).status_code == 422
    for body in (
        {"token": "short", "password": NEW_PASSWORD},
        {"token": "x" * 43, "password": "short"},
    ):
        assert (
            await api.post(BASE + "/reset", headers={"Origin": ORIGIN}, json=body)
        ).status_code == 422
    for _ in range(3):
        assert (await request(api)).status_code == 202
    limited = await request(api)
    assert limited.status_code == 429 and limited.headers["retry-after"]


async def test_delivery_timeout_retries_identical_encrypted_payload_and_key(
    api, enabled, monkeypatch
):
    attempts = []

    async def timeout_then_success(payload, key):
        attempts.append((payload, key))
        if len(attempts) == 1:
            raise httpx.ReadTimeout("uncertain provider response")

    monkeypatch.setattr(recovery, "send_recovery_email", timeout_then_success)
    assert (await request(api)).status_code == 202
    database = get_database()
    job = await database.client_recovery_outbox.find_one({})
    assert job["state"] == "failed" and "ciphertext" in job
    assert EMAIL not in str(job) and attempts[0][0]["text"] not in str(job)
    await asyncio.gather(
        recovery.deliver_recovery(job["_id"]), recovery.deliver_recovery(job["_id"])
    )
    assert len(attempts) == 2 and attempts[0] == attempts[1]
    saved = await database.client_recovery_outbox.find_one({})
    assert saved["state"] == "sent" and saved["attempts"] == 2 and "ciphertext" not in saved
    await recovery.retry_recovery()
    assert len(attempts) == 2


async def test_resend_adapter_uses_fixed_endpoint_key_and_rejects_http_error(enabled, monkeypatch):
    actual_client = httpx.AsyncClient
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(
            200 if len(requests) == 1 else 500, json={"id": "fake-provider-receipt"}
        )

    monkeypatch.setattr(
        recovery.httpx,
        "AsyncClient",
        lambda **kwargs: actual_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    payload = {"from": "sender@example.test", "to": [EMAIL], "subject": "Test", "text": "Fake body"}
    await ORIGINAL_SEND(payload, "test-fixed-key")
    with pytest.raises(httpx.HTTPStatusError):
        await ORIGINAL_SEND(payload, "test-fixed-key")
    assert str(requests[0].url) == "https://api.resend.com/emails"
    assert (
        requests[0].headers["idempotency-key"]
        == requests[1].headers["idempotency-key"]
        == "test-fixed-key"
    )
