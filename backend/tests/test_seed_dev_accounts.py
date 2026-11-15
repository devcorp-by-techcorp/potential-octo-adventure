"""The development seed enrols real accounts through the real API paths."""

import pytest

import seed_dev_accounts
from db import get_database
from entry import _buckets

STAFF_EMAIL = "seed-staff@example.test"
STAFF_PASSWORD = "seed-staff-test-password"
CLIENT_EMAIL = "seed-client@example.test"
CLIENT_PASSWORD = "seed-client-test-password"


async def test_seed_creates_staff_and_client_through_real_paths(client):
    _buckets.clear()
    result = await seed_dev_accounts.seed(
        STAFF_EMAIL, STAFF_PASSWORD, CLIENT_EMAIL, CLIENT_PASSWORD
    )
    staff = await client.post(
        "/api/auth/token", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    )
    assert staff.status_code == 200 and staff.json()["identity"]["email"] == STAFF_EMAIL
    enrolled = await client.post(
        "/api/auth/client/token", json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}
    )
    assert enrolled.status_code == 200
    identity = await get_database().client_identities.find_one({"email": CLIENT_EMAIL})
    assert identity["role"] == "client"
    grant = await get_database().client_access.find_one({"client_id": identity["_id"]})
    assert grant["enquiry_id"] == result["enquiry_id"]
    enquiry = await get_database().booking_requests.find_one({"_id": result["enquiry_id"]})
    assert enquiry["email"] == CLIENT_EMAIL
    # Re-running is safe and creates no second account or grant.
    again = await seed_dev_accounts.seed(STAFF_EMAIL, STAFF_PASSWORD, CLIENT_EMAIL, CLIENT_PASSWORD)
    assert again["enquiry_id"] is None
    assert await get_database().client_identities.count_documents({}) == 1
    assert await get_database().client_access.count_documents({}) == 1


async def test_seed_refuses_production(monkeypatch):
    from config import get_settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="production"):
        await seed_dev_accounts.seed(STAFF_EMAIL, STAFF_PASSWORD, CLIENT_EMAIL, CLIENT_PASSWORD)
    assert await get_database().staff_identities.count_documents({}) == 0
