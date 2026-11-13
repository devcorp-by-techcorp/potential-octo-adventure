"""Booking preparation persists without reserving capacity or altering enquiries."""

import asyncio
from uuid import uuid4

import pytest

from db import get_database
from tests.test_client_invitations import DETAIL, ID, enrolled
from tests.test_client_invitations import setup as invitation_setup


@pytest.fixture
async def booking_staff(client):
    return await invitation_setup.__wrapped__(client)


CREATE = f"/api/studio/enquiries/{ID}/booking-draft"
LIST = "/api/studio/booking-drafts"


def schedule(**extra):
    return {
        "command_id": str(uuid4()),
        "starts_at": "2099-12-20T10:00:00+11:00",
        "ends_at": "2099-12-20T12:00:00+11:00",
        "timezone": "Australia/Melbourne",
        **extra,
    }


async def test_draft_lifecycle_retries_privacy_and_immutable_source(client, booking_staff):
    db = get_database()
    source = await db.booking_requests.find_one({"_id": ID})
    payload = schedule()
    assert (await client.post(CREATE, json=payload)).status_code == 403
    response = await client.post(CREATE, headers=booking_staff, json=payload)
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["state"] == "draft" and saved["revision"] == 0
    assert saved["starts_at"].endswith("Z") or saved["starts_at"].endswith("+00:00")
    assert (await client.post(CREATE, headers=booking_staff, json=payload)).json() == saved
    assert (
        await client.post(
            CREATE, headers=booking_staff, json={**payload, "timezone": "Australia/Sydney"}
        )
    ).status_code == 409
    assert (await client.post(CREATE, headers=booking_staff, json=schedule())).status_code == 409
    path = LIST + "/" + saved["id"]
    change = schedule(
        expected_revision=0,
        action="reschedule",
        starts_at="2099-12-21T10:00:00+11:00",
        ends_at="2099-12-21T12:00:00+11:00",
    )
    updated = await client.patch(path, headers=booking_staff, json=change)
    assert updated.status_code == 200
    assert updated.json()["revision"] == 1
    assert (await client.patch(path, headers=booking_staff, json=change)).json() == updated.json()
    assert (
        await client.patch(
            path, headers=booking_staff, json=schedule(expected_revision=0, action="cancel")
        )
    ).status_code == 409
    assert (
        await client.patch(
            path, headers=booking_staff, json=schedule(expected_revision=1, action="confirm")
        )
    ).status_code == 409
    cancel = schedule(expected_revision=1, action="cancel")
    assert (await client.patch(path, headers=booking_staff, json=cancel)).json()[
        "state"
    ] == "cancelled"
    assert (await client.patch(path, headers=booking_staff, json=cancel)).json()["revision"] == 2
    assert (
        await client.patch(
            path, headers=booking_staff, json=schedule(expected_revision=2, action="reschedule")
        )
    ).status_code == 409
    history = (await client.get(path + "/history")).json()["items"]
    assert [item["action"] for item in history] == ["created", "reschedule", "cancel"]
    assert all(item["actor_id"] and item["at"] for item in history)
    assert await db.booking_requests.find_one({"_id": ID}) == source
    assert await db.bookings.count_documents({}) == 0
    assert (await client.get(LIST)).headers["cache-control"] == "no-store"
    await enrolled(client, booking_staff)
    visible = (await client.get(DETAIL + "/booking-draft")).json()
    assert visible["draft"]["state"] == "cancelled" and not visible["confirmation_enabled"]
    assert "actor_id" not in str(visible)
    other = str(uuid4())
    assert (await client.get(f"/api/client/enquiries/{other}/booking-draft")).status_code == 404


async def test_competing_draft_creation_and_revision_updates(client, booking_staff):
    responses = await asyncio.gather(
        *[client.post(CREATE, headers=booking_staff, json=schedule()) for _ in range(2)]
    )
    assert sorted(r.status_code for r in responses) == [200, 409]
    saved = next(r.json() for r in responses if r.status_code == 200)
    path = LIST + "/" + saved["id"]
    changes = await asyncio.gather(
        *[
            client.patch(
                path, headers=booking_staff, json=schedule(expected_revision=0, action="reschedule")
            )
            for _ in range(2)
        ]
    )
    assert sorted(r.status_code for r in changes) == [200, 409]
    assert await get_database().booking_draft_history.count_documents({}) == 2


async def test_timezones_offsets_and_unauthorised_changes(client, booking_staff):
    for bad in [
        schedule(starts_at="2099-12-20T10:00:00"),
        schedule(timezone="Bogus/Zone"),
        schedule(ends_at="2099-12-20T09:00:00+11:00"),
        schedule(starts_at="2099-12-20T10:00:00+10:00"),
    ]:
        result = await client.post(CREATE, headers=booking_staff, json=bad)
        assert result.status_code == 422 and "Bogus/Zone" not in result.text
    assert (
        await client.post(
            CREATE, headers={**booking_staff, "Origin": "https://evil.test"}, json=schedule()
        )
    ).status_code == 403
    saved = (await client.post(CREATE, headers=booking_staff, json=schedule())).json()
    await enrolled(client, booking_staff)
    staff_cookie = client.cookies.pop("studio_session")
    assert (await client.get(LIST)).status_code == 401
    assert (
        await client.patch(
            LIST + "/" + saved["id"], json=schedule(expected_revision=0, action="cancel")
        )
    ).status_code == 401
    client.cookies.set("studio_session", staff_cookie)


@pytest.mark.parametrize("action", ["disable", "reset", "logout"])
async def test_staff_access_changed_after_dependency_cannot_write(
    client, booking_staff, monkeypatch, action
):
    import booking_drafts
    from staff import change_staff
    from tests.test_auth import EMAIL, PASSWORD

    original = booking_drafts.staff_fence
    changed = False

    async def mutate(db, request, identity, session):
        nonlocal changed
        if not changed:
            changed = True
            if action == "logout":
                await db.staff_sessions.update_many(
                    {}, {"$set": {"revoked_at": booking_drafts.now()}}
                )
            else:
                await change_staff(action, EMAIL, password=PASSWORD if action == "reset" else None)
        await original(db, request, identity, session)

    monkeypatch.setattr(booking_drafts, "staff_fence", mutate)
    assert (await client.post(CREATE, headers=booking_staff, json=schedule())).status_code == 401
    assert await get_database().booking_drafts.count_documents({}) == 0
    assert await get_database().booking_draft_history.count_documents({}) == 0
