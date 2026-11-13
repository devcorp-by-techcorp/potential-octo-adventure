# Client invitations and read-only enquiry access — Phase 3

Staff sign in at `/studio`, open an existing enquiry in the inbox, and use
**Issue invitation**. The server derives the intended email from that saved
record and normalizes it with the same trim/casefold convention as staff login.
The browser cannot choose a recipient, owner, identity, role or grant. The link
is shown only in the successful issuance response. Use **Copy invitation link**
and deliver it through an existing trusted channel. This feature composes and
sends no emails. Treat the link as a temporary enrollment secret; do not paste
it into public tickets, analytics or logs.

**Refresh invitation status** shows pending, accepted, revoked or expired.
History is paged in groups of 25. **Revoke pending invitation** prevents later
acceptance. Issuing again atomically revokes every still-valid pending link for
that enquiry and creates one replacement. It cannot restore an obsolete link.
If issuance times out, check status; the write may have completed. The secret
cannot be retrieved again: issue a replacement if the successful link was lost.
Accepted access is durable; revoking a pending replacement does not remove an
already accepted grant. Removing a client's access in this phase uses operator
account disable, rather than a new per-grant administration feature.

An invitation defaults to **24 hours**. `CLIENT_INVITATION_SECONDS` accepts
60–604800 seconds (at most seven days). Status and acceptance enforce expiry in
application code even before TTL cleanup. Invitation audit documents are kept
until 14 days after issuance, then TTL cleanup may remove them. Accounts and
accepted grants remain; an old link may consequently show invalid rather than
its former status. All shown timestamps are labelled UTC. Preferred dates are
calendar dates, displayed without timezone conversion.

## Client operation

Open the original `/client/accept#<secret>` link. The frontend captures the
fragment in memory and removes it with `history.replaceState` before rendering
forms or requesting session/invitation information. Only POST JSON bodies carry
the invitation secret. Reloading the scrubbed URL loses the in-memory secret;
reopen the original link if needed. No password, session credential, identity,
customer content or CSRF token is embedded in the link.

A new client chooses a 12–1024 character password and accepts. The server creates
an enabled, server-owned client identity and grants only this enquiry. The client
then sees its original reference and customer-facing content. There is no public
registration and matching an enquiry email grants no access by itself.

If that normalized email already has an account, sign in as that **matching
client** on the acceptance page, then accept. The authenticated acceptance also
requires client CSRF verification. A different signed-in identity must sign out
and use the intended account. An invitation cannot replace, reset or overwrite
existing credentials; even enrollment racing with another invitation must
resolve through the existing-account path once that account exists.

Subsequent sign-in is at `/client`; `/client/home` lists explicitly granted
enquiries, and `/client/enquiries/:id` shows read-only details. Reload and another
authenticated browser read the same durable grants. **Sign out** durably revokes
the session before clearing its cookie. A failed sign-out reports retry, and a
session denial clears private UI. Session restoration precedes private rendering;
identity changes, expiry, denial and returning to a visible tab recheck access.
Abort controllers prevent stale requests from populating a departed view. Request
timeouts are bounded to 15 seconds. CSRF and private content live only in memory;
the existing theme preference is the only stored UI setting used here.

## Privacy and booking boundaries

Every client request checks its own opaque session, explicit `client` scope,
current enabled identity, server role, authorization version, revocation and
application expiry. Each enquiry request additionally checks the explicit
`client_access` relationship. Neither cookie can substitute for the other role:
development uses `client_session` versus `studio_session`; production uses
`__Host-client_session` versus `__Host-studio_session`. Client cookies are
HttpOnly, host-only, Path=/, SameSite=Lax, and Secure in production. Sessions use
256-bit random opaque credentials; MongoDB stores SHA-256 hashes only. Passwords
use the shared Argon2id primitive. The fixed session lifetime uses the existing
`AUTH_SESSION_SECONDS` default of eight hours, bounded to 60–604800 seconds.

Client responses allow only ID, reference, name, email, phone, event type,
preferred date, collection, venue, original message, consent, creation time and
`awaiting_studio_confirmation`. The database projection and response model both
exclude operational hashes, notification processing, private notes, triage,
staff actors/revisions/update times and arbitrary future studio fields. Customer
content renders as text. Staff retain their full inbox and private triage.

Invitation issuance and acceptance never modify the enquiry, submission,
notification process, triage, Luma state or availability. An enquiry remains
**awaiting studio confirmation**; access never confirms a booking. Editing,
media, scheduling, contracts, payments, exports, deletion and bulk invitations
remain outside Phase 3.

## Atomicity and uncertain responses

MongoDB transactions with snapshot reads and majority writes commit enrollment
(if needed), the single-use acceptance transition, explicit access grant and
hashed session together. An existing client's identity/session writes fence
acceptance against concurrent operator reset/disable and logout. A unique
normalized-email index prevents duplicate accounts; a unique client/enquiry
index prevents duplicate grants. Exactly one competing normal acceptance
completes; losing requests report a used invitation or matching-account action.
A small bounded retry obtains a new snapshot for cross-invitation unique-index
conflicts. Driver transaction retries handle transient write conflicts and
uncertain commits; no success response precedes durable completion.

Concurrent issuance writes a per-enquiry generation head so only one current
pending link survives. Acceptance, replacement and revocation contend on the
invitation document. If acceptance commits first, it wins and revocation reports
no longer pending; a replacement can still issue a new link. If revocation or
replacement commits first, acceptance retries against the revoked status and
fails. Acceptance cannot succeed after a committed revocation. Expiry is checked
at the conditional single-use transition and TTL never authorizes access.

If the acceptance response fails, **Recover completed acceptance** verifies the
committed invitation and existing grant. A completed enrollment requires its
original password (verified against the current account hash), or a matching
current client session with CSRF. A completed existing-account acceptance
requires that matching session; an invitation does not authenticate an existing
account by itself. Recovery issues a fresh scoped session without creating an
identity or grant. Recovery remains available only until the original invitation
expiry. Afterwards sign in normally and inspect the granted enquiry. If recovery
finds the invitation still pending, it reports that no acceptance completed:
check status and accept again. If the account was disabled/reset, use normal
sign-in or operator recovery. Password errors and service failures never echo
private inputs.

An uncertain response can install its session cookie before the response body
is lost. The acceptance page therefore rechecks the real session and restores
its CSRF value in memory before offering recovery. This check does not claim
that acceptance succeeded or navigate to private enquiry content. If no current
session can be verified, completed enrollment recovery still requires the
password. Failed recovery never creates another grant. Reopening a used link
with an expired session requires normal client sign-in.

## Operator recovery

Use the backend environment, verify the target database and verify the client's
identity through the studio's established process:

```bash
cd backend
python clients.py reset client@example.com
python clients.py disable client@example.com
```

Reset prompts twice with terminal echo disabled, rejects non-interactive input,
and accepts no password arguments. Both actions change the authorization version
atomically and invalidate every existing client session immediately. Reset never
enables a disabled account or changes grants. Disable prevents sign-in and read
access. Re-enablement requires administrator review and an operator reset before
restoring access; this CLI has no automatic enable, provision, email delivery,
bulk operation or public email-recovery workflow. Securely deliver a new password
through the studio's trusted recovery channel. Check identity state before
retrying an uncertain operator write. Keep shell/database access restricted.

## Endpoint contracts

All authentication and private responses, including denials and validation
errors, use `Cache-Control: no-store`. JSON write models forbid unknown fields.
Explicit response models also allowlist invitation status, issuance, inspection,
acceptance and client identity/session fields; only issuance can return a link.
Trusted Origin checks use existing exact `AUTH_ALLOWED_ORIGINS`; authenticated
mutations require `X-CSRF-Token`. Login/enrollment/recovery share MongoDB counters
for 20 attempts/IP and 5/normalized email per 15-minute fixed window. IP limiting
runs before account-key creation and password hashing. Success does not reset
limits. 429 includes Retry-After. The staff budget remains distinct. Configure
trusted proxy handling and ingress limits as in the staff guide.

| Endpoint | Contract |
| --- | --- |
| `POST /api/studio/enquiries/{id}/client-invitations` | Staff write, `{}`; returns status and one-time fragment link |
| `GET /api/studio/enquiries/{id}/client-invitations` | Staff read; bounded history with optional positive generation cursor |
| `POST /api/studio/client-invitations/{id}/revoke` | Staff write, `{}`; only a still-valid pending invitation |
| `POST /api/auth/client/invitations/inspect` | Trusted Origin, `{token}`; pending mode/derived email, or lifecycle status; no secret returned |
| `POST /api/auth/client/invitations/accept` | Trusted Origin, `{token, password? , recover?}`; authenticated requests require client CSRF; password only for new enrollment or its completed recovery |
| `POST /api/auth/client/login` | Trusted Origin, `{email,password}`; generic invalid-credentials denial |
| `GET /api/auth/client/session` | Current client identity, expiry and memory-only CSRF |
| `POST /api/auth/client/logout` | Client write, `{}`; durable revocation, 204 |
| `GET /api/client/enquiries` | Client read; `limit` 1–100, default 25; bounded keyset cursor |
| `GET /api/client/enquiries/{id}` | Client read plus explicit grant; inaccessible/missing IDs use the same 404 |

## Database and infrastructure

**Production requires a MongoDB replica set (or sharded deployment supporting
transactions)**; standalone MongoDB cannot support Phase 3 writes. Atlas replica
sets work with their normal driver URI. Configure `MONGODB_URI` and
`MONGODB_DB_NAME` for the API and operator CLI. Use TLS, production environment,
explicit trusted HTTPS origins and same-origin/same-site API hosting as in
[staff authentication](studio-authentication.md). Do not capture authentication
bodies, invitation POST bodies, Cookie/Set-Cookie or CSRF headers in proxy,
request, tracing or analytics logs. This feature adds no analytics.

The application database principal needs read/write and collection/index creation
on `client_identities`, `client_sessions`, `client_login_limits`,
`client_invitations`, `client_invitation_heads`, `client_access`, plus existing
read permission on `booking_requests` and staff authentication collections.
Transactions must be permitted. Index setup is repeatable and non-destructive;
authorized issuance/status/client list/login initialize the appropriate indexes.
To initialize all client indexes before serving requests:

```bash
cd backend
python - <<'PY'
import asyncio
import server  # loads backend .env
from client_access import ensure_indexes
from db import get_database, close_database_client
try:
    asyncio.run(ensure_indexes(get_database()))
finally:
    close_database_client()
PY
```

| Collection | Index purpose |
| --- | --- |
| client_identities | Unique normalized email; primary identity ID |
| client_sessions | Primary token hash; identity lookup; expiry TTL |
| client_login_limits | Primary hashed window key; expiry TTL |
| client_invitations | Unique token hash; unique enquiry/generation history; cleanup TTL |
| client_invitation_heads | Primary enquiry ID serializes issue/replacement |
| client_access | Unique client/enquiry pair; client/creation-desc/grant-ID-desc keyset index |

No migration or enquiry rewrite is needed. Repeated setup preserves existing
records. Client lists fetch at most limit+1 grants and limit original enquiries;
no unbounded production loads. Creation time plus grant UUID provides a stable
descending cursor, including ties. Newer grants appear on a fresh first page.

CI's `backend/tests/start_mongodb.sh` starts disposable **mongo:7.0.16** with
`--replSet phase3 --bind_ip_all`, initializes a single member advertising
`127.0.0.1:27017`, and waits for primary readiness. This is test infrastructure,
not a production topology or deployment. For a fresh local MongoDB binary:

```bash
mongod --dbpath /your/isolated/test-data --bind_ip 127.0.0.1 --port 27017 --replSet phase3
# In another terminal (fresh replica set only):
mongosh --eval 'rs.initiate({_id:"phase3",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

After primary readiness, run the required gates with Python 3.11, Node 20 and
pnpm 10.34.3. Build shared tokens before starting browser fixtures:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint:web
cd backend
ruff check .
TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' pytest -q
cd ..
python -m playwright install chromium
BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' python web/tests/run_browser.py
git diff --check
```

Never use production MongoDB for fixtures. Backend tests create/drop random
`studio_suite_test_*` databases; browser tests create/drop only
`studio_suite_browser_test`, start/stop fixture processes and run all four suites.
New transaction tests require a real replica set and fail explicitly if missing;
they do not substitute a mock or silently skip. Luma and notifications are
fixture replacements with live credentials disabled. No real email is sent.


## Per-enquiry client access withdrawal

Staff can inspect accepted access and revoke an individual grant from the enquiry detail screen. The list shows at most the 100 most recently granted identities and uses an enquiry/grant-time index; identity reads are batched. Missing identities remain visible as unavailable identities so orphaned grants can still be withdrawn.

Withdrawal requires staff authentication, an allowed Origin and a staff CSRF token. The transaction records the staff actor and UTC timestamp, appends one grant-history event, and revokes pending invitations for that enquiry. Retries return the same persisted withdrawal timestamp. Other enquiry grants and the client account remain unchanged. Client list/detail endpoints immediately exclude withdrawn grants; existing invitation acceptance recovery cannot restore them. Restoration requires a newly issued invitation and explicit client acceptance. Concurrent recovery is fenced by a transactional grant write; invitation issuance and withdrawal serialize through the enquiry invitation head.

The automated replica-set tests cover persistence, retry equality, orphan identities, concurrent withdrawals, recovery racing withdrawal, cross-role denial, and unaffected grants. The real-endpoint browser suite covers staff withdrawal, denial after reload, and restoration through a new invitation. None of these transitions reserves availability or confirms a booking.
