"""Persistence, consent, server state, OpenAI failures and policy regressions."""

import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest

import db as db_module
import entry
from config import get_settings
from luma_policy import validate_reply


@pytest.fixture(autouse=True)
def clear_limits():
    entry._buckets.clear()


def booking(**changes):
    return {
        "name": "Alex Example",
        "email": "alex@example.com",
        "event_type": "Wedding",
        "preferred_date": "2099-12-20",
        "collection": "signature",
        "consent": True,
        "request_id": str(uuid4()),
        **changes,
    }


async def create_session(state="collecting", **changes):
    session = {
        "_id": str(uuid4()),
        "booking_state": state,
        "history": [],
        "draft": {},
        "revision": 0,
        "expires_at": datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1),
        **changes,
    }
    await db_module.get_database().luma_sessions.insert_one(session)
    return session


@pytest.mark.asyncio
async def test_booking_saved_once_and_pending(client):
    payload = booking()
    first = await client.post("/api/bookings", json=payload)
    second = await client.post("/api/bookings", json=payload)
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert first.json()["booking_state"] == "awaiting_studio_confirmation"
    assert await db_module.get_database().booking_requests.count_documents({}) == 1
    stored = await db_module.get_database().booking_requests.find_one({})
    assert stored["consent"] is True
    assert stored["email"] == payload["email"]


@pytest.mark.asyncio
async def test_idempotency_cannot_overwrite(client):
    payload = booking()
    await client.post("/api/bookings", json=payload)
    response = await client.post("/api/bookings", json={**payload, "name": "Changed"})
    assert response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "changes",
    [
        {"consent": False},
        {"email": "bad"},
        {"name": "  "},
        {"preferred_date": "2000-01-01"},
        {"state": "confirmed"},
        {"collection": "made-up"},
        {"session_id": "bad"},
    ],
)
async def test_invalid_booking_not_saved(client, changes):
    response = await client.post("/api/bookings", json=booking(**changes))
    assert response.status_code == 422
    assert await db_module.get_database().booking_requests.count_documents({}) == 0


@pytest.mark.asyncio
async def test_booking_updates_server_session(client):
    session = await create_session(draft={"name": "Alex"})
    response = await client.post("/api/bookings", json=booking(session_id=session["_id"]))
    assert response.status_code == 201
    saved = await db_module.get_database().luma_sessions.find_one({"_id": session["_id"]})
    assert saved["booking_state"] == "awaiting_studio_confirmation"
    assert saved["draft"] == {}


@pytest.mark.asyncio
async def test_database_failure_does_not_claim_received(client, monkeypatch):
    def broken():
        raise RuntimeError("Database disconnected")

    monkeypatch.setattr(entry, "get_database", broken)
    assert (await client.post("/api/bookings", json=booking())).status_code == 503


@pytest.mark.asyncio
async def test_chat_requires_key(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()
    response = await client.post("/api/luma/chat", json={"message": "Hello"})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_openai_adapter_and_server_history(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    session = await create_session(
        history=[
            {"role": "user", "content": "I am Alex"},
            {"role": "assistant", "content": "What is your preferred date?"},
        ]
    )
    calls = []
    original = httpx.AsyncClient

    def respond(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "reply": "Could you share your preferred date?",
                                    "draft": {"name": "Alex", "state": "confirmed"},
                                }
                            )
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(
        entry.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    response = await client.post(
        "/api/luma/chat", json={"message": "Next year", "session_id": session["_id"]}
    )
    assert response.status_code == 200
    assert response.json()["draft"] == {"name": "Alex"}
    assert response.json()["booking_state"] == "collecting"
    sent = json.loads(calls[0].content)
    assert sent["model"] == "gpt-4.1-mini"
    assert sent["messages"][1]["content"] == "I am Alex"
    assert calls[0].headers["authorization"] == "Bearer test-key"
    assert "test-key" not in response.text


@pytest.mark.asyncio
async def test_chat_creates_session_with_ttl(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()

    async def answer(_messages):
        return {"reply": "What are you planning?", "draft": {}}

    monkeypatch.setattr(entry, "generate", answer)
    response = await client.post("/api/luma/chat", json={"message": "Hello"})
    assert response.status_code == 200
    saved = await db_module.get_database().luma_sessions.find_one(
        {"_id": response.json()["session_id"]}
    )
    assert saved["history"][0]["content"] == "Hello"
    assert saved["expires_at"] > datetime.now(UTC).replace(tzinfo=None)


@pytest.mark.asyncio
async def test_bad_reply_regenerated_and_falls_back(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    calls = []

    async def unsafe(messages):
        calls.append(messages)
        return {"reply": "Your session is all set with retouched images", "draft": {}}

    monkeypatch.setattr(entry, "generate", unsafe)
    response = await client.post("/api/luma/chat", json={"message": "Book me now"})
    assert response.status_code == 200
    assert len(calls) == 2
    assert validate_reply(response.json()["reply"], "collecting")
    assert response.json()["booking_state"] == "collecting"



@pytest.mark.asyncio
async def test_luma_retries_transient_provider_error_once(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    original = httpx.AsyncClient
    responses = []

    def respond(request):
        responses.append(request)
        if len(responses) == 1:
            return httpx.Response(503, json={"error": "temporary provider outage"})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps({
                "reply": "Which session type are you considering?",
                "draft": {},
            })}}]},
        )

    monkeypatch.setattr(
        entry.httpx, "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    result = await client.post("/api/luma/chat", json={"message": "Hello"})
    assert result.status_code == 200
    assert result.json()["reply"] == "Which session type are you considering?"
    assert len(responses) == 2


@pytest.mark.asyncio
async def test_luma_auth_error_does_not_retry_or_expose_provider_details(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    original = httpx.AsyncClient
    responses = []

    def respond(request):
        responses.append(request)
        return httpx.Response(401, json={"error": "private key failure"})

    monkeypatch.setattr(
        entry.httpx, "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    result = await client.post("/api/luma/chat", json={"message": "Hello"})
    assert result.status_code == 503
    assert len(responses) == 1
    assert "private key failure" not in result.text
    assert "test-key" not in result.text


@pytest.mark.asyncio
async def test_luma_regeneration_outage_uses_safe_reply_without_unverified_draft(
    client, monkeypatch
):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    calls = []

    async def answer(_messages):
        calls.append(1)
        if len(calls) == 1:
            return {
                "reply": "Your booking is confirmed",
                "draft": {"name": "Not validated"},
            }
        raise entry.HTTPException(503, "provider down")

    monkeypatch.setattr(entry, "generate", answer)
    result = await client.post("/api/luma/chat", json={"message": "Hi"})
    assert result.status_code == 200
    assert len(calls) == 2
    assert result.json()["draft"] == {}
    assert validate_reply(result.json()["reply"], "collecting")


@pytest.mark.asyncio
async def test_pending_state_from_backend_only(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    session = await create_session("awaiting_studio_confirmation")

    async def answer(messages):
        assert '"booking_state": "awaiting_studio_confirmation"' in messages[0]["content"]
        return {
            "reply": "Your tentative request is with the studio, pending confirmation.",
            "draft": {"name": "Cannot change"},
        }

    monkeypatch.setattr(entry, "generate", answer)
    response = await client.post(
        "/api/luma/chat", json={"message": "Confirmed!", "session_id": session["_id"]}
    )
    assert response.json()["booking_state"] == "awaiting_studio_confirmation"
    assert response.json()["draft"] == {}
    assert (
        await client.post("/api/luma/chat", json={"message": "Hi", "booking_state": "confirmed"})
    ).status_code == 422


@pytest.mark.asyncio
async def test_expired_session(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    session = await create_session(expires_at=datetime(2000, 1, 1))
    response = await client.post(
        "/api/luma/chat", json={"message": "Hi", "session_id": session["_id"]}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_provider_failure(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    original = httpx.AsyncClient
    monkeypatch.setattr(
        entry.httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(429, json={"error": "private provider detail"})
            ),
            **kwargs,
        ),
    )
    response = await client.post("/api/luma/chat", json={"message": "Hi"})
    assert response.status_code == 503
    assert "private provider detail" not in response.text


@pytest.mark.asyncio
async def test_concurrent_state_change_rejects_stale_reply(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    session = await create_session()

    async def answer(_messages):
        await db_module.get_database().luma_sessions.update_one(
            {"_id": session["_id"]}, {"$inc": {"revision": 1}}
        )
        return {"reply": "Could you share your preferred date?", "draft": {}}

    monkeypatch.setattr(entry, "generate", answer)
    response = await client.post(
        "/api/luma/chat", json={"message": "Hi", "session_id": session["_id"]}
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_booking_rate_limit(client):
    for _ in range(6):
        assert (await client.post("/api/bookings", json=booking())).status_code == 201
    response = await client.post("/api/bookings", json=booking())
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"


@pytest.mark.parametrize(
    "text",
    [
        "Professionally RETOUCHED images",
        "We can edit your gallery",
        "We enhance your appearance",
        "Skin smoothing",
        "Post-production",
        "Touch-ups",
        "Remove blemishes",
        "Digital alteration",
        "We can soften your features",
        "Filtered photos",
    ],
)
def test_image_policy_blocks_for_all_states(text):
    assert not validate_reply(text, "collecting")
    assert not validate_reply(text, "confirmed")


@pytest.mark.parametrize(
    "text",
    [
        "Your booking is confirmed",
        "Your session is all set",
        "You’re now booked in",
        "Everything is locked in",
        "We’ll see you on Saturday",
        "Your date has been reserved",
        "Your booking is complete",
    ],
)
def test_tentative_cannot_sound_confirmed(text):
    assert not validate_reply(text, "tentative_request")


def test_approved_examples():
    assert validate_reply(
        "Selected images capture you naturally, straight out of camera.", "collecting"
    )
    assert validate_reply(
        "Your tentative request is with the lead photographer.", "tentative_request"
    )
    assert not validate_reply("Thank you!", "tentative_request")
    assert not validate_reply("I have sent your request to the studio.", "collecting")
    assert validate_reply("Your booking is confirmed.", "confirmed")


@pytest.mark.asyncio
async def test_optional_email_alert_deduplicated(client, monkeypatch):
    import notifications

    monkeypatch.setenv("RESEND_API_KEY", "test-resend-key")
    monkeypatch.setenv("BOOKING_FROM_EMAIL", "studio@example.com")
    monkeypatch.setenv("BOOKING_NOTIFICATION_EMAIL", "owner@example.com")
    get_settings.cache_clear()
    original = httpx.AsyncClient
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={"id": "email-1"})

    monkeypatch.setattr(
        notifications.httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs),
    )
    payload = booking()
    assert (await client.post("/api/bookings", json=payload)).status_code == 201
    assert (await client.post("/api/bookings", json=payload)).status_code == 201
    assert len(calls) == 1
    email = json.loads(calls[0].content)
    assert email["to"] == ["owner@example.com"]
    assert email["reply_to"] == "alex@example.com"
    assert "pending studio confirmation" in email["text"]
    saved = await db_module.get_database().booking_requests.find_one({})
    assert saved["notification_state"] == "sent"


@pytest.mark.asyncio
async def test_email_failure_preserves_enquiry(client, monkeypatch):
    import notifications

    monkeypatch.setenv("RESEND_API_KEY", "test-resend-key")
    monkeypatch.setenv("BOOKING_FROM_EMAIL", "studio@example.com")
    monkeypatch.setenv("BOOKING_NOTIFICATION_EMAIL", "owner@example.com")
    get_settings.cache_clear()
    original = httpx.AsyncClient
    monkeypatch.setattr(
        notifications.httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(lambda request: httpx.Response(503)), **kwargs
        ),
    )
    response = await client.post("/api/bookings", json=booking())
    assert response.status_code == 201
    saved = await db_module.get_database().booking_requests.find_one({})
    assert saved["notification_state"] == "failed"
    assert saved["state"] == "awaiting_studio_confirmation"
