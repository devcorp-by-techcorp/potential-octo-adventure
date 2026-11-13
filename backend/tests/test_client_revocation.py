"""Real replica-set verification of per-enquiry grant withdrawal and restoration."""

import asyncio
from uuid import uuid4

import pytest

from db import get_database
from tests.test_client_invitations import (  # noqa: F401
    ACCEPT,
    DETAIL,
    ID,
    ISSUE,
    LIST,
    accept,
    enrolled,
    issue,
)
from tests.test_client_invitations import (
    setup as invitation_setup,
)


@pytest.fixture
async def setup(client):
    return await invitation_setup.__wrapped__(client)


ACCESS = f"/api/studio/enquiries/{ID}/client-access"


async def test_revocation_is_persisted_idempotent_and_requires_new_invitation(client, setup):
    invitation, token, client_headers = await enrolled(client, setup)
    grant = (await client.get(ACCESS)).json()[0]
    pending, pending_token = await issue(client, setup)
    path = ACCESS + "/" + grant["id"] + "/revoke"
    assert (await client.post(path, json={})).status_code == 403
    response = await client.post(path, headers=setup, json={})
    assert response.status_code == 200
    assert response.json()["revoked_at"]
    retry = await client.post(path, headers=setup, json={})
    assert retry.json() == response.json()
    visible_history = (await client.get(ACCESS)).json()
    assert len(visible_history) == 1
    assert visible_history[0]["id"] == grant["id"]
    assert visible_history[0]["revoked_at"]
    stored = await get_database().client_access.find_one({"_id": grant["id"]})
    assert (
        stored["revoked_by"]
        and len([x for x in stored["history"] if x["action"] == "revoked"]) == 1
    )
    assert (await client.get(DETAIL)).status_code == 404
    assert (await client.get(LIST)).json()["items"] == []
    recovered = await client.post(
        ACCEPT, headers=client_headers, json={"token": token, "recover": True}
    )
    assert recovered.status_code == 409
    stale = await client.post(ACCEPT, headers=client_headers, json={"token": pending_token})
    assert stale.status_code == 409
    fresh, fresh_token = await issue(client, setup)
    restored = await client.post(ACCEPT, headers=client_headers, json={"token": fresh_token})
    assert restored.status_code == 200
    assert (await client.get(DETAIL)).status_code == 200
    assert len((await client.get(LIST)).json()["items"]) == 1
    assert len((await client.get(ACCESS)).json()) == 1


async def test_concurrent_revoke_retries_and_orphan_identity(client, setup):
    await enrolled(client, setup)
    database = get_database()
    grant = (await client.get(ACCESS)).json()[0]
    path = ACCESS + "/" + grant["id"] + "/revoke"
    await database.client_identities.delete_one({"_id": grant["client_id"]})
    assert (await client.get(ACCESS)).json()[0]["name"] == "Unavailable client identity"
    responses = await asyncio.gather(*[client.post(path, headers=setup, json={}) for _ in range(4)])
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json() == responses[0].json() for response in responses)
    stored = await database.client_access.find_one({"_id": grant["id"]})
    assert len([entry for entry in stored["history"] if entry["action"] == "revoked"]) == 1
    assert (
        await client.post(ACCESS + "/" + str(uuid4()) + "/revoke", headers=setup, json={})
    ).status_code == 404
    wrong_enquiry = f"/api/studio/enquiries/{uuid4()}/client-access/{grant['id']}/revoke"
    assert (await client.post(wrong_enquiry, headers=setup, json={})).status_code == 404


async def test_client_cannot_list_or_withdraw_grants_and_other_enquiry_is_unchanged(client, setup):
    from httpx import ASGITransport, AsyncClient

    import client_auth
    from server import create_app
    from tests.test_studio_enquiries import record

    await enrolled(client, setup)
    database = get_database()
    grant = (await client.get(ACCESS)).json()[0]
    other_id = str(uuid4())
    await database.booking_requests.insert_one(record(_id=other_id))
    other_grant = {
        "_id": str(uuid4()),
        "client_id": grant["client_id"],
        "enquiry_id": other_id,
        "created_at": (await database.client_access.find_one({}))["created_at"],
        "granted_at": (await database.client_access.find_one({}))["granted_at"],
    }
    await database.client_access.insert_one(other_grant)
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies={client_auth.cookie_name(): client.cookies[client_auth.cookie_name()]},
    ) as only_client:
        assert (await only_client.get(ACCESS)).status_code == 401
        assert (
            await only_client.post(
                ACCESS + "/" + grant["id"] + "/revoke", headers={"Origin": setup["Origin"]}, json={}
            )
        ).status_code == 401
    assert (
        await client.post(ACCESS + "/" + grant["id"] + "/revoke", headers=setup, json={})
    ).status_code == 200
    assert (await client.get(LIST)).json()["items"][0]["id"] == other_id
    assert await database.client_access.find_one({"_id": other_grant["_id"]}) == other_grant


async def test_recovery_snapshot_cannot_restore_concurrently_revoked_grant(
    client, setup, monkeypatch
):
    from motor.motor_asyncio import AsyncIOMotorCollection

    _, token, client_headers = await enrolled(client, setup)
    grant = (await client.get(ACCESS)).json()[0]
    ready, proceed = asyncio.Event(), asyncio.Event()
    original = AsyncIOMotorCollection.find_one
    paused = False

    async def snapshot(self, *args, **kwargs):
        nonlocal paused
        result = await original(self, *args, **kwargs)
        if self.name == "client_access" and kwargs.get("session") and not paused:
            paused = True
            ready.set()
            await proceed.wait()
        return result

    monkeypatch.setattr(AsyncIOMotorCollection, "find_one", snapshot)
    task = asyncio.create_task(
        client.post(ACCEPT, headers=client_headers, json={"token": token, "recover": True})
    )
    await asyncio.wait_for(ready.wait(), 10)
    response = await client.post(ACCESS + "/" + grant["id"] + "/revoke", headers=setup, json={})
    assert response.status_code == 200
    proceed.set()
    assert (await asyncio.wait_for(task, 10)).status_code == 409
    assert (await client.get(DETAIL)).status_code == 404


@pytest.mark.parametrize("action", ["disable", "reset", "logout"])
async def test_staff_revocation_cannot_survive_changed_auth(client, setup, monkeypatch, action):
    import client_access
    from staff import change_staff
    from tests.test_auth import EMAIL, PASSWORD

    await enrolled(client, setup)
    grant = (await client.get(ACCESS)).json()[0]
    original = client_access.fence_staff_session
    changed = False

    async def fence(database, request, identity, session):
        nonlocal changed
        if not changed:
            changed = True
            if action == "logout":
                await database.staff_sessions.update_many(
                    {}, {"$set": {"revoked_at": client_access.now()}}
                )
            else:
                await change_staff(action, EMAIL, password=PASSWORD if action == "reset" else None)
        await original(database, request, identity, session)

    monkeypatch.setattr(client_access, "fence_staff_session", fence)
    response = await client.post(ACCESS + "/" + grant["id"] + "/revoke", headers=setup, json={})
    assert response.status_code == 401
    assert not (await get_database().client_access.find_one({"_id": grant["id"]})).get("revoked_at")
    assert (await client.get(DETAIL)).status_code == 200
