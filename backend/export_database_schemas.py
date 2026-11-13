"""Export reviewable MongoDB BSON schemas and an index/source manifest (offline)."""

import argparse
import json
from pathlib import Path

from database_schema import COLLECTIONS

ROOT = Path(__file__).resolve().parent / "schemas"


def field(kind, description=None, **constraints):
    return {
        "bsonType": kind,
        **({"description": description} if description else {}),
        **constraints,
    }


S = field("string")
D = field("date", "UTC instant stored as a BSON date, with millisecond precision.")
ND = field(["date", "null"])
NS = field(["string", "null"])
INTEGER = field(["int", "long"], minimum=0)
B = field("bool")
OID = field("objectId", "MongoDB-generated ObjectId; not an API UUID.")
DATE_STRING = field(
    "string", "Calendar date stored as YYYY-MM-DD text.", pattern=r"^\d{4}-\d{2}-\d{2}$"
)


def choice(*values):
    return field("string", enum=list(values))


def obj(properties, required=()):
    return field(
        "object",
        properties=properties,
        **({"required": list(required)} if required else {}),
        additionalProperties=True,
    )


def array(item):
    return field("array", items=item)


def record(properties, optional=()):
    return obj(properties, [key for key in properties if key not in optional])


COUNTERS = dict.fromkeys(
    (
        "authorization_checks",
        "transaction_checks",
        "booking_checks",
        "content_checks",
        "conversation_checks",
        "session_management_checks",
        "acceptance_checks",
        "access_revision",
    ),
    INTEGER,
)
IDENTITY = {
    "_id": S,
    "email": S,
    "name": S,
    "enabled": B,
    "password_hash": S,
    "auth_version": S,
    "created_at": D,
    "updated_at": D,
    **COUNTERS,
}
SESSION = {
    "_id": field("string", "SHA-256 digest of the opaque session token; never the raw token."),
    "identity_id": S,
    "auth_version": S,
    "created_at": D,
    "expires_at": D,
    "revoked_at": ND,
    **COUNTERS,
}
LIMIT = record({"_id": S, "attempts": INTEGER, "expires_at": D})
CONTENT = record(
    {
        "hero_description": field("string", minLength=1, maxLength=1000),
        "hero_footnote": field("string", minLength=1, maxLength=200),
        "philosophy_title": field("string", minLength=1, maxLength=200),
        "philosophy_description": field("string", minLength=1, maxLength=1000),
    }
)
CONTENT_STATE = record(
    {
        "draft": CONTENT,
        "published": CONTENT,
        "revision": INTEGER,
        "published_revision": field(["int", "long", "null"]),
        "updated_at": ND,
    }
)
EVENT = obj({"action": S, "actor_id": S, "at": D}, ("action", "actor_id", "at"))
RESOURCE_INPUT = record(
    {
        "kind": choice("photographer", "assistant", "studio_room", "equipment"),
        "name": field("string", minLength=1, maxLength=120),
        "capacity": field(["int", "long"], minimum=1, maximum=2**53 - 1),
    }
)
RESOURCE = record(
    {
        "_id": S,
        **RESOURCE_INPUT["properties"],
        "enabled": B,
        "revision": INTEGER,
        "created_at": D,
        "updated_at": D,
    }
)
DRAFT = record(
    {
        "_id": S,
        "enquiry_id": S,
        "reference": S,
        "state": choice("draft", "cancelled"),
        "starts_at": D,
        "ends_at": D,
        "timezone": S,
        "revision": INTEGER,
        "created_at": D,
        "updated_at": D,
    }
)
DRAFT_PAYLOAD = obj(
    {
        "enquiry_id": S,
        "draft_id": S,
        "command_id": S,
        "expected_revision": INTEGER,
        "starts_at": field("string", "ISO date/time from Pydantic JSON-mode serialization."),
        "ends_at": S,
        "timezone": S,
        "action": choice("reschedule", "cancel", "confirm"),
    }
)
SCHEMAS = {
    "booking_requests": record(
        {
            "_id": S,
            "name": S,
            "email": S,
            "phone": S,
            "event_type": choice(
                "Wedding", "Editorial", "Family", "Portrait", "Brand / Commercial", "Other"
            ),
            "preferred_date": DATE_STRING,
            "collection": choice("essentials", "signature", "atelier", "undecided"),
            "venue": S,
            "message": S,
            "consent": field("bool", enum=[True]),
            "payload_hash": S,
            "state": choice("awaiting_studio_confirmation"),
            "created_at": D,
            "reference": S,
            "notification_state": choice("pending", "not_configured", "sending", "sent", "failed"),
            "notification_attempted_at": D,
            "studio_status": choice("new", "in_review", "archived"),
            "studio_note": S,
            "studio_revision": INTEGER,
            "studio_updated_at": ND,
            "studio_updated_by": NS,
        },
        (
            "notification_attempted_at",
            "studio_status",
            "studio_note",
            "studio_revision",
            "studio_updated_at",
            "studio_updated_by",
        ),
    ),
    "luma_sessions": record(
        {
            "_id": S,
            "booking_state": choice("collecting", "awaiting_studio_confirmation"),
            "history": array(record({"role": choice("user", "assistant"), "content": S})),
            "draft": obj(
                {
                    "name": S,
                    "email": S,
                    "phone": S,
                    "event_type": S,
                    "preferred_date": S,
                    "collection": S,
                    "venue": S,
                    "message": S,
                }
            ),
            "revision": INTEGER,
            "expires_at": D,
            "booking_id": S,
        },
        ("booking_id",),
    ),
    "staff_identities": record({**IDENTITY, "role": choice("staff")}, ("updated_at", *COUNTERS)),
    "client_identities": record({**IDENTITY, "role": choice("client")}, ("updated_at", *COUNTERS)),
    "staff_sessions": record(SESSION, tuple(COUNTERS)),
    "client_sessions": record({**SESSION, "scope": choice("client")}, tuple(COUNTERS)),
    "staff_login_limits": LIMIT,
    "client_login_limits": LIMIT,
    "client_recovery_limits": LIMIT,
    "client_invitation_heads": record({"_id": S, "generation": INTEGER}),
    "client_invitations": record(
        {
            "_id": S,
            "enquiry_id": S,
            "email": S,
            "generation": INTEGER,
            "token_hash": S,
            "status": choice("pending", "accepted", "revoked"),
            "issued_by": S,
            "created_at": D,
            "expires_at": D,
            "cleanup_at": D,
            "revoked_at": D,
            "accepted_by": S,
            "accepted_at": D,
            "enrolled": B,
        },
        ("revoked_at", "accepted_by", "accepted_at", "enrolled"),
    ),
    "client_access": record(
        {
            "_id": S,
            "client_id": S,
            "enquiry_id": S,
            "created_at": D,
            "granted_at": D,
            "invitation_id": S,
            "revoked_at": ND,
            "revoked_by": NS,
            "access_checks": INTEGER,
            "conversation_checks": INTEGER,
            "history": array(obj({**EVENT["properties"], "invitation_id": S}, EVENT["required"])),
        },
        ("revoked_at", "revoked_by", "access_checks", "conversation_checks", "history"),
    ),
    "client_recovery_tokens": record(
        {
            "_id": S,
            "identity_id": S,
            "auth_version": S,
            "created_at": D,
            "expires_at": D,
            "consumed_at": ND,
        }
    ),
    "client_recovery_outbox": record(
        {
            "_id": S,
            "token_hash": S,
            "identity_id": S,
            "auth_version": S,
            "ciphertext": S,
            "state": choice("pending", "sending", "failed", "sent", "cancelled"),
            "attempts": INTEGER,
            "created_at": D,
            "expires_at": D,
            "claim": S,
            "attempted_at": D,
            "sent_at": D,
        },
        ("ciphertext", "claim", "attempted_at", "sent_at"),
    ),
    "session_commands": record(
        {
            "_id": field("string", "scope:session-token-digest:command-UUID composite key."),
            "result": record({"revoked_count": INTEGER}),
            "created_at": D,
            "expires_at": D,
        }
    ),
    "booking_resources": record(
        {
            **RESOURCE["properties"],
            "creation_input": RESOURCE_INPUT,
            "creation_receipt": RESOURCE,
            "history": array(
                obj(
                    {
                        **EVENT["properties"],
                        "before": obj({}),
                        "after": obj({}),
                    },
                    EVENT["required"],
                )
            ),
        }
    ),
    "bookings": record(
        {
            "_id": S,
            "source_enquiry_id": S,
            "reference": S,
            "client_name": S,
            "event_type": S,
            "scheduled_date": DATE_STRING,
            "location": S,
            "staff_note": S,
            "state": choice(
                "planning",
                "confirmed",
                "preparation",
                "shoot",
                "gallery_preparation",
                "delivered",
                "cancelled",
            ),
            "revision": INTEGER,
            "created_at": D,
            "updated_at": D,
            "history": array(record({"from": NS, "to": S, "actor_id": S, "at": D})),
        }
    ),
    "booking_drafts": DRAFT,
    "booking_draft_commands": record(
        {
            "_id": S,
            "actor_id": S,
            "command_id": S,
            "payload": DRAFT_PAYLOAD,
            "result": DRAFT,
        }
    ),
    "booking_draft_history": record(
        {
            "_id": S,
            "draft_id": S,
            "revision": INTEGER,
            "actor_id": S,
            "at": D,
            "action": choice("created", "reschedule", "cancel"),
            "snapshot": obj(
                {k: v for k, v in DRAFT["properties"].items() if k != "_id"},
                [k for k in DRAFT["required"] if k != "_id"],
            ),
        }
    ),
    "conversations": record(
        {
            "_id": field("string", "Client access grant ID; conversations are grant-scoped."),
            "sequence": INTEGER,
            "studio_read": INTEGER,
            "client_read": INTEGER,
        },
        ("sequence", "studio_read", "client_read"),
    ),
    "conversation_messages": record(
        {
            "_id": OID,
            "conversation_id": S,
            "message_id": S,
            "sequence": INTEGER,
            "sender_scope": choice("studio", "client"),
            "actor_id": S,
            "text": field("string", minLength=1, maxLength=2000),
            "created_at": D,
        }
    ),
    "document_version_heads": record({"_id": S, "version": INTEGER}),
    "document_upload_heads": record({"_id": S, "sequence": INTEGER}),
    "document_versions": record(
        {
            "_id": S,
            "document_id": S,
            "title": field("string", minLength=1, maxLength=160),
            "filename": field("string", minLength=1, maxLength=160),
            "content_type": choice("application/pdf", "image/png", "image/jpeg"),
            "size": field(["int", "long"], minimum=1, maximum=100 * 1024 * 1024),
            "sha256": field("string", pattern="^[0-9a-f]{64}$"),
            "grant_id": S,
            "enquiry_id": S,
            "client_id": S,
            "version": INTEGER,
            "sequence": INTEGER,
            "storage_backend": S,
            "object_key": S,
            "status": choice("uploading", "ready", "failed"),
            "published": B,
            "revision": INTEGER,
            "created_at": D,
            "created_by": S,
            "history": array(EVENT),
            "lease": S,
            "lease_until": D,
        },
        ("lease", "lease_until"),
    ),
    "public_content": record(
        {"_id": field("string", enum=["site"]), **CONTENT_STATE["properties"]}
    ),
    "public_content_commands": record(
        {
            "_id": OID,
            "actor_id": S,
            "command_id": S,
            "payload": obj(
                {
                    "action": choice("save", "restore", "publish"),
                    "command_id": S,
                    "expected_revision": INTEGER,
                    "content": CONTENT,
                    "source_revision": INTEGER,
                },
                ("action", "command_id", "expected_revision"),
            ),
            "result": CONTENT_STATE,
        }
    ),
    "public_content_history": record(
        {
            "_id": OID,
            "revision": INTEGER,
            "action": choice("save", "restore", "publish"),
            "actor_id": S,
            "at": D,
            "content": CONTENT,
        }
    ),
}
SOURCES = {
    "booking_requests": ["entry.py", "studio_enquiries.py", "notifications.py"],
    "luma_sessions": ["entry.py"],
    "staff_identities": ["staff.py", "auth.py", "account_sessions.py"],
    "staff_sessions": ["auth.py", "account_sessions.py"],
    "staff_login_limits": ["auth.py"],
    "client_identities": ["client_access.py", "clients.py", "client_recovery.py"],
    "client_sessions": ["client_auth.py", "client_access.py", "account_sessions.py"],
    "client_login_limits": ["client_auth.py", "auth.py"],
    "client_recovery_limits": ["client_recovery.py", "auth.py"],
    "client_invitation_heads": ["client_access.py"],
    "client_invitations": ["client_access.py"],
    "client_access": ["client_access.py", "conversations.py"],
    "client_recovery_tokens": ["client_recovery.py"],
    "client_recovery_outbox": ["client_recovery.py"],
    "session_commands": ["account_sessions.py"],
    "booking_resources": ["booking_resources.py"],
    "bookings": ["bookings.py"],
    "booking_drafts": ["booking_drafts.py"],
    "booking_draft_commands": ["booking_drafts.py"],
    "booking_draft_history": ["booking_drafts.py"],
    "conversations": ["conversations.py"],
    "conversation_messages": ["conversations.py"],
    "document_version_heads": ["documents.py"],
    "document_upload_heads": ["documents.py"],
    "document_versions": ["documents.py"],
    "public_content": ["public_content.py"],
    "public_content_commands": ["public_content.py"],
    "public_content_history": ["public_content.py"],
}


def artifacts():
    if set(SCHEMAS) != set(COLLECTIONS) or set(SOURCES) != set(COLLECTIONS):
        raise RuntimeError("Collection, schema and source inventories differ.")
    result = {
        f"{name}.schema.json": {"$jsonSchema": {"title": name, **schema}}
        for name, schema in sorted(SCHEMAS.items())
    }
    result["manifest.json"] = {
        "schemaVersion": 1,
        "database": "studio_suite",
        "validationApplied": False,
        "collections": {
            name: {
                "schema": f"{name}.schema.json",
                "sources": [f"backend/{source}" for source in SOURCES[name]],
                "indexes": [{"key": {"_id": 1}, "name": "_id_", "unique": True}]
                + [dict(model.document) for model in COLLECTIONS[name]],
            }
            for name in sorted(COLLECTIONS)
        },
    }
    return {name: json.dumps(value, indent=2) + "\n" for name, value in result.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if committed exports are stale")
    args = parser.parse_args()
    generated = artifacts()
    if args.check:
        stale = [
            name
            for name, value in generated.items()
            if not (ROOT / name).exists() or (ROOT / name).read_text() != value
        ]
        stale += sorted({p.name for p in ROOT.glob("*.json")} - set(generated))
        if stale:
            print("Stale schema artifacts: " + ", ".join(stale))
            return 1
        print("28 collection schemas and index/source manifest are current.")
    else:
        ROOT.mkdir(parents=True, exist_ok=True)
        for name, value in generated.items():
            (ROOT / name).write_text(value)
        print("Exported 28 collection schemas and index/source manifest.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
