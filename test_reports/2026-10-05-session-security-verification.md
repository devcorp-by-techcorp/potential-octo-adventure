# Studio Suite session security verification — 2026-10-05

Repository: `devcorp-by-techcorp/studio-suite_v2`.
Branch: `codex/studio-suite-integrated-development`.
Starting checkpoint: `f8f16d7a10b9ed36b6bd6b27eb13f803ee7fcee9`.
Application increment: `d0014df07b1564fdf1c1defc99b09f0afbf5c109`.
Browser harness checkpoint: `c33f86df365e9a2fd407582bb2ef2246a5dffcbe`.
Related fixes: `57ab79b`, `8485fd4`, `63fa868`, `ecc30d1`, `a595395`, `a81e64b`, `c33f86d`.
Draft PR: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/12.
Subsequent documentation-only commits do not change the verified application;
use `git rev-parse HEAD` for the branch tip. No merge or deployment occurred.

## Implemented behavior

Staff and client home pages expose counts of their own other active sessions and
an action to sign those sessions out while retaining the current session. The
four registered API endpoints reuse existing cookie, role, CSRF and Origin
contracts. They do not expose session tokens, hashes, account lists or device/IP
claims, and they do not change enquiry grants or availability.

Replica-set transactions fence both the identity and the authorising session,
withdraw only matching active sessions, and save a UUID command receipt atomically.
A replay returns the original withdrawal count and preserves sessions opened after
that command committed. Receipt expiry matches the authorising-session expiry;
this is ephemeral authentication state, not a customer-content retention policy.

The 18 new replica-set cases cover both scopes, persistence after application
recreation, other-account/scope/version/expiry isolation, forged input and CSRF,
four simultaneous identical commands, competing sessions withdrawing each other,
logout/reset/disable/expiry between authentication and transaction, and rollback
when saving the receipt fails. The browser journey signs in through the real app,
loses only a committed response, signs in again, retries the original command and
proves that later login remains valid. It also verifies withdrawal after reload,
current-session preservation, absence of grant changes and four viewport widths.

## Verification commands and results

All local application/browser databases were isolated test databases on MongoDB
7.0.16, writable primary of replica set `phase3`. Application endpoints were real
loopback FastAPI/Vite endpoints. External provider boundaries stayed fake/disabled.

- `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests/test_account_sessions.py` — 18 cases passed.
- `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests` — all 341 tests passed; exit 0. One existing Starlette multipart pending-deprecation warning remains. Test collection also confirmed 341 cases.
- `.venv/bin/ruff check backend web/tests` and `git diff --check` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm lint:web` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm build` — passed; shared tokens and Vite workspace build, JS 342.49 KB / gzip 102.94 KB.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' BROWSER_SUITES=account_sessions.py .venv/bin/python web/tests/run_browser.py` — passed against the actual isolated application.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/python web/tests/run_browser.py` — aggregate did not pass locally. After MongoDB restoration, `/tmp/studio-browser-restored-final.log` passed entry, authentication and inbox, then failed the invitation expiry UI assertion; the harness now awaits and verifies the actual refreshed invitation status. The latest changed-four-suite run (`BROWSER_SUITES=studio_inbox.py,client_invitations.py,studio_reporting.py,account_sessions.py`, `/tmp/studio-browser-changed-complete.log`) stopped in inbox waiting 30 seconds for the staff sign-in form. Do not treat these as aggregate passes.
- `CADDY_BINARY=/home/techcorp2024/studio-suite-tools/caddy .venv/bin/python web/tests/production_server.py` — passed, temporary loopback routing services; exit 0.
- Mobile sources did not change; mobile checks/exports were not rerun. The prior Expo-shell evidence does not establish native credential/device authentication.

Hosted [CI run 37242573406](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37242573406)
passed all three jobs at `c33f86d`: backend Ruff/full replica-set pytest, web
lint/build plus **all 13 browser suites**, and production Docker image/Caddy routing.
The web log explicitly lists every suite and ends `All 13 browser suites passed`.
No Docker executable is available locally; the hosted image job supplies that evidence.
PR #12 remained open and draft on live readback at this checkpoint. Both PR run `37242573406` and push run `37242570904` succeeded at `c33f86d`; the latter web log was independently read back and explicitly confirms all 13 suites. Subsequent documentation-only tip CI must be checked live before concluding the session.

## Failures diagnosed and corrections

An early local aggregate stopped at a five-second staff sign-in URL assertion.
Invitation sign-in and invitation opening now wait for successful real API responses
before checking UI state. The local aggregate later passed invitations and bookings, then stopped at reporting’s five-second client-login URL assertion. Staff and client reporting sign-ins now also synchronize on their real login API responses; later local reruns remained unsuccessful as described above. Another local run timed out waiting for client logout;
the isolated diagnostic rerun passed that point and later exposed an invitation
inspection wait. Logout failure diagnostics remain available in the test.

A focused browser run was invalidated by concurrently rebuilding tokens: Vite
observed rewritten `packages/tokens/dist` files, performed a full reload and lost
memory-only retry state. Complete builds before browser verification; do not edit
watched application files during a run. This lesson was recorded in Empirical.
The clean focused session browser passed after build completion and response waits.

Hosted PR run `37234102829` at `d0014df` failed in reporting because a page-wide
`get_by_role("status")` selector matched both account-session and enquiry loading
statuses. The assertion now selects the enquiry status. The replacement hosted run
at `57ab79b` passed all 13 suites. The separate push run `37234099308` also passed
at `d0014df`; that does not erase the diagnosed PR failure.

Hosted PR run `37240769734` at `8485fd4` exposed a count-then-click race: a background authorization denial removed the Save changes button between inspecting it and clicking it. The test now captures the valid session CSRF before invalidation, issues a real PATCH using that browser's cookie jar after invalidation, verifies 401/403 and byte-for-byte unchanged MongoDB state, then verifies UI privacy clearing. Private enquiry reads, inbox list navigation and invitation status refresh now synchronize on their actual API responses before checking rendered outcomes. No denial or successful provider response was fabricated.

The local MongoDB process exited with FTDC `FileStreamFailed` writing `diagnostic.data/metrics.interim.temp`, interrupting one browser run with connection-refused/ReplicaSetNoPrimary. Restarted MongoDB 7.0.16 using the same existing test data directory, replica-set name and loopback port, without repair or deletion. `hello` confirmed `phase3` and a writable primary; `serverInfo` confirmed 7.0.16. The write-failure cause remains unconfirmed. Disk availability was observed but does not establish causation. Another run failed the 45-second Vite readiness deadline; later starts succeeded.

The previous report incorrectly described hosted CI as covering only four suites.
Direct readback of run `37231182661`, web job `111520959508`, proves all twelve
previous suites passed. The old CI step label was stale; it is now corrected, and
the runner prints per-suite progress and the successful aggregate count.

## Remaining boundaries and next task

Booking planning → confirmation remains HTTP 409 with a disabled UI control until
authoritative scheduling resources, capacity/overlap, timezone and booking
obligations are supplied. Enquiries, conversations, invitations/acceptance and
proposal drafts do not confirm bookings or reserve availability.

R2/Worker credentials, private delivery and derivative requirements; signature
provider/consent/evidence; payment provider and commercial rules; retention policy;
notification sandbox; recovery delivery; and native secure credential/device-auth
verification remain unavailable. Recovery stays unregistered and default-disabled.
No provider success, signature sufficiency, price, refund, retention or notification
promise was invented. This checkpoint is not release approval.

Next concrete product task: obtain an authoritative booking resource/capacity,
interval-overlap, timezone and obligation specification, then implement transactional
conflict prevention and concurrent confirmation tests before lifting the 409 gate.
Native mobile authentication requires a verified secure-session strategy and an
actual emulator/device; keep the existing Expo shell partial until then.

Concurrent unrelated `design-system/` changes were observed and preserved outside
these commits. Recheck their live status before subsequent work; do not stage or
restore them as part of this checkpoint.
