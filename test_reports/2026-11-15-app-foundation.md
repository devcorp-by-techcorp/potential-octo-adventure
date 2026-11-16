# App foundation verification: 2026-11-15

Scope: the Expo app's real sign-in foundation. Staff and client bearer sessions beside cookie
sessions in the backend, a real API client, sessions with route guards and a sign-in screen in
`apps/mobile`, browser tests of the web build against a real backend, and local development
tooling with a development account seed.

Branch: `claude/kind-hawking-vkms6l`. No merge or deployment occurred. Use `git rev-parse HEAD`
for the branch tip.

## Native verification: NOT RUN

Native verification (iOS or Android) was **not run**. The cloud container that produced this
report has no iOS simulator, no Android emulator and no attached device: `xcrun`, `emulator` and
`adb` are absent. Nothing in this report establishes native behaviour. In particular, the native
credential store (`apps/mobile/src/api/credentials.native.ts`, backed by the platform secure
store) and the native restore path have not been exercised on any native target.

A person with a simulator, emulator or device should follow
[docs/app-local-development.md](../docs/app-local-development.md), then:

1. Sign in as staff: it should land on the studio area.
2. Kill the app and relaunch: it should still be signed in.
3. Sign out: it should return to marketing.
4. Sign in as the client: it should land on the client portal.
5. Corrupt record: store a session record with a missing or unknown role in the secure store (for
   example a stored JSON object with no `role`, or `"role": "admin"`), then relaunch. The record
   should be cleared and the app should land on sign-in.

## Verification commands and results

Run against MongoDB 7.0.16, a single-node replica set named `phase3`, with isolated test
databases. Provider boundaries (email, OpenAI) stayed disabled.

| Check | Result |
| --- | --- |
| `cd backend && .venv/bin/ruff check .` | All checks passed |
| `cd backend && TEST_MONGODB_URI=<replica set> .venv/bin/pytest -q` | 426 passed, 2 skipped (baseline 424 passed, 2 skipped, plus the 2 seed tests) |
| `cd backend && .venv/bin/python export_database_schemas.py --check` | 28 collection schemas and index/source manifest current |
| `pnpm lint:web` | Passed, no findings |
| `pnpm typecheck:mobile` | Passed, no errors |
| `BROWSER_MONGODB_URI=<replica set> APP_TEST_PYTHON=backend/.venv/bin/python pnpm e2e:mobile` | Exit 0, 407 checks, none failing. Per suite: see the table below |
| `node scripts/check-design.mjs` | Token mirrors match; 25 runtime variables resolve |

Browser suite results, from one full `pnpm e2e:mobile` run made at base commit `0f8d0bf` plus the
fix-round changes to `apps/mobile/e2e/auth.js` and `backend/tests/app_server.py` (committed in the
commit that follows `0f8d0bf`; use `git log` for its SHA):

| Suite | Result |
| --- | --- |
| `finance.js` | 22 passed, 0 failed |
| `api-client.js` | 40 passed, 0 failed |
| `session-state.js` | 18 passed, 0 failed |
| `auth.js` (phone and desktop viewports) | 38 passed, 0 failed |
| `screens.js` | 125 clean, 0 with findings |
| `kids.js` | 88 passed, 0 failed |
| `studio.js` | 76 passed, 0 failed |
| Total | 407 checks (282 PASS lines plus 125 clean screens), 0 failing |

The seed tests alone: `tests/test_seed_dev_accounts.py`, 2 passed. They need the replica set,
because invitations use transactions; without `TEST_MONGODB_URI` the invitation step returns 503.

One existing Starlette multipart pending-deprecation warning remains in the backend suite.

A separate small commit shortened the module docstring of `backend/tests/app_server.py`, which
exceeded ruff's E501 limit.

## Review Focus coverage

1. **Malformed `Authorization` headers return 401, never 500; a lowercase scheme is accepted.**
   Covered by `backend/tests/test_bearer_sessions.py::test_malformed_authorization_headers`
   (parametrised: `Basic abc`, `Bearer`, `Bearer ` with a trailing space, an over-long token and
   `Token abc`) and `::test_scheme_is_case_insensitive`.
2. **A bearer header on invitation acceptance is ignored.** Covered by
   `test_bearer_sessions.py::test_invitation_accept_ignores_bearer_header` and
   `::test_invitation_accept_with_cookie_and_authorization_header_is_refused`.
3. **Web restore with the backend down shows a retryable "temporarily unavailable" state and
   keeps the role.** Covered by two tests together:
   `apps/mobile/e2e/auth.js` (backend unreachable during restore: asserts the "The studio is
   temporarily unavailable. Please try again." panel with no studio data, then that "Try again"
   restores the dashboard) and `apps/mobile/e2e/session-state.js` ("restore-failed-unavailable ->
   unavailable" and "unavailable keeps identity and remembered role").
4. **A corrupt native stored record is cleared and lands on sign-in.** Implemented in the
   `restore` logic of `apps/mobile/src/state/session.tsx` (a bearer record without a valid role
   or token is cleared and restore ends as signed out) and in the tolerant parse of
   `credentials.native.ts`. Covered only by the **manual native check (not run here)**, step 5 of
   the checklist above. No automated test covers it, because the path runs only on native.
5. **Sign-in double submit is blocked.** Implemented in `apps/mobile/app/sign-in.tsx` with
   `busyRef`, beside the busy state of the button and a second guard in `session.tsx`. Covered
   end to end by `apps/mobile/e2e/auth.js`, at both viewports: "double-clicking sign-in creates
   exactly one staff session" (non-revoked staff sessions read before and after through the
   test-only `GET /__test/session-count` route in `backend/tests/app_server.py`, which the real
   app does not have) and "double-click sign-in lands on /dashboard with no error alert".
   Limitation: the check proves the outcome, not `busyRef` in isolation. With the `busyRef`
   guard and the button's busy guard both removed, the check still passed, because the guard in
   `session.tsx` and the responder behaviour also prevent a second request. It guards against
   regression of the whole behaviour, not of that one line.

## Not covered

- All native behaviour (see above).
- Review Focus item 4 has no automated coverage (manual native check only, not run).
- Browser suites run the web build only, in Chromium.
