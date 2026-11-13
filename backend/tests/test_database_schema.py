"""Provisioning contracts verified against an isolated real MongoDB database."""

import asyncio
import os
from unittest.mock import AsyncMock

import pytest
from pymongo.errors import DuplicateKeyError

from database_schema import COLLECTIONS, initialize_database, inspect_database
from db import get_database

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_MONGODB_URI"), reason="Requires real MongoDB replica set"
)


async def test_complete_repeatable_initialization_preserves_records():
    database = get_database()
    before = await inspect_database(database)
    assert not before["ready"]
    assert await database.list_collection_names() == []  # Inspect does not create namespaces.
    result = await initialize_database(database)
    assert result["ready"]
    assert set(await database.list_collection_names()) == set(COLLECTIONS)
    await database.public_content.insert_one({"_id": "sentinel", "value": "preserved"})
    indexes = {name: await database[name].index_information() for name in COLLECTIONS}
    assert await initialize_database(database) == result
    assert await database.public_content.find_one({"_id": "sentinel"}) == {
        "_id": "sentinel", "value": "preserved",
    }
    assert indexes == {name: await database[name].index_information() for name in COLLECTIONS}


async def test_existing_feature_index_builders_remain_compatible():
    from auth import ensure_indexes as staff_indexes
    from booking_drafts import indexes as draft_indexes
    from bookings import ensure_indexes as booking_indexes
    from client_access import ensure_indexes as access_indexes
    from client_recovery import ensure_indexes as recovery_indexes
    from conversations import ensure_indexes as message_indexes
    from documents import ensure_indexes as document_indexes
    from enquiry_operations import ensure_indexes as search_indexes
    from public_content import indexes as content_indexes
    from studio_enquiries import ensure_indexes as enquiry_indexes
    from studio_reporting import ensure_indexes as reporting_indexes

    database = get_database()
    await initialize_database(database)
    for builder in (
        staff_indexes, draft_indexes, booking_indexes, access_indexes, recovery_indexes,
        message_indexes, document_indexes, search_indexes, content_indexes, enquiry_indexes,
        reporting_indexes,
    ):
        await builder(database)
    assert (await inspect_database(database))["ready"]


async def test_unique_indexes_enforce_concurrent_identity_and_command_writes():
    database = get_database()
    await initialize_database(database)
    for name, value in (
        ("staff_identities", {"email": "unique@example.test"}),
        ("client_identities", {"email": "unique@example.test"}),
        ("booking_draft_commands", {"actor_id": "actor", "command_id": "command"}),
        ("client_access", {"client_id": "client", "enquiry_id": "enquiry"}),
    ):
        outcomes = await asyncio.gather(
            database[name].insert_one(dict(value)),
            database[name].insert_one(dict(value)),
            return_exceptions=True,
        )
        assert sum(isinstance(item, DuplicateKeyError) for item in outcomes) == 1
        assert await database[name].count_documents({}) == 1


async def test_text_search_and_expiry_contract():
    database = get_database()
    await initialize_database(database)
    await database.booking_requests.insert_one({"_id": "search", "venue": "Harbour Wedding"})
    assert await database.booking_requests.count_documents({"$text": {"$search": "Harbour"}}) == 1
    assert await database.booking_requests.count_documents({"$text": {"$search": "missing"}}) == 0
    for name in (
        "luma_sessions", "staff_sessions", "client_sessions", "staff_login_limits",
        "client_login_limits", "client_recovery_tokens", "client_recovery_outbox",
        "client_recovery_limits", "session_commands",
    ):
        info = await database[name].index_information()
        assert info["expires_at_1"]["expireAfterSeconds"] == 0
    invitation_indexes = await database.client_invitations.index_information()
    assert invitation_indexes["cleanup_at_1"]["expireAfterSeconds"] == 0
    # Business records/history have no automatic deletion policy.
    for name in ("booking_requests", "bookings", "document_versions", "conversation_messages"):
        assert all("expireAfterSeconds" not in i
                   for i in (await database[name].index_information()).values())


async def test_conflict_preflight_makes_no_changes():
    database = get_database()
    await database.staff_identities.create_index("email")  # Missing uniqueness.
    before = await database.staff_identities.index_information()
    plan = await inspect_database(database)
    assert plan["conflicts"] == [{"collection": "staff_identities", "index": "email_1"}]
    with pytest.raises(RuntimeError, match="conflict"):
        await initialize_database(database)
    assert await database.list_collection_names() == ["staff_identities"]
    assert await database.staff_identities.index_information() == before


async def test_standalone_topology_rejected_before_writes(monkeypatch):
    database = get_database()
    monkeypatch.setattr(type(database.client.admin), "command", AsyncMock(return_value={"ok": 1}))
    with pytest.raises(RuntimeError, match="replica set"):
        await initialize_database(database)
    assert await database.list_collection_names() == []
