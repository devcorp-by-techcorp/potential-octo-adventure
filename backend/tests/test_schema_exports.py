"""Offline export checks catch inventory drift and storage/API mismatches."""

import json
from typing import get_args

from database_schema import COLLECTIONS
from export_database_schemas import ROOT, SCHEMAS, SOURCES, artifacts


def test_committed_exports_are_complete_and_current():
    generated = artifacts()
    assert set(SCHEMAS) == set(SOURCES) == set(COLLECTIONS)
    assert {p.name for p in ROOT.glob("*.json")} == set(generated)
    for name, expected in generated.items():
        assert (ROOT / name).read_text() == expected, name
    manifest = json.loads(generated["manifest.json"])
    assert manifest["validationApplied"] is False
    assert sum(len(c["indexes"]) for c in manifest["collections"].values()) == 70
    for item in manifest["collections"].values():
        for source in item["sources"]:
            assert (ROOT.parent.parent / source).is_file()


def test_bson_identifier_date_and_lifecycle_contracts():
    for name in ("conversation_messages", "public_content_commands", "public_content_history"):
        assert SCHEMAS[name]["properties"]["_id"]["bsonType"] == "objectId"
    for name in set(SCHEMAS) - {
        "conversation_messages",
        "public_content_commands",
        "public_content_history",
    }:
        assert SCHEMAS[name]["properties"]["_id"]["bsonType"] == "string"
    assert SCHEMAS["booking_requests"]["properties"]["preferred_date"]["bsonType"] == "string"
    assert SCHEMAS["bookings"]["properties"]["scheduled_date"]["bsonType"] == "string"
    assert SCHEMAS["document_versions"]["properties"]["created_at"]["bsonType"] == "date"
    assert "sequence" not in SCHEMAS["conversations"]["required"]  # Read-before-first-message.
    assert "ciphertext" not in SCHEMAS["client_recovery_outbox"]["required"]  # Removed on send.
    assert SCHEMAS["client_sessions"]["properties"]["revoked_at"]["bsonType"] == ["date", "null"]


def test_schema_enums_and_limits_match_runtime_models():
    from booking_resources import MAX_CAPACITY, ResourceInput
    from bookings import State
    from documents import TYPES, UploadBody
    from entry import Collection, EventType
    from studio_enquiries import Status

    assert SCHEMAS["bookings"]["properties"]["state"]["enum"] == list(get_args(State))
    assert SCHEMAS["booking_requests"]["properties"]["event_type"]["enum"] == list(
        get_args(EventType)
    )
    assert SCHEMAS["booking_requests"]["properties"]["collection"]["enum"] == list(
        get_args(Collection)
    )
    assert SCHEMAS["booking_requests"]["properties"]["studio_status"]["enum"] == list(
        get_args(Status)
    )
    document = SCHEMAS["document_versions"]["properties"]
    assert document["content_type"]["enum"] == list(get_args(TYPES))
    assert (
        document["size"]["maximum"]
        == UploadBody.model_json_schema()["properties"]["size"]["maximum"]
    )
    capacity = SCHEMAS["booking_resources"]["properties"]["capacity"]
    assert capacity["maximum"] == MAX_CAPACITY
    assert (
        capacity["minimum"]
        == ResourceInput.model_json_schema()["properties"]["capacity"]["minimum"]
    )


def test_schema_required_fields_and_supported_bson_types():
    def visit(value):
        if isinstance(value, dict):
            if "bsonType" in value:
                types = value["bsonType"]
                assert set([types] if isinstance(types, str) else types) <= {
                    "object",
                    "array",
                    "string",
                    "date",
                    "null",
                    "bool",
                    "int",
                    "long",
                    "objectId",
                }
            if "required" in value:
                assert set(value["required"]) <= set(value["properties"])
            for nested in value.values():
                visit(nested)
        elif isinstance(value, list):
            for nested in value:
                visit(nested)

    for schema in SCHEMAS.values():
        visit(schema)
