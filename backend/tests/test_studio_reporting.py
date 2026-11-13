"""Aggregate reporting through real authorization handlers and persistence queries."""

from datetime import UTC, datetime, timedelta

import pytest
from pymongo.errors import ServerSelectionTimeoutError

import auth
import client_auth
import studio_reporting
from db import get_database
from staff import change_staff
from tests.test_auth import EMAIL, PASSWORD
from tests.test_studio_enquiries import authorized, record, staff  # noqa: F401

pytestmark = pytest.mark.usefixtures("authorized")

PATH = "/api/studio/reporting"
COUNT_FIELDS = {
    "enquiries",
    "new_enquiries",
    "in_review_enquiries",
    "archived_enquiries",
    "unclassified_enquiries",
    "enabled_clients",
    "active_access_grants",
}


async def test_empty_report_schema_timestamp_and_private_cache(client):
    before = datetime.now(UTC)
    response = await client.get(PATH)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    result = response.json()
    assert set(result) == COUNT_FIELDS | {"observed_at"}
    assert all(result[field] == 0 for field in COUNT_FIELDS)
    assert before <= datetime.fromisoformat(result["observed_at"]) <= datetime.now(UTC)


async def test_counts_use_saved_status_and_explicit_viable_grants(client):
    database = get_database()
    enquiries = [
        record(index=1),
        record(index=2, studio_status=None),
        record(index=3, studio_status="new"),
        record(index=4, studio_status="in_review"),
        record(index=5, studio_status="archived"),
        record(index=6, studio_status="confirmed"),
        record(index=7, studio_status=""),
    ]
    await database.booking_requests.insert_many(enquiries)
    identities = [
        {"_id": "enabled", "role": "client", "enabled": True, "email": "private@example.test"},
        {"_id": "ungranted", "role": "client", "enabled": True},
        {"_id": "disabled", "role": "client", "enabled": False},
        {"_id": "staff-role", "role": "staff", "enabled": True},
        {"_id": "unknown-enabled", "role": "client"},
    ]
    await database.client_identities.insert_many(identities)
    grants = [
        {
            "_id": "active",
            "client_id": "enabled",
            "enquiry_id": enquiries[0]["_id"],
            "revoked_at": None,
        },
        {"_id": "legacy-active", "client_id": "enabled", "enquiry_id": enquiries[1]["_id"]},
        {
            "_id": "archived-active",
            "client_id": "enabled",
            "enquiry_id": enquiries[4]["_id"],
            "revoked_at": None,
        },
        {
            "_id": "revoked",
            "client_id": "enabled",
            "enquiry_id": enquiries[2]["_id"],
            "revoked_at": datetime.now(UTC),
        },
        {
            "_id": "disabled",
            "client_id": "disabled",
            "enquiry_id": enquiries[0]["_id"],
            "revoked_at": None,
        },
        {
            "_id": "staff-role",
            "client_id": "staff-role",
            "enquiry_id": enquiries[0]["_id"],
            "revoked_at": None,
        },
        {
            "_id": "unknown-enabled",
            "client_id": "unknown-enabled",
            "enquiry_id": enquiries[0]["_id"],
            "revoked_at": None,
        },
        {
            "_id": "orphan-client",
            "client_id": "absent",
            "enquiry_id": enquiries[0]["_id"],
            "revoked_at": None,
        },
        {
            "_id": "orphan-enquiry",
            "client_id": "enabled",
            "enquiry_id": "absent",
            "revoked_at": None,
        },
    ]
    await database.client_access.insert_many(grants)
    await database.client_invitations.insert_one(
        {"_id": "pending", "email": "private@example.test"}
    )
    before_enquiries = await database.booking_requests.find({}).sort("_id", 1).to_list(length=100)
    before_grants = await database.client_access.find({}).sort("_id", 1).to_list(length=100)
    expected = {
        "enquiries": 7,
        "new_enquiries": 3,
        "in_review_enquiries": 1,
        "archived_enquiries": 1,
        "unclassified_enquiries": 2,
        "enabled_clients": 2,
        "active_access_grants": 3,
    }
    for _ in range(2):
        response = await client.get(PATH)
        assert response.status_code == 200, response.text
        assert {field: response.json()[field] for field in COUNT_FIELDS} == expected
        assert set(response.json()) == COUNT_FIELDS | {"observed_at"}
        assert "private" not in response.text and "IS-TEST" not in response.text
    # Reading/index setup leaves source records intact and is repeatable.
    assert (
        await database.booking_requests.find({}).sort("_id", 1).to_list(length=100)
        == before_enquiries
    )
    assert await database.client_access.find({}).sort("_id", 1).to_list(length=100) == before_grants
    indexes = await database.client_identities.index_information()
    assert indexes["studio_reporting_enabled_clients"]["key"] == [("role", 1), ("enabled", 1)]
    indexes = await database.client_access.index_information()
    assert indexes["studio_reporting_active_grants"]["key"] == [("revoked_at", 1), ("client_id", 1)]


@pytest.mark.parametrize(
    "kind", ["absent", "expired", "revoked", "reset", "disabled", "nonstaff", "client-cookie"]
)
async def test_reporting_rejects_invalid_or_cross_role_sessions(client, kind, monkeypatch):
    database = get_database()
    await database.booking_requests.insert_one(record())
    expected = 401
    if kind == "absent":
        client.cookies.clear()
    elif kind == "expired":
        future = auth.now() + timedelta(days=1)
        monkeypatch.setattr(auth, "now", lambda: future)
    elif kind == "revoked":
        await database.staff_sessions.update_many({}, {"$set": {"revoked_at": auth.now()}})
    elif kind in ("reset", "disabled"):
        await change_staff("disable" if kind == "disabled" else "reset", EMAIL, password=PASSWORD)
    elif kind == "nonstaff":
        await database.staff_identities.update_many({}, {"$set": {"role": "client"}})
        expected = 403
    else:
        client.cookies.clear()
        await database.client_identities.insert_one(
            {
                "_id": "report-client",
                "email": "report-client@example.test",
                "name": "Report Client",
                "role": "client",
                "enabled": True,
                "auth_version": "report-v1",
                "password_hash": auth.password_hash(PASSWORD),
            }
        )
        signed_in = await client.post(
            "/api/auth/client/login",
            headers={"Origin": "http://127.0.0.1:5173"},
            json={"email": "report-client@example.test", "password": PASSWORD},
        )
        assert signed_in.status_code == 200, signed_in.text
        assert client.cookies.get(client_auth.cookie_name())
        assert (await client.get("/api/auth/client/session")).status_code == 200
    response = await client.get(PATH, headers={"X-Role": "staff", "X-Actor-Id": "admin"})
    assert response.status_code == expected
    assert response.headers["cache-control"] == "no-store"
    assert not (set(response.json()) & COUNT_FIELDS)
    assert "private" not in response.text


async def test_database_failure_returns_private_error_not_counts(client, monkeypatch):
    async def unavailable(*args, **kwargs):
        raise ServerSelectionTimeoutError("private database configuration")

    monkeypatch.setattr(studio_reporting, "ensure_indexes", unavailable)
    response = await client.get(PATH)
    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    assert "private database" not in response.text
    assert not (set(response.json()) & COUNT_FIELDS)
