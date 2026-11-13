"""Canonical contact roster cannot infer relationships from matching emails."""

from uuid import uuid4

import pytest

from db import get_database
from tests.test_client_invitations import ID, enrolled
from tests.test_client_invitations import setup as invitation_setup


@pytest.fixture
async def staff_headers(client):
    return await invitation_setup.__wrapped__(client)


async def test_roster_empty_persistent_scoped_and_private(client, staff_headers):
    path = "/api/studio/contacts"
    assert (await client.get(path)).json()["items"] == []
    await enrolled(client, staff_headers)
    db = get_database()
    identity = await db.client_identities.find_one({})
    row = (await client.get(path)).json()["items"][0]
    assert set(row) == {"id", "name", "email", "enabled"}
    assert row["id"] == identity["_id"]
    unrelated = str(uuid4())
    source = await db.booking_requests.find_one({"_id": ID})
    await db.booking_requests.insert_one(
        {**source, "_id": unrelated, "reference": "UNRELATED-SAME-EMAIL"}
    )
    detail = await client.get(path + "/" + row["id"])
    assert detail.status_code == 200
    assert len(detail.json()["relationships"]) == 1
    assert detail.json()["relationships"][0]["enquiry"]["id"] == ID
    assert "UNRELATED-SAME-EMAIL" not in detail.text
    assert "password_hash" not in detail.text and "studio_note" not in detail.text
    assert detail.headers["cache-control"] == "no-store"
    await db.client_access.update_one(
        {"client_id": row["id"]}, {"$set": {"revoked_at": source["created_at"]}}
    )
    assert not (await client.get(path + "/" + row["id"])).json()["relationships"][0][
        "access_active"
    ]
    client.cookies.pop("studio_session")
    assert (await client.get(path)).status_code == 401
    assert (await client.get(path + "/" + row["id"])).status_code == 401


async def test_contact_pages_missing_and_disabled_identity(client, staff_headers):
    db = get_database()
    ids = sorted(str(uuid4()) for _ in range(3))
    await db.client_identities.insert_many(
        [
            {
                "_id": key,
                "name": "Client",
                "email": key + "@example.test",
                "role": "client",
                "enabled": index != 2,
            }
            for index, key in enumerate(ids)
        ]
    )
    first = (await client.get("/api/studio/contacts?limit=1")).json()
    assert first["items"][0]["id"] == ids[0]
    second = (await client.get("/api/studio/contacts?limit=1&after=" + first["next_cursor"])).json()
    assert second["items"][0]["id"] == ids[1]
    missing = await client.get("/api/studio/contacts/" + str(uuid4()))
    assert missing.status_code == 404
    assert not (await client.get("/api/studio/contacts/" + ids[2])).json()["identity"]["enabled"]
    assert (await client.get("/api/studio/contacts?limit=101")).status_code == 422
