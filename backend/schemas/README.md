# Studio Suite collection schemas

This directory contains one MongoDB `$jsonSchema` document for each of the
**28 implemented collections** in `studio_suite`. [manifest.json](manifest.json)
links every schema to its backend source files and its indexes: 42 secondary
indexes plus 28 automatic `_id` indexes.

The definitions describe persisted BSON documents, not HTTP request/response
bodies. They are exported from [export_database_schemas.py](../export_database_schemas.py),
with index definitions drawn from [database_schema.py](../database_schema.py).

## Interpretation

- `required` identifies fields written on initial creation, except explicitly
  supported legacy fields (such as staff-triage metadata) and lifecycle fields.
  Fields absent from `required` may be omitted; null is permitted only where the
  BSON type includes `null`.
- UTC instants use BSON `date`. Enquiry/booking calendar dates use YYYY-MM-DD
  strings. Draft command payloads retain ISO strings from JSON serialization,
  while their saved results and history snapshots contain BSON dates.
- Most `_id` values are strings: UUIDs, token digests, grant IDs or composite keys.
  Messages, public-content commands and public-content history receive generated
  BSON ObjectIds. API message UUIDs are stored separately in `message_id`.
- Root and nested objects allow additional properties. Transaction fences add
  counters over time, and payload/history objects can have action-dependent fields.
  These schemas describe known fields without forbidding future compatible fields.
- `conversations` may initially contain only `_id` and a read marker: marking an
  empty conversation read does not allocate a message sequence.
- Recovery outbox ciphertext exists while delivery is pending and is removed on
  successful delivery/cancellation. Upload lease fields appear after reservation.
- Resource creation receipts and command results preserve original retry outcomes;
  they are separate from the mutable resource/content records.
- Schema enums describe representable storage states. They do not authorize state
  transitions. Booking confirmation remains blocked by the application until its
  required scheduling/approval/contract/payment checks are implemented.

These definitions **have not been installed as Atlas collection validators**.
The initialization command creates collections and indexes only. A validator
rollout needs existing-record compatibility review and a deliberate enforcement
policy before `collMod` is used. The export does not assert that every historical
or externally written record already conforms.

MongoDB uses [BSON-aware JSON Schema](https://www.mongodb.com/docs/manual/core/schema-validation/specify-json-schema/)
with differences from standard JSON Schema draft 4. In particular, `date` and
`objectId` are BSON types, and [null must be explicitly allowed](https://www.mongodb.com/docs/manual/core/schema-validation/specify-json-schema/json-schema-tips/).
Do not convert dates to strings when testing these schemas against database records.

## Regeneration and verification

From the repository root, using the backend virtual environment:

```sh
.venv/bin/python backend/export_database_schemas.py
.venv/bin/python backend/export_database_schemas.py --check
.venv/bin/pytest backend/tests/test_schema_exports.py
```

Export/check is offline and never connects to MongoDB. The checks cover complete
collection/source/index inventory, committed export freshness, BSON identifier
and date distinctions, lifecycle omissions, and enum/limit agreement with runtime
models. They do not constitute live MongoDB validator execution.

See [database initialization](../../docs/database-initialization.md) for provisioning,
expiry rules and live index readiness checks.

## Collection files

| Collection schema | Secondary indexes |
| --- | ---: |
| [booking_draft_commands](booking_draft_commands.schema.json) | 1 |
| [booking_draft_history](booking_draft_history.schema.json) | 1 |
| [booking_drafts](booking_drafts.schema.json) | 2 |
| [booking_requests](booking_requests.schema.json) | 3 |
| [booking_resources](booking_resources.schema.json) | 0 |
| [bookings](bookings.schema.json) | 3 |
| [client_access](client_access.schema.json) | 5 |
| [client_identities](client_identities.schema.json) | 3 |
| [client_invitation_heads](client_invitation_heads.schema.json) | 0 |
| [client_invitations](client_invitations.schema.json) | 3 |
| [client_login_limits](client_login_limits.schema.json) | 1 |
| [client_recovery_limits](client_recovery_limits.schema.json) | 1 |
| [client_recovery_outbox](client_recovery_outbox.schema.json) | 2 |
| [client_recovery_tokens](client_recovery_tokens.schema.json) | 1 |
| [client_sessions](client_sessions.schema.json) | 2 |
| [conversation_messages](conversation_messages.schema.json) | 3 |
| [conversations](conversations.schema.json) | 0 |
| [document_upload_heads](document_upload_heads.schema.json) | 0 |
| [document_version_heads](document_version_heads.schema.json) | 0 |
| [document_versions](document_versions.schema.json) | 3 |
| [luma_sessions](luma_sessions.schema.json) | 1 |
| [public_content](public_content.schema.json) | 0 |
| [public_content_commands](public_content_commands.schema.json) | 1 |
| [public_content_history](public_content_history.schema.json) | 1 |
| [session_commands](session_commands.schema.json) | 1 |
| [staff_identities](staff_identities.schema.json) | 1 |
| [staff_login_limits](staff_login_limits.schema.json) | 1 |
| [staff_sessions](staff_sessions.schema.json) | 2 |
