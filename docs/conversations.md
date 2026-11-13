# Private enquiry conversations

Accepted, active client access grants support persistent two-way messages between the studio and the explicitly granted client. A conversation belongs to the grant ID, never an email match. Enquiry submission and invitation issuance do not create access. Messages do not confirm bookings or reserve dates. Revoked access denies conversation reads and writes for both roles until a later explicit invitation restores access.

Clients use their own identity and cannot select another participant. Staff select an active granted client from the enquiry detail. Staff messages and read state belong to the shared studio inbox; this is not a per-staff unread counter. Internal enquiry notes and private identity metadata are excluded from message responses.

## Contracts

- Client: `/api/client/enquiries/{enquiry_id}/conversation`.
- Studio: `/api/studio/enquiries/{enquiry_id}/conversations/{client_id}`.
- `GET`: ascending sequence pagination, `after=0` and `limit=25` defaults, limit 1–100. Returns items, next_cursor, latest_sequence, read_sequence and unread_count.
- `POST /messages`: `{id: UUID, text: string}`. Text is trimmed, nonempty and at most 2000 characters. Extra fields and null characters are rejected. There are no edit/delete message endpoints.
- `POST /read`: `{sequence: integer}`. Read sequence only advances, and cannot exceed the committed conversation sequence. Only displayed messages should be acknowledged by the UI.

Clients and studio use their existing separate cookies. All writes require the appropriate origin and CSRF token. The transaction revalidates identity, session and grant, and writes to them so concurrent logout, account reset/disable and grant withdrawal conflict with message operations. Private responses retain the application's no-store middleware.

## Persistence and retries

`conversations` holds the sequence and independent client/studio read cursors. `conversation_messages` stores immutable messages, including server-owned actor, role and timestamp. Compound unique indexes enforce conversation/message UUID and conversation/sequence uniqueness. A third compound index supports unread queries. Creation is additive and compatible with existing grants and enquiries.

Each message uses a client-created UUID retained through uncertain responses. Repeating the same UUID, actor, scope and text returns the original committed message without duplication. Reusing a UUID with different text or actor returns 409. MongoDB transactions serialize sequence allocation, and require a replica set. The first response and subsequent retry use the same millisecond timestamp precision as MongoDB storage.

Refresh fetches current persisted history; Load more messages follows the bounded sequence cursor. Mark displayed messages read never advances beyond the displayed page. Unread counts include only messages from the other role. Messages are rendered as plain text; HTML is not interpreted.

## Verification

Run from the repository root against an isolated replica set:

```sh
TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/python -m pytest backend/tests/test_conversations.py
```

Tests cover persistence, exact UUID retry, duplicate concurrent requests, sequence ordering, pagination, monotonic read state, cross-account and cross-role denial, CSRF, input validation, internal-field separation, session expiry, logout, disable/reset and access withdrawal after authentication. `web/tests/conversations.py` exercises actual UI/API/MongoDB messaging across independent staff/client browser sessions, committed response loss and retry, reload, unread/read, mobile viewport overflow and revocation.

No email transport is invoked by messaging. Provider notification delivery remains blocked on an established communication policy and sandbox transport configuration. This implementation is a persistent in-application conversation workflow; it does not claim email, SMS or push delivery success.
