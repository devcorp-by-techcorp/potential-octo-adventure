# 2026-10-02 — Phase 1 studio authentication

## Baseline and scope

Repository: `devcorp-by-techcorp/studio-suite_v2`.
Actual starting commit: `e50717002c05b41fd7a78a1126cc7c8d10fe1554`, the assessed
baseline and fetched default-branch HEAD on
`claude/illuminate-gallery-rebuild-deploy-dy6bie`. Created
`feature/phase-1-studio-authentication` directly from that commit. The initial
checkout was clean; no unrelated user changes were present. No applicable
`AGENTS.md` files were found. Inspected README, entry-page documentation,
existing application/configuration, tests and CI before implementation.

The requested PR targets `main`, still at
`d4fccd978aee3184f0482423909478cc365f6703` when verified remotely. Consequently
the PR includes the assessed public entry-page implementation already present
on the default branch as well as this feature. The Phase 1 review diff is
`git diff e50717002c05b41fd7a78a1126cc7c8d10fe1554...feature/phase-1-studio-authentication`.
No merge, deployment or real email was performed.

## Implementation

- MongoDB staff identities with unique normalized emails, server-owned staff
  roles, enabled status, authorization versions and Argon2id password hashes
  through pinned `argon2-cffi` 25.1.0. No public registration or recovery API.
- Cryptographically random 256-bit opaque session credentials; MongoDB stores
  only SHA-256 token hashes, explicit creation/expiry and revocation timestamps.
  Every protected API checks current identity, role, version, expiry and
  revocation independently of TTL cleanup. Password reset and disable invalidate
  all previous sessions through an atomic identity-version change.
- Login, current-session, logout and protected studio-home endpoints; reusable
  staff read/write dependencies; HttpOnly host-only cookies, explicit Lax
  SameSite policy and Secure/__Host- cookies in production. Trusted Origin checks
  protect login and writes; authenticated writes additionally require a CSRF
  header. Auth API responses disable caching and never echo credential inputs.
- Shared MongoDB fixed-window throttling: 20 attempts/IP and 5/email per 15
  minutes, hashed keys, TTL cleanup, explicit application windows and Retry-After.
  Generic invalid-login errors and generic fail-closed service failures.
- Operator `staff.py provision`, `reset` and `disable` with secure terminal
  prompts, confirmation, no password argv or piped input, and no credential
  echo in argument errors. Documented verification/recovery and disabled-account
  handling in `docs/studio-authentication.md`.
- `/studio` sign-in and `/studio/home` API-gated identity/sign-out view. Session
  restoration after reload, redirects, loading/error/expiry states, bounded
  request timeouts, retry, keyboard focus recovery, semantic themes and mobile
  layout. CSRF stays in memory; sessions/passwords never enter web storage.
- Fixed an existing Mongo URI helper bug discovered through the real browser
  backend: appending `appName` now adds the required slash when the URI has no
  path. Blank placeholder environment values now retain typed defaults.
- Public landing, Luma, persisted enquiries, client placeholder, photo viewer,
  themes and unknown-route behavior retained. No Phase 2 or later features added.

## Verification environment and final gates

Local host: Debian 13. Installed the declared CI language runtimes instead of
using the initially available Node 24/Python 3.12:
Python **3.11.16**, Node **20.20.2**, repository-pinned pnpm **10.34.3**.
Real local **MongoDB 7.0.16**, Playwright **1.58.0**, Chromium **145.0.7632.6**.
Local services required sandbox network capability; no production services were
used. Temporary runtimes, browser binaries and MongoDB data remained outside git.

Commands below used the activated equivalents of the workspace `.venv` and
pinned Node/pnpm binaries. All final required checks passed.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; frozen lock unchanged; pnpm 10.34.3 |
| `pnpm build` | PASS; shared tokens and Vite production bundle |
| `pnpm lint:web` | PASS |
| From backend: `ruff check .` | PASS |
| From backend: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pytest -q` | PASS; **90 tests**, real MongoDB, no skips |
| From backend: `pytest -q` (unit fixture fallback) | PASS; **89 passed, 1 skipped**; the real-Mongo terminal CLI case explicitly requires TEST_MONGODB_URI and passed in the real run |
| `BROWSER_MONGODB_URI=mongodb://127.0.0.1:27017 python web/tests/run_browser.py` | PASS; both entry-page and studio authentication suites |
| `git diff --check` | PASS |
| `actionlint .github/workflows/ci.yml` (1.7.7) | PASS |
| Ruff on new browser test/runner files | PASS |

Backend coverage includes valid/invalid/unknown/disabled/non-staff login;
production/development cookie flags; token hashing; application expiry with
records retained beyond the test clock; revocation/logout; reset/disable/delete;
CSRF and Origin rejection; server-owned roles; shared throttling and window
recovery; database lookup/session-write/logout-write failures; unauthorized
staff APIs; session restoration across app instances; configuration validation;
CLI secret handling and real terminal provision/reset/disable persistence.

Browser successes use real FastAPI handlers, Argon2id verification, Motor and
MongoDB persistence. The studio suite covers protected-route redirects, invalid
credentials, successful sign-in, reload, authenticated redirects, HttpOnly and
storage checks, server role changes, CSRF rejection, sign-out, expiry, disabling,
keyboard operation/focus, persisted themes, service errors/recovery and widths
320/390/768/1024/1440. Desktop sign-in and mobile home screenshots were visually
reviewed from temporary artifacts.

The full public regression passed: deterministic Luma → prefilled enquiry →
consent → real persisted receipt → pending-state chat; API error/input recovery;
photo keyboard navigation/focus restoration; mobile navigation; theme persistence;
studio/client/404 routes; all five responsive widths. No browser page errors.
Luma and email replacements are confined to test fixtures. Only failed browser
responses are intercepted; successful authentication is never mocked.

Intermediate failures were repaired before these final results: two real-Mongo
fixture assumptions, the pre-existing URI bug, disabled-input focus timing,
and a local verification overlap between token rebuild and Vite. Build and
browser checks were rerun sequentially after the overlap was identified.

## Infrastructure and configuration

**Infrastructure change:** `.github/workflows/ci.yml` now checks PRs targeting
any branch, pushes to main/default, provisions isolated MongoDB 7.0.16 services
for backend and web jobs, and runs both browser regressions in the web job after
build/lint with Python 3.11, Node 20, pinned pnpm and Chromium. Existing contents
read-only permissions remain. Review branch protection/job requirements and
runner resources as infrastructure. Deployment manifests were not edited.
Hosted GitHub Actions results are available on the PR; local verification used
the declared language runtimes, not the hosted runner operating system.

Production requires MongoDB URI/database, `ENVIRONMENT=production`, explicit
HTTPS `AUTH_ALLOWED_ORIGINS`, matching explicit credentialed `CORS_ORIGINS`, and
TLS. Use a same-origin API reverse proxy or HTTPS subdomains sharing a registrable
domain; unrelated frontend/API domains are unsupported with SameSite=Lax.
Production wildcard/regex CORS is rejected. `VITE_BACKEND_URL` contains only the
backend origin (empty for same-origin proxy). Session lifetime defaults to eight
hours, bounded to 60–604800 seconds through `AUTH_SESSION_SECONDS`. Both `.env.example`
files contain placeholders only. Configure trusted Uvicorn proxy addresses and
ingress limits, and keep credentials/cookie/CSRF headers out of proxy/tracing logs.
Provision staff through the operator CLI before expecting successful sign-in.

## Verification limits

No deployment, production TLS/reverse-proxy/CORS configuration, MongoDB Atlas,
live OpenAI or Resend verification occurred. Production cookie/CORS behavior was
verified in HTTPS ASGI tests; local browser verification used the development
same-origin proxy and real local MongoDB. Browser failure interception and driver
exception injection test recovery/fail-closed behavior, not a physical hosted
service outage. Tests cover Chromium; other browser engines and assistive
technology were not exercised. These limits do not replace the passing real
API/persistence gates above.

Next feature: **Phase 2 — persistent studio enquiry inbox**.
