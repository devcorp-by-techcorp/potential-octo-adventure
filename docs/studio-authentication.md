# Studio authentication — Phase 1

`/studio` is the staff sign-in page; `/studio/home` checks the API before showing
identity and sign-out. The public landing page, enquiries, Luma and invitation-only
client access continue to work. Phase 2 adds the protected
[enquiry inbox](studio-enquiry-inbox.md) at
`/studio/enquiries` and `/studio/enquiries/:enquiryId`, using these same session
and authorization paths. There is no public signup or email recovery. Phase 3 adds separate
[client authentication and staff-issued invitations](client-invitations.md).

## Provisioning and recovery

Run the operator CLI from `backend/` in an interactive terminal with the backend
Python environment active and the intended database configured. The CLI loads
`backend/.env`, and process environment values take precedence. Verify the target
`MONGODB_URI` / `MONGODB_DB_NAME` before running. Restrict database credentials and
operator shell access to authorized administrators.

```bash
python staff.py provision staff@example.com --name "Studio Staff"
python staff.py reset staff@example.com
python staff.py disable staff@example.com
```

`provision` and `reset` prompt twice using `getpass` with terminal echo disabled.
Passwords must have 12–1024 characters. Use a unique generated password and share
it through your organization's secure channel. Password arguments, piped input,
public registration and browser-supplied roles are unsupported. Do not put
passwords in shell history, logs or environment variables. The CLI never sends
email. Provisioning an existing normalized email fails instead of overwriting it.

For recovery, verify the staff member's identity through the studio's established
operator process, run `reset`, securely deliver the new password, and ask them to
sign in at `/studio`. Reset invalidates **every** existing session immediately.
It does not enable a disabled identity. `disable` also invalidates all sessions
immediately and is the operator action for removing access. A disabled identity
must undergo an administrator review before direct database re-enablement; then
run `reset` before restoring access. This CLI intentionally offers no bulk role
changes or public recovery endpoint. Keep an authorized backup operator with
access to the database environment so losing all browser sessions cannot lock
out the studio's operator recovery process.

A successful command prints only the action. On a database error the command
exits unsuccessfully; inspect the identity state before retrying an uncertain
write. Never enable a production authentication bypass for recovery.

## Persistence and API boundaries

`staff_identities` contains a unique normalized email, display name, a
server-owned `staff` role, enabled status, Argon2id hash and random authorization
version. `argon2-cffi` uses its maintained Argon2id defaults; a successful login
rehashes older parameters without overwriting a concurrent password reset.
`staff_sessions` uses the SHA-256 hash of a cryptographically random 256-bit
opaque token as its primary key, with identity ID, authorization version,
creation/expiry times and a revocation timestamp. The raw token exists only in
the browser's HttpOnly cookie. The fixed default lifetime is eight hours, with
no sliding refresh or remember-me mode.

Every protected API request loads the session and current identity from MongoDB.
It checks expiry in application code, revocation, enabled status, role and
version. TTL indexes are storage cleanup, never an authorization mechanism.
Changing a password or disabling an account changes the identity version in a
single atomic write, invalidating sessions even if session cleanup is delayed.
Logout sets `revoked_at` before clearing the cookie. Failed logout reports a
retryable error and does not claim success. Database/configuration failures
return generic 503 responses and fail closed. Authentication responses have
`Cache-Control: no-store`; validation errors never echo submitted credentials.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/login` | JSON email/password; trusted Origin required; generic 401 on invalid, disabled or non-staff identity |
| `GET /api/auth/session` | Current staff identity plus CSRF value; 401 on absent/invalid session, 403 on non-staff role |
| `POST /api/auth/logout` | Authenticated, trusted Origin and `X-CSRF-Token` required; revokes session, clears cookie, 204 |
| `GET /api/studio/home` | Protected identity response; server-owned staff authorization |
| `GET /api/studio/enquiries`, `GET/PATCH /api/studio/enquiries/{id}` | See [inbox contracts](studio-enquiry-inbox.md#api-contracts); same read/write dependencies |

Future staff routes must use `Depends(require_staff)` for reads and
`Depends(require_staff_write)` for mutations from `auth.py`. The write dependency
includes authorization, an exact trusted Origin check, and constant-time CSRF
comparison. The CSRF value is derived from the secret session cookie and returned
by login/session; the UI holds it in memory and retrieves it again after reload.
It cannot be used as a session credential. No passwords, session tokens or CSRF
values are put in browser storage, application logs or URL parameters. Do not
configure a proxy, tracing system or request logger to capture authentication
bodies, Cookie/Set-Cookie or CSRF headers. As with any cookie authentication,
protect the frontend against script injection and restrict its hosting access.

Login throttling is shared across replicas in `staff_login_limits`: atomic
MongoDB counters permit 20 attempts per client IP and 5 per normalized email
within a fixed 15-minute window. Counters contain hashed keys and a TTL expiry;
application window keys stop expired counters from blocking new attempts even
before TTL cleanup. IP limiting runs first, bounding creation of arbitrary email
keys per source/window. Success does not reset counters. A window boundary may
allow consecutive bursts; 429 responses provide `Retry-After`. Use ingress
limits for network-wide abuse and request size limits. Uvicorn trusts only
configured proxy addresses: set `--forwarded-allow-ips` to your actual trusted
proxy network, never `*` on an internet-accessible service. Without that setup,
users behind a proxy may share one IP budget. Authentication code does not read
arbitrary forwarded headers itself.

## Supported deployment configurations

Production requires `ENVIRONMENT=production`, TLS for both browser and API,
MongoDB with permissions to read/write the three staff collections and create
indexes, and **explicit trusted frontend origins**. Examples below are example
origins, not deployed services.

| Layout | Frontend/API example | Configuration |
| --- | --- | --- |
| Same origin (recommended) | `https://studio.example.com`, `/api` reverse-proxied to FastAPI | Leave `VITE_BACKEND_URL` empty; `AUTH_ALLOWED_ORIGINS=https://studio.example.com`; use the same explicit `CORS_ORIGINS` |
| Same-site subdomains | Frontend `https://studio.example.com`; API `https://api.example.com` | Build with `VITE_BACKEND_URL=https://api.example.com`; backend `AUTH_ALLOWED_ORIGINS=https://studio.example.com` and `CORS_ORIGINS=https://studio.example.com` |
| Local development | Frontend `http://127.0.0.1:5173`; API through Vite's proxy to port 8000 | `ENVIRONMENT=development`, empty `VITE_BACKEND_URL`, default local origins; consistently use one hostname |

HTTPS subdomains must share the same registrable domain. Unrelated Railway
frontend/API domains and mixed HTTP/HTTPS sites are unsupported for staff auth:
use custom same-site domains or an API reverse proxy. Third-party cookie
exceptions are not required. CORS allows credentials for explicit origins and
supports JSON and `X-CSRF-Token` preflights. Never use a wildcard or a broad
preview-origin regex for production credentialed requests. Production settings
reject both; `AUTH_ALLOWED_ORIGINS` always requires exact origins and HTTPS in
production. If `CORS_ORIGINS` is omitted, CORS uses `AUTH_ALLOWED_ORIGINS`.
Preview origins must be explicitly listed when using staff auth.

Production cookie: `__Host-studio_session`, `HttpOnly`, `Secure`, `SameSite=Lax`,
`Path=/`, no Domain, fixed expiry and Max-Age. Development uses `studio_session`
without Secure for local HTTP. Keep session duration bounded through
`AUTH_SESSION_SECONDS` (60–604800). Cookies are host-only, so multiple browser
origins do not share the backend session cookie unless they address the same
API host. Build-time frontend variables contain only the backend origin, never
secrets. Configure `MONGODB_URI` and `MONGODB_DB_NAME` on the backend and CLI.
Startup liveness alone is insufficient: verify DB readiness and staff sign-in.

The subsequent [deployment preparation](deployment.md) provides a Caddy web
image and same-origin API proxy, including on a Railway-generated web domain.
It uses `/api/ready` for backend deploy health and adds production routing CI.
`.github/workflows/ci.yml`
is an **infrastructure change**: it now covers PRs to every branch (including the
actual default branch), pushes to main/default, runs backend tests against
MongoDB 7.0.16, and adds public-entry and studio-auth browser regressions to the
web job with Python 3.11, Node 22, pinned pnpm and Chromium. CI containers are
isolated and contain test identities only. Review runner resources, branch
protection/job requirements and permissions as infrastructure before merging.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint:web
cd backend
ruff check .
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=phase3 pytest -q
cd ..
python -m playwright install chromium
BROWSER_MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=phase3 python web/tests/run_browser.py
git diff --check
```

Activate the Python environment containing `backend/requirements-dev.txt` first.
Use the repository's pinned pnpm version. The browser runner requires free ports
8000/5173 and a dedicated local MongoDB, starts the test backend/Vite, runs
`web/tests/entry_page.py`, `web/tests/studio_auth.py`, `web/tests/studio_inbox.py`
and `web/tests/client_invitations.py`, then terminates services
and deletes **only** `studio_suite_browser_test`. Never point it at a production
MongoDB. Backend real-database tests use random `studio_suite_test_*` databases
and remove them afterwards. Without `TEST_MONGODB_URI`, older unit tests use an in-memory Mongo fixture;
Phase 3 transaction tests require a real replica set and fail rather than skip.
CI and feature verification always use real MongoDB.

Browser successes use the real API, password verification and persisted MongoDB
sessions. Luma and email are replaced only in the fixture, which has no production
imports or authentication bypass. Browser interception simulates failures only;
backend tests cover actual database exceptions. Local Chromium testing does not
verify production TLS, hosted proxy/CORS configuration, MongoDB Atlas, live
OpenAI or Resend. Validate those in the target environment without treating
mock provider success as live verification. No real emails are sent by this
verification. Phase 2 verification and operations are documented in the [inbox guide](studio-enquiry-inbox.md).

Phase 3 requires replica-set MongoDB for atomic client invitation writes. Staff
authentication remains separate; see [client operating requirements](client-invitations.md)
for the test infrastructure, client recovery CLI and session privacy boundaries.
