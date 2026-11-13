"""Booking lifecycle, optimistic concurrency and narrow client projection."""

import asyncio
from uuid import uuid4

import pytest

from auth import password_hash
from db import get_database
from staff import change_staff
from tests.test_auth import EMAIL, ORIGIN, PASSWORD, login
from tests.test_studio_enquiries import record


@pytest.fixture
async def setup(client):
    await change_staff("provision", EMAIL, "Booking Staff", PASSWORD)
    session = await login(client)
    item = record()
    await get_database().booking_requests.insert_one(item)
    return item, {"Origin": ORIGIN, "X-CSRF-Token": session.json()["csrf_token"]}


async def test_create_is_idempotent_and_lifecycle_is_revisioned(client, setup):
    enquiry, headers = setup
    path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
    first, second = await asyncio.gather(
        client.post(path, headers=headers, json={}), client.post(path, headers=headers, json={})
    )
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert await get_database().bookings.count_documents({}) == 1
    booking = first.json()
    assert booking["state"] == "planning" and booking["revision"] == 0
    detail = f"/api/studio/bookings/{booking['id']}"
    stored_before_confirmation = await get_database().bookings.find_one({})
    confirmed = await client.patch(
        detail, headers=headers, json={"expected_revision": 0, "state": "confirmed"}
    )
    assert confirmed.status_code == 409
    assert "capacity" in confirmed.json()["detail"]
    assert await get_database().bookings.find_one({}) == stored_before_confirmation
    latest = (await client.get(detail)).json()
    assert latest["state"] == "planning" and latest["revision"] == 0
    stale = await client.patch(
        detail, headers=headers, json={"expected_revision": 1, "state": "cancelled"}
    )
    assert stale.status_code == 409
    invalid = await client.patch(
        detail, headers=headers, json={"expected_revision": 0, "state": "delivered"}
    )
    assert invalid.status_code == 409


@pytest.mark.parametrize("value", ["2027-02-29", "2026-04-31", "0000-01-01", "2026-2-1", None])
async def test_invalid_planned_dates_never_create_or_modify_a_booking(client, setup, value):
    enquiry, headers = setup
    path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
    invalid = await client.post(path, headers=headers, json={"scheduled_date": value})
    assert invalid.status_code == 422
    database = get_database()
    assert await database.bookings.count_documents({}) == 0
    created = await client.post(path, headers=headers, json={})
    booking = created.json()
    before = await database.bookings.find_one({})
    invalid = await client.patch(
        f"/api/studio/bookings/{booking['id']}",
        headers=headers,
        json={"expected_revision": 0, "scheduled_date": value},
    )
    assert invalid.status_code == 422
    assert await database.bookings.find_one({}) == before


@pytest.mark.parametrize("field", ["location", "staff_note", "state"])
async def test_null_changes_cannot_corrupt_a_booking(client, setup, field):
    enquiry, headers = setup
    created = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/booking", headers=headers, json={}
    )
    database = get_database()
    before = await database.bookings.find_one({})
    response = await client.patch(
        f"/api/studio/bookings/{created.json()['id']}",
        headers=headers,
        json={"expected_revision": 0, field: None},
    )
    assert response.status_code == 422
    assert await database.bookings.find_one({}) == before


async def test_rescheduling_persists_calendar_dates_and_keeps_enquiry_immutable(client, setup):
    enquiry, headers = setup
    original = await get_database().booking_requests.find_one({"_id": enquiry["_id"]})
    created = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/booking",
        headers=headers,
        json={"scheduled_date": "2028-02-29"},
    )
    assert created.status_code == 200
    assert created.json()["scheduled_date"] == "2028-02-29"
    path = f"/api/studio/bookings/{created.json()['id']}"
    initial_history = (await client.get(path)).json()["history"]
    changes = {"scheduled_date": "2026-10-04", "location": "Melbourne", "staff_note": "Private"}
    updated = await client.patch(path, headers=headers, json={"expected_revision": 0, **changes})
    assert updated.status_code == 200
    assert {key: updated.json()[key] for key in changes} == changes
    assert updated.json()["revision"] == 1 and updated.json()["state"] == "planning"
    assert updated.json()["history"] == initial_history
    assert all(event["at"].endswith("Z") for event in initial_history)
    assert (await client.get(path)).json() == updated.json()
    assert await get_database().booking_requests.find_one({"_id": enquiry["_id"]}) == original
    # Empty strings deliberately clear optional details; omitted fields retain their values.
    cleared = await client.patch(
        path, headers=headers, json={"expected_revision": 1, "location": "", "staff_note": ""}
    )
    assert cleared.status_code == 200
    assert cleared.json()["location"] == cleared.json()["staff_note"] == ""
    assert cleared.json()["scheduled_date"] == changes["scheduled_date"]


async def test_concurrent_metadata_edits_have_one_winner_and_allow_explicit_retry(client, setup):
    enquiry, headers = setup
    created = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/booking", headers=headers, json={}
    )
    path = f"/api/studio/bookings/{created.json()['id']}"
    responses = await asyncio.gather(
        *[
            client.patch(path, headers=headers, json={"expected_revision": 0, "staff_note": note})
            for note in ["First draft", "Second draft"]
        ]
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    latest = (await client.get(path)).json()
    assert latest["revision"] == 1
    losing_note = "Second draft" if latest["staff_note"] == "First draft" else "First draft"
    retried = await client.patch(
        path,
        headers=headers,
        json={"expected_revision": latest["revision"], "staff_note": losing_note},
    )
    assert retried.status_code == 200
    assert retried.json()["staff_note"] == losing_note and retried.json()["revision"] == 2


async def test_planning_can_cancel_or_reopen_but_confirmation_is_gated(client, setup):
    enquiry, headers = setup
    created = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/booking", headers=headers, json={}
    )
    path = f"/api/studio/bookings/{created.json()['id']}"
    stages = ["cancelled", "planning"]
    previous = "planning"
    for revision, state in enumerate(stages):
        response = await client.patch(
            path, headers=headers, json={"expected_revision": revision, "state": state}
        )
        assert response.status_code == 200
        event = response.json()["history"][-1]
        assert event["from"] == previous and event["to"] == state and event["actor_id"]
        assert response.json()["revision"] == revision + 1
        previous = state
    blocked = await client.patch(
        path, headers=headers, json={"expected_revision": len(stages), "state": "confirmed"}
    )
    assert blocked.status_code == 409
    assert (await client.get(path)).json()["revision"] == len(stages)


@pytest.mark.parametrize("kind", ["csrf", "origin"])
async def test_booking_writes_require_origin_and_csrf_without_mutating(client, setup, kind):
    enquiry, headers = setup
    path = f"/api/studio/enquiries/{enquiry['_id']}/booking"
    invalid_headers = {
        key: value
        for key, value in headers.items()
        if key != ("Origin" if kind == "origin" else "X-CSRF-Token")
    }
    assert (await client.post(path, headers=invalid_headers, json={})).status_code == 403
    assert await get_database().bookings.count_documents({}) == 0
    created = await client.post(path, headers=headers, json={})
    before = await get_database().bookings.find_one({})
    assert (
        await client.patch(
            f"/api/studio/bookings/{created.json()['id']}",
            headers=invalid_headers,
            json={"expected_revision": 0, "state": "confirmed"},
        )
    ).status_code == 403
    assert await get_database().bookings.find_one({}) == before


async def test_authorization_and_dashboard(client, setup):
    enquiry, headers = setup
    created = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/booking", headers=headers, json={}
    )
    assert created.status_code == 200
    assert (await client.get("/api/studio/dashboard")).status_code == 200
    client.cookies.clear()
    assert (await client.get("/api/studio/bookings")).status_code == 401
    assert (
        await client.post(f"/api/studio/enquiries/{enquiry['_id']}/booking", json={})
    ).status_code == 401


async def test_client_progress_requires_a_grant_and_excludes_private_details(client, setup):
    enquiry, headers = setup
    database = get_database()
    created = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/booking", headers=headers, json={}
    )
    path = f"/api/studio/bookings/{created.json()['id']}"
    updated = await client.patch(
        path,
        headers=headers,
        json={
            "expected_revision": 0,
            "scheduled_date": "2028-02-29",
            "location": "Melbourne",
            "staff_note": "private-staff-secret",
        },
    )
    assert updated.status_code == 200
    # Preserve read access to legacy confirmed records during the policy gate.
    await database.bookings.update_one(
        {"_id": created.json()["id"]},
        {"$set": {"state": "confirmed", "revision": 1}},
    )
    client_id = str(uuid4())
    await database.client_identities.insert_one(
        {
            "_id": client_id,
            "email": enquiry["email"],
            "name": "Client",
            "role": "client",
            "enabled": True,
            "auth_version": "fixture-v1",
            "password_hash": password_hash(PASSWORD),
        }
    )
    signed_in = await client.post(
        "/api/auth/client/login",
        headers={"Origin": ORIGIN},
        json={
            "email": enquiry["email"],
            "password": PASSWORD,
        },
    )
    assert signed_in.status_code == 200
    # Matching email alone grants no booking access.
    assert (await client.get("/api/client/bookings")).json() == []
    grant_id = str(uuid4())
    await database.client_access.insert_one(
        {
            "_id": grant_id,
            "client_id": client_id,
            "enquiry_id": enquiry["_id"],
            "created_at": enquiry["created_at"],
            "granted_at": enquiry["created_at"],
        }
    )
    response = await client.get("/api/client/bookings")
    assert response.status_code == 200
    progress = response.json()[0]
    assert set(progress) == {
        "id",
        "enquiry_id",
        "reference",
        "event_type",
        "scheduled_date",
        "location",
        "state",
        "updated_at",
    }
    assert progress["scheduled_date"] == "2028-02-29" and progress["state"] == "confirmed"
    assert progress["location"] == "Melbourne" and "private-staff-secret" not in response.text
    assert response.headers["cache-control"] == "no-store"
    revoke_path = f"/api/studio/enquiries/{enquiry['_id']}/client-access/{grant_id}/revoke"
    revoked = await client.post(revoke_path, headers=headers, json={})
    assert revoked.status_code == 200 and revoked.json()["revoked_at"]
    assert (await client.get("/api/client/bookings")).json() == []


async def test_selective_revoke_audits_and_immediately_hides_booking(client, setup):
    enquiry, headers = setup
    database = get_database()
    client_id = "00000000-0000-0000-0000-000000000099"
    grant_id = "00000000-0000-0000-0000-000000000088"
    await database.client_access.insert_one(
        {
            "_id": grant_id,
            "client_id": client_id,
            "enquiry_id": enquiry["_id"],
            "granted_at": enquiry["created_at"],
        }
    )
    listed = await client.get(f"/api/studio/enquiries/{enquiry['_id']}/client-access")
    assert listed.json()[0]["id"] == grant_id
    response = await client.post(
        f"/api/studio/enquiries/{enquiry['_id']}/client-access/{grant_id}/revoke",
        headers=headers,
        json={},
    )
    assert response.status_code == 200 and response.json()["revoked_at"]
    stored = await database.client_access.find_one({"_id": grant_id})
    assert stored["revoked_at"] and stored["revoked_by"]
    assert stored["history"][-1]["action"] == "revoked"
