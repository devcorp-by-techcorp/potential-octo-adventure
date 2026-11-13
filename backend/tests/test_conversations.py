"""Real replica-set conversation persistence, isolation and retry tests."""

import asyncio
from uuid import uuid4

import pytest

from db import get_database
from tests.test_client_invitations import ID, enrolled
from tests.test_client_invitations import setup as invitation_setup


@pytest.fixture
async def setup(client):
    return await invitation_setup.__wrapped__(client)


@pytest.fixture
async def conversation(client, setup):
    _, _, headers = await enrolled(client, setup)
    grant = await get_database().client_access.find_one({})
    return (
        f"/api/client/enquiries/{ID}/conversation",
        f"/api/studio/enquiries/{ID}/conversations/{grant['client_id']}",
        headers,
        grant,
    )


def message(text="Message <script>text only</script>"):
    return {"id": str(uuid4()), "text": text}


async def test_persistence_retries_read_and_privacy(client, setup, conversation):
    path, studio, headers, grant = conversation
    body = message()
    first = await client.post(path + "/messages", headers=headers, json=body)
    assert first.status_code == 200, first.text
    assert (
        await client.post(path + "/messages", headers=headers, json=body)
    ).json() == first.json()
    assert (
        await client.post(path + "/messages", headers=headers, json={**body, "text": "different"})
    ).status_code == 409
    reply = await client.post(studio + "/messages", headers=setup, json=message("Studio reply"))
    assert reply.status_code == 200
    history = await client.get(path)
    assert history.status_code == 200
    assert history.json()["unread_count"] == 1
    assert history.json()["latest_sequence"] == 2
    assert set(history.json()["items"][0]) == {
        "id",
        "sequence",
        "sender_scope",
        "text",
        "created_at",
    }
    assert "private-studio-secret" not in history.text and "actor_id" not in history.text
    assert history.headers["cache-control"] == "no-store"
    read = await client.post(path + "/read", headers=headers, json={"sequence": 2})
    assert read.json() == {"read_sequence": 2}
    assert (
        await client.post(path + "/read", headers=headers, json={"sequence": 1})
    ).json() == read.json()
    assert (
        await client.post(path + "/read", headers=headers, json={"sequence": 3})
    ).status_code == 409
    assert (await client.get(path)).json()["unread_count"] == 0
    assert await get_database().conversation_messages.count_documents({}) == 2
    enquiry = await get_database().booking_requests.find_one({"_id": ID})
    assert enquiry["state"] == "awaiting_studio_confirmation"


async def test_concurrency_order_pagination_and_duplicate_delivery(client, setup, conversation):
    path, studio, headers, grant = conversation
    body = message("Identical retry")
    results = await asyncio.gather(
        *[client.post(path + "/messages", headers=headers, json=body) for _ in range(4)]
    )
    assert all(result.status_code == 200 for result in results)
    assert all(result.json() == results[0].json() for result in results)
    replies = await asyncio.gather(
        *[client.post(studio + "/messages", headers=setup, json=message(str(i))) for i in range(5)]
    )
    assert all(reply.status_code == 200 for reply in replies)
    sequences = sorted(reply.json()["sequence"] for reply in replies)
    assert sequences == list(range(2, 7))
    page = (await client.get(path + "?limit=2")).json()
    assert [item["sequence"] for item in page["items"]] == [1, 2] and page["next_cursor"] == 2
    next_page = (await client.get(path + "?limit=2&after=2")).json()
    assert [item["sequence"] for item in next_page["items"]] == [3, 4]
    assert (await client.get(path + "?limit=101")).status_code == 422
    assert (await client.get(path + "?after=-1")).status_code == 422


async def test_revocation_cross_account_roles_csrf_validation(client, setup, conversation):
    from httpx import ASGITransport, AsyncClient

    import auth
    import client_auth
    from server import create_app

    path, studio, headers, grant = conversation
    for bad in [message(" "), message("a" * 2001), {**message(), "internal_note": "secret"}]:
        assert (await client.post(path + "/messages", headers=headers, json=bad)).status_code == 422
    assert (await client.post(path + "/messages", json=message())).status_code == 403
    assert (
        await client.post(
            path + "/messages", headers={**headers, "Origin": "https://evil.test"}, json=message()
        )
    ).status_code == 403
    assert (await client.get(studio.replace(grant["client_id"], str(uuid4())))).status_code == 404
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={auth.cookie_name(): client.cookies[auth.cookie_name()]},
    ) as staff:
        assert (await staff.get(path)).status_code == 401
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={client_auth.cookie_name(): client.cookies[client_auth.cookie_name()]},
    ) as only_client:
        assert (await only_client.get(studio)).status_code == 401
        assert (
            await only_client.post(studio + "/messages", headers=headers, json=message())
        ).status_code == 401
    identity = await get_database().client_identities.find_one({})
    other_id = str(uuid4())
    await get_database().client_identities.insert_one(
        {**identity, "_id": other_id, "email": "other@example.test"}
    )
    from datetime import timedelta

    from auth import digest, now

    await get_database().client_sessions.insert_one(
        {
            "_id": digest("other-token"),
            "scope": "client",
            "identity_id": other_id,
            "auth_version": identity["auth_version"],
            "expires_at": now() + timedelta(hours=1),
            "revoked_at": None,
        }
    )
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={client_auth.cookie_name(): "other-token"},
    ) as other:
        assert (await other.get(path)).status_code == 404
    await get_database().client_access.update_one(
        {"_id": grant["_id"]}, {"$set": {"revoked_at": now()}}
    )
    assert (await client.get(path)).status_code == 404
    assert (
        await client.post(path + "/messages", headers=headers, json=message())
    ).status_code == 404
    assert (
        await client.post(studio + "/messages", headers=setup, json=message())
    ).status_code == 404


@pytest.mark.parametrize("invalidation", ["expired", "logout", "disabled", "reset"])
async def test_session_invalidation_denies_reads_and_writes(
    client, setup, conversation, invalidation
):
    from datetime import timedelta

    import auth
    import client_auth

    path, studio, headers, grant = conversation
    database = get_database()
    session_id = auth.digest(client.cookies[client_auth.cookie_name()])
    if invalidation == "expired":
        await database.client_sessions.update_one(
            {"_id": session_id}, {"$set": {"expires_at": auth.now() - timedelta(seconds=1)}}
        )
    elif invalidation == "logout":
        assert (
            await client.post("/api/auth/client/logout", headers=headers, json={})
        ).status_code == 204
    elif invalidation == "disabled":
        await database.client_identities.update_one(
            {"_id": grant["client_id"]}, {"$set": {"enabled": False}}
        )
    else:
        await database.client_identities.update_one(
            {"_id": grant["client_id"]}, {"$set": {"auth_version": str(uuid4())}}
        )
    assert (await client.get(path)).status_code == 401
    assert (
        await client.post(path + "/messages", headers=headers, json=message())
    ).status_code == 401


async def test_access_withdrawn_after_authentication_is_fenced(
    client, setup, conversation, monkeypatch
):
    import conversations
    from auth import now

    path, studio, headers, grant = conversation
    original = conversations.transaction

    async def revoke_before_transaction(database, callback):
        await database.client_access.update_one(
            {"_id": grant["_id"]}, {"$set": {"revoked_at": now()}}
        )
        return await original(database, callback)

    monkeypatch.setattr(conversations, "transaction", revoke_before_transaction)
    result = await client.post(path + "/messages", headers=headers, json=message())
    assert result.status_code == 404
    assert await get_database().conversation_messages.count_documents({}) == 0
