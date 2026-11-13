# MongoDB initialization

The complete schema for the implemented backend is in
`backend/database_schema.py`. It provisions **28 collections**, **42 secondary
indexes**, and MongoDB's automatic unique `_id` index on every collection.
It does not provision collections for unimplemented design-system prototypes.

The [collection schemas](../backend/schemas/README.md) contain a BSON-aware
`$jsonSchema` file for every collection, plus a source/index manifest. Regenerate
them with `.venv/bin/python backend/export_database_schemas.py`; use `--check` to
verify that committed files match their definitions. Schemas document persisted
records and are not automatically installed as Atlas validators.

Configure `MONGODB_URI` and `MONGODB_DB_NAME` for the intended database using the
backend service environment or an untracked, private environment file. The
application uses those canonical names; `ADMIN_MONGODB_URI` is not an application
configuration variable. Never commit connection credentials.

From the repository root, using the installed backend dependencies:

```sh
# Review the contract without a connection.
.venv/bin/python backend/initialize_database.py --manifest

# Read-only preview; defaults to backend/.env or the process environment.
.venv/bin/python backend/initialize_database.py

# Explicit provisioning, followed by collection/index readback.
.venv/bin/python backend/initialize_database.py --apply

# Read-only readiness check; exit 1 if anything is missing or incompatible.
.venv/bin/python backend/initialize_database.py --check
```

Each connected command also accepts `--env-file /path/to/private.env`. Existing
process environment variables take precedence over that file. Successful output
is JSON containing the database name, expected counts, missing collections,
missing indexes, conflicts and readiness. Connection strings are never printed.
Initialization is an explicit maintenance command, not an API-startup side effect.

The target must be a transaction-capable MongoDB replica set or sharded cluster.
The database principal needs collection/index inspection and creation privileges.
MongoDB system databases (`admin`, `local`, `config`) are rejected for writes.

| Collections | Index purpose |
| --- | --- |
| `booking_requests` | Staff status/creation pagination and text search over reference, name, event type, venue and message |
| `luma_sessions` | Expiry cleanup |
| `staff_identities`, `client_identities` | Unique email; client contact pagination and enabled-client reporting |
| `staff_sessions`, `client_sessions` | Identity lookup and expiry cleanup |
| `staff_login_limits`, `client_login_limits` | Expiry cleanup |
| `client_invitations` | Unique token and enquiry/generation, cleanup timestamp |
| `client_access` | Unique client/enquiry pair, client/enquiry pages, active-grant reporting |
| `client_recovery_tokens`, `client_recovery_limits`, `client_recovery_outbox` | Expiry cleanup and outbox delivery lookup |
| `session_commands` | Expiry cleanup for retry receipts |
| `bookings`, `booking_drafts` | Unique source enquiry, state/update and draft-start ordering |
| `booking_draft_commands`, `booking_draft_history` | Unique actor/command and draft/revision |
| `conversation_messages` | Unique conversation/sequence and conversation/message; unread lookup |
| `document_versions` | Unique grant/sequence and document/version; published document listing |
| `public_content_commands`, `public_content_history` | Unique actor/command and history revision |
| `booking_resources`, `client_invitation_heads`, `conversations`, `document_version_heads`, `document_upload_heads`, `public_content` | Existing queries use the automatic `_id` index |

Index names and options match existing feature-level initialization. There is no
new retention policy: only the ten expiry indexes already used by the backend
are provisioned. [TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)
can delete already-expired records after creation; they do not replace expiry
checks during authentication. Business records and history have no TTL indexes.

Repeated apply/check is supported. Existing data, unrelated collections and
unrelated indexes are preserved. The command inspects all expected indexes before
writing and stops on incompatible definitions. It never drops an index to fix
drift. Unique index builds fail if existing data violates the constraint; the
operator must resolve that separately. Provisioning is not atomic across
collections: a connection failure or failed build can leave a partial schema.
Review the read-only plan and rerun after resolving the cause.

Real MongoDB integration coverage is in `backend/tests/test_database_schema.py`:
repeatability and preservation, compatibility with every feature index builder,
concurrent uniqueness, text search/expiry definitions, conflict preflight and
topology rejection. Use an authorized disposable test server for
`TEST_MONGODB_URI`; fixtures create and drop only UUID-named test databases.
