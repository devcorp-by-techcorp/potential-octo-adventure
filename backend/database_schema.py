"""Complete collection/index contract for the implemented backend.

Keep names/options compatible with the feature-level lazy index setup. Collections
without secondary indexes use MongoDB's unique _id index for all current queries.
"""

from pymongo import IndexModel


def index(keys, **options):
    return IndexModel(keys, **options)


TTL = {"expireAfterSeconds": 0}
PAGE = [("created_at", -1), ("_id", -1)]
COLLECTIONS = {
    "booking_requests": [
        index(PAGE, name="studio_enquiries_created_id"),
        index([("studio_status", 1), *PAGE], name="studio_enquiries_status_created_id"),
        index(
            [(field, "text") for field in ("reference", "name", "event_type", "venue", "message")],
            name="studio_enquiry_search",
            default_language="none",
            language_override="studio_search_language",
        ),
    ],
    "luma_sessions": [index("expires_at", **TTL)],
    "staff_identities": [index("email", unique=True)],
    "staff_sessions": [index("expires_at", **TTL), index("identity_id")],
    "staff_login_limits": [index("expires_at", **TTL)],
    "client_identities": [
        index("email", unique=True),
        index([("role", 1), ("_id", 1)]),
        index([("role", 1), ("enabled", 1)], name="studio_reporting_enabled_clients"),
    ],
    "client_sessions": [index("expires_at", **TTL), index("identity_id")],
    "client_login_limits": [index("expires_at", **TTL)],
    "client_invitation_heads": [],
    "client_invitations": [
        index("token_hash", unique=True),
        index([("enquiry_id", 1), ("generation", -1)], unique=True),
        index("cleanup_at", **TTL),
    ],
    "client_access": [
        index([("client_id", 1), ("enquiry_id", 1)], unique=True),
        index([("client_id", 1), *PAGE], name="client_access_page"),
        index([("enquiry_id", 1), ("granted_at", -1), ("_id", -1)], name="enquiry_access_page"),
        index([("client_id", 1), ("_id", 1)]),
        index([("revoked_at", 1), ("client_id", 1)], name="studio_reporting_active_grants"),
    ],
    "client_recovery_tokens": [index("expires_at", **TTL)],
    "client_recovery_outbox": [
        index("expires_at", **TTL), index([("state", 1), ("expires_at", 1)]),
    ],
    "client_recovery_limits": [index("expires_at", **TTL)],
    "session_commands": [index("expires_at", **TTL)],
    "booking_resources": [],
    "bookings": [
        index("source_enquiry_id", unique=True),
        index([("state", 1), ("updated_at", -1), ("_id", -1)]),
        index([("updated_at", -1), ("_id", -1)]),
    ],
    "booking_drafts": [
        index("enquiry_id", unique=True), index([("starts_at", 1), ("_id", 1)]),
    ],
    "booking_draft_commands": [index([("actor_id", 1), ("command_id", 1)], unique=True)],
    "booking_draft_history": [index([("draft_id", 1), ("revision", 1)], unique=True)],
    "conversations": [],
    "conversation_messages": [
        index([("conversation_id", 1), ("sequence", 1)], unique=True),
        index([("conversation_id", 1), ("message_id", 1)], unique=True),
        index([("conversation_id", 1), ("sender_scope", 1), ("sequence", 1)]),
    ],
    "document_version_heads": [],
    "document_upload_heads": [],
    "document_versions": [
        index([("grant_id", 1), ("sequence", 1)], unique=True),
        index([("grant_id", 1), ("document_id", 1), ("version", 1)], unique=True),
        index([("grant_id", 1), ("published", 1), ("status", 1), ("sequence", 1)]),
    ],
    "public_content": [],
    "public_content_commands": [index([("actor_id", 1), ("command_id", 1)], unique=True)],
    "public_content_history": [index("revision", unique=True)],
}


def signature(spec):
    """Compare semantic options, including MongoDB's rewritten text-index keys."""
    keys = list(spec["key"].items())
    text_fields = [field for field, kind in keys if kind == "text"]
    weights = spec.get("weights", dict.fromkeys(text_fields, 1))
    if weights:
        keys = [(field, kind) for field, kind in keys if kind != "text" and field != "_fts"]
        keys = [(field, kind) for field, kind in keys if field != "_ftsx"]
    options = {key: spec[key] for key in (
        "expireAfterSeconds", "partialFilterExpression", "collation",
    ) if key in spec}
    for key in ("unique", "sparse", "hidden"):
        if spec.get(key, False):
            options[key] = True
    if weights:
        options.update(
            weights=dict(weights),
            default_language=spec.get("default_language", "english"),
            language_override=spec.get("language_override", "language"),
            textIndexVersion=spec.get("textIndexVersion", 3),
        )
    return keys, options


async def inspect_database(database):
    """Read-only plan; unrelated existing collections/indexes are preserved."""
    existing = set(await database.list_collection_names())
    missing_collections, missing_indexes, conflicts = [], [], []
    for name, models in COLLECTIONS.items():
        if name not in existing:
            missing_collections.append(name)
            actual = {}
        else:
            actual = {item["name"]: item async for item in database[name].list_indexes()}
        for model in models:
            wanted = model.document
            index_name = wanted["name"]
            if index_name in actual:
                if signature(actual[index_name]) != signature(wanted):
                    conflicts.append({"collection": name, "index": index_name})
            elif any(
                signature(item)[0] == signature(wanted)[0]
                and (bool(item.get("weights")) == bool(signature(wanted)[1].get("weights")))
                for item in actual.values()
            ):
                # Feature-level setup requires the same names too; surface drift.
                conflicts.append({"collection": name, "index": index_name})
            else:
                missing_indexes.append({"collection": name, "index": index_name})
    return {
        "database": database.name,
        "collection_count": len(COLLECTIONS),
        "secondary_index_count": sum(map(len, COLLECTIONS.values())),
        "missing_collections": missing_collections,
        "missing_indexes": missing_indexes,
        "conflicts": conflicts,
        "ready": not (missing_collections or missing_indexes or conflicts),
    }


async def initialize_database(database):
    """Create missing namespaces/indexes, never drop/rewrite data or indexes."""
    from pymongo.errors import CollectionInvalid

    if database.name in {"admin", "local", "config"}:
        raise RuntimeError("Select an application database, not a MongoDB system database.")
    hello = await database.client.admin.command("hello")
    if not (hello.get("setName") or hello.get("msg") == "isdbgrid"):
        raise RuntimeError("Studio Suite requires a transaction-capable replica set or mongos.")
    plan = await inspect_database(database)
    if plan["conflicts"]:
        raise RuntimeError("Existing index definitions conflict; review the read-only plan.")
    for name in plan["missing_collections"]:
        try:
            await database.create_collection(name)
        except CollectionInvalid:
            # A concurrent initializer may have created the same namespace.
            if name not in await database.list_collection_names():
                raise
    for name, models in COLLECTIONS.items():
        if models:
            await database[name].create_indexes(models)
    result = await inspect_database(database)
    if not result["ready"]:
        raise RuntimeError("Database initialization verification failed.")
    return result
