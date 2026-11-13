# Persistent studio enquiry inbox — Phase 2

Provision staff with the existing [operator CLI](studio-authentication.md), sign
in at `/studio`, then choose **Enquiry inbox** from studio home. The inbox reads
MongoDB's existing `booking_requests` collection; public submissions appear with
the same reference shown on the visitor's receipt. Direct inbox/detail navigation
and reload restore the session before rendering customer or private content.

## Staff operations

Filter by All statuses, New, In review or Archived. Choose a page size and Apply
filter. Next page advances through newest-first results; First page returns to
current newest results. Open a reference for the full contact details, date,
collection, venue, customer message and consent. Opening details does not change
status or record an update. Preferred dates are calendar dates displayed DD/MM/YYYY,
without timezone conversion. Received/update timestamps are explicitly **UTC**.

Edit Internal status and the shared Private studio note (plain text, at most 2,000
characters), then Save changes. A saved announcement means the server returned
its persisted update. Notes belong to authorized staff collectively; they are
never included in public receipts, Luma replies or notification payloads. Archived
records remain stored and accessible through Archived/All statuses; set New or
In review to reopen them.

Internal triage is independent of `state=awaiting_studio_confirmation`. No status
confirms a booking, holds availability, changes Luma's booking state, replies to
a customer or triggers notification delivery. There is no deletion, exports,
bulk actions, attachments, full-text search, calendar or public signup. Phase 3 adds [manual client invitations](client-invitations.md)
within detail; they leave triage and booking state unchanged.

## Concurrent editing and outages

Each detail response includes `studio_revision`. Save compares the revision
atomically and increments it once. Two writers at the same revision yield one
success and one 409; the losing draft stays in the editor. Choose **Review latest
saved version**, compare the saved note/status/revision, then choose **Keep my
draft against this revision** or **Use saved status and note**. Keeping a draft
is an explicit decision to save against that version; another intervening update
will conflict again. Refresh never silently replaces the draft. A successful
refresh alone does not report a successful save.

A 503/network timeout may leave an uncertain write: it might have persisted
before the response failed. Review the saved version before retrying. The old
revision prevents a duplicate write if it already persisted. Failed saves retain
input; list/detail service failures show retry, never an empty inbox or false
save. A missing record shows a missing-record state; invalid route/query input
shows a validation error. Navigation away/reload discards unsaved input. Drafts
live only in component memory. Sign-out, identity change, authorization denial,
expiry, and session rechecks clear private UI. Every API request revalidates current
authorization; returning to a visible tab rechecks the session as well.

## API contracts

All endpoints use the existing cookie session. Reads require `require_staff`;
PATCH requires `require_staff_write` (current staff identity, exact trusted Origin
and `X-CSRF-Token`). Roles, enabled status, authorization version, revocation and
expiry are checked in MongoDB on every request. All staff responses are no-store.

| Endpoint | Contract |
| --- | --- |
| `GET /api/studio/enquiries` | Optional `status=new\|in_review\|archived`; `limit` default 25, bounds 1–100; optional cursor, 1–512 characters. Returns `{items, next_cursor}`. |
| `GET /api/studio/enquiries/{enquiry_id}` | UUID ID, required customer/triage fields only. |
| `PATCH /api/studio/enquiries/{enquiry_id}` | JSON integer `expected_revision` (0–9,223,372,036,854,775,806) plus `studio_status` and/or `studio_note`; returns persisted detail. Unknown fields, explicit nulls and empty mutations rejected. |

List items contain `id`, `reference`, `name`, `event_type`, `preferred_date`,
`collection`, `created_at`, `studio_status`, `studio_revision`. They omit full
messages, contact details and private notes. Details additionally contain `email`,
`phone`, `venue`, `message`, `consent`, `state`, `studio_note`, `studio_updated_at`
and `studio_updated_by` (server-owned staff ID). Neither API exposes payload hashes,
notification processing data, passwords, session hashes or authorization versions.

Example mutation:

```json
{"expected_revision": 0, "studio_status": "in_review", "studio_note": "Review preferred date."}
```

Validation returns generic 422 without echoing private input. Authorized missing
records return 404; revision conflicts return 409; database failures return
generic 503. Missing/invalid sessions return 401, non-staff roles 403; untrusted
Origin or bad/missing CSRF returns 403 before any enquiry write. Actors and UTC
update timestamps come from the server, never the request.

Pagination uses the fixed sort `created_at DESC, _id DESC`, fetching at most
`limit+1` records. The URL-safe base64 JSON cursor validates version, fixed sort,
selected filter, UTC timestamp and UUID. It contains no contact data or secrets
and grants no authorization. Changing a filter resets pagination. Newer inserts
after the first page do not duplicate previously seen rows. This is live keyset
pagination, not a frozen snapshot: staff status changes during traversal can move
records into/out of a filter. Refresh First page to see newly arrived enquiries.

## Legacy records, indexes and permissions

Records without studio fields read as New, empty note, revision 0, with no update
actor/time. Reads never modify enquiry records. New public submissions receive
server-owned defaults. The first authorized update normalizes missing triage
fields in the same atomic update pipeline. No bulk migration is necessary.
Original customer content, consent, reference, creation time, payload hash, public
state and notification fields remain intact. Public identical retries retain one
record/reference; changed payload at the same request ID still returns 409.

`studio_enquiries.ensure_indexes(database)` idempotently creates these indexes
when an authorized inbox list is requested:

| Index name | Keys |
| --- | --- |
| `studio_enquiries_created_id` | `created_at: -1, _id: -1` |
| `studio_enquiries_status_created_id` | `studio_status: 1, created_at: -1, _id: -1` |

The New query uses `studio_status: {$in: ["new", null]}` to include missing legacy
status. Real MongoDB explain evidence shows indexed sorted merging for this
small equality union, without a blocking sort. Detail and revision writes use
UUID-string `_id` lookup via MongoDB's primary-key index.

The application MongoDB account requires `find`, `insert`, `update` and
`createIndex` on `booking_requests`, plus existing staff/session/login-limit
and Luma collection permissions described in the authentication/entry guides.
List requests fail closed with 503 if index initialization fails. The existing
MongoDB `readWrite` database role supplies these application operations; restrict
it to the application database and keep operator provisioning access controlled.
To initialize indexes before opening the UI, run with the intended backend env:

```bash
cd backend
python - <<'PY'
import asyncio
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('.env'))
from db import get_database, close_database_client
from studio_enquiries import ensure_indexes
try:
    asyncio.run(ensure_indexes(get_database()))
finally:
    close_database_client()
PY
```

No new configuration variables or placeholder credentials are required. Existing
TLS/cookie/CORS/same-site hosting requirements continue to apply. No deployment
manifest changed.

## Privacy and verification

Do not log request bodies, contact details, messages, private notes, Cookie/
Set-Cookie or CSRF headers in application/proxy/analytics systems. Customer content
is rendered as text. No enquiry data or credentials enter browser storage or
analytics. Only IDs, status/page settings and pagination cursors appear in studio
URLs. Database backups and retention processes must protect both customer and
shared internal content.

Run the [required gates](studio-authentication.md#verification) with real isolated
MongoDB. `web/tests/run_browser.py` executes the original public-entry and studio
authentication suites followed by `studio_inbox.py` and `client_invitations.py`. Test identities, database
seeding/cleanup and provider replacements are confined to fixtures. Successful
login/inbox requests use real API/MongoDB paths; only failures are intercepted.
No live provider traffic or real email is part of verification.

The real-MongoDB backend test contains 10,000 enquiries (2,500 legacy), deterministic
timestamp ties, all filters, bounded traversal, concurrent inserts, explain checks
and 30-request local latency samples. Set `INBOX_PERFORMANCE_OUTPUT` to a temporary
JSON path to export evidence. See the [dated verification report](../test_reports/2026-10-02-studio-enquiry-inbox-report.md)
for commands, measured results and limitations.

The detail invitation panel derives its recipient from the persisted contact.
Clients cannot access this inbox, its mutation endpoints or private staff fields.
See [client invitation operations](client-invitations.md) for copying, replacement,
revocation, atomicity and the required replica-set test infrastructure.
