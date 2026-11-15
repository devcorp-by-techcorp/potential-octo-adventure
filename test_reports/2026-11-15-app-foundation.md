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
| `BROWSER_MONGODB_URI=<replica set> APP_TEST_PYTHON=backend/.venv/bin/python pnpm e2e:mobile` | Exit 0. Suite summaries in order: 22, 40, 18, 34, 88 and 76 passed, 0 failed each (278 PASS lines, no FAIL) |
| `node scripts/check-design.mjs` | Token mirrors match; 25 runtime variables resolve |

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
   `credentials.native.ts`. **No automated test covers it.** The reducer's signed-out transition
   is tested, but the corrupt-record decision and the clear are not. Native was also not run (see
   above).
5. **Sign-in double submit is blocked.** Implemented in `apps/mobile/app/sign-in.tsx` with
   `busyRef`. **No automated test covers it**: no browser or unit test double-submits the form.

## Not covered

- All native behaviour (see above).
- Review Focus items 4 and 5 have no automated coverage.
- Browser suites run the web build only, in Chromium.
