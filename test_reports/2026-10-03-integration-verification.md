# Studio Suite integration verification — 2026-10-03

Repository: `devcorp-by-techcorp/studio-suite_v2`
Branch: `codex/studio-suite-integrated-development`
Starting commit: `1a5ec76973635701eb6ae3dde86201d109ca8b9c`
Draft PR: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/8

## Branch consolidation

The default deployment branch (`claude/illuminate-gallery-rebuild-deploy-dy6bie`,
PR7/e68fba4) and `main` (PR6/a7d83ff) diverged from
`2c09477761d84555ad8f06a3f9b4b8ba50d87394`. The integration branch combines them
without dropping transactional invitation/access work or deployment support. The
combined code retains MongoDB7.0.16 replica-set CI, client/staff isolation and private
response handling, same-origin Caddy `/api` routing, backend readiness and production
Docker image/routing coverage. The baseline commit's GitHub run `37078752266` passed
all3 jobs (backend regression, web build/browser, production Docker/Caddy). No
production deployment or default-branch merge was performed.

## New implementation

The branch now includes persistent non-booking date/time proposals; transactionally
revocable per-enquiry client access; persistent grant-scoped conversations; private
versioned document storage with local and R2 adapters; canonical contacts; real
aggregate studio reporting; plain-text narrative CMS draft/publish/versioning; indexed
enquiry search, export and revision-checked bulk triage; and a runnable partial Expo
shell. Tests and docs are included with each area. No contact access is added through
email matching. Proposal drafts never reserve dates or confirm bookings.

A self-service client recovery candidate exists behind environment gates but its
router/UI are not registered in the running app. It is explicitly **not usable or
complete**. A focused one-case bug in its external adapter test fixture was corrected
so the real adapter is exercised; this feature still requires full integration,
browser verification, and deployment configuration review.

## Verification completed / underway

- `TEST_MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=phase3 .venv/bin/pytest -q backend/tests` — **308 passed**, exit0, on isolated MongoDB7.0.16 writable primary in `phase3`. One upstream Starlette `multipart` deprecation warning remains.
- `pnpm install --frozen-lockfile` — passed with pinned pnpm10.34.3. pnpm reports ignored lifecycle scripts for esbuild/unrs-resolver; installation/build completed.
- `pnpm lint:web` — passed.
- `pnpm build` — passed; Vite produced production output (main JS 328.61kB, gzip99.88kB).
- `.venv/bin/ruff check backend` — passed after formatting the disabled recovery candidate and its tests.
- The 11-suite full browser runner is being rerun after the focused client-invitation suite passed. The focused test verified the actual invitation API response and complete invitation/enrollment/isolation/lifecycle/recovery journey.
- Mobile's separate TypeScript, ESLint, origin tests, platform exports and web smoke had passed in the preceding work unit; recheck the commands before final checkpoint if time allows.
- Production Docker/Caddy CI passed on baseline commit; rerun CI after pushing the new checkpoint. Local Docker daemon is not installed. Local Caddy production routing needs a final run against the new tree.

Two first browser attempts found real test issues. A role locator matched multiple live-region statuses after unread announcements were added, so it now selects the revocation announcement by text. A later staff-detail wait was nondeterministic under the larger scenario; its helper now observes the real API response and the isolated invitation suite passes. The full suite must finish before claiming all browser coverage green.

## Exact reproduction

```sh
TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests
.venv/bin/ruff check backend
export PATH='/home/techcorp2024/.local/share/pnpm/.tools/pnpm/10.34.3/bin':$PATH
pnpm install --frozen-lockfile
pnpm lint:web
pnpm build
BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/python web/tests/run_browser.py
CADDY_BINARY=/path/to/caddy .venv/bin/python web/tests/production_server.py
```

`web/tests/run_browser.py` uses an isolated test database and temporary private local
storage; it drops only its named browser test database. Never point these checks at
production. `BROWSER_SUITES=client_invitations.py` selects the diagnostic browser suite.
Live R2/Resend/Railway credentials and physical-device behavior were not tested.

## Remaining blockers and release status

No sourced resource/capacity/timezone or booking-obligation decisions exist, so actual
booking confirmation and shoot stages remain disabled. Private galleries and media
processing need access/delivery requirements and live R2/Worker verification.
Signatures need provider, consent and evidence requirements. Payments/orders need a
provider and server-authoritative commercial policy. Retention/deletion needs an
approved policy. Client recovery is an unregistered candidate. Mobile is a shell; native
auth/session security is not implemented. No production deployment is authorized or
claimed. Update this report with the final browser/Caddy/mobile/CI results and final
commit SHA before ending the session.
