# App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff and clients sign in to the Expo application with real backend accounts on desktop
web (cookie sessions) and native (bearer tokens). They stay signed in across restarts, and every
later screen reaches the backend through one API client.

**Architecture:** The backend gains a `transport` field on session records and one helper that
reads the credential from a request: either the role's cookie or an `Authorization: Bearer`
header, never both. Each session is only usable over the transport it was issued for. New
`/token` endpoints issue bearer sessions. Cookie flows are unchanged. The app gets an API client
with two credential modes, chosen by platform file (`.web.ts` / `.native.ts`), a real session
provider, and route guards.

**Tech Stack:**
- Backend: FastAPI, Motor, MongoDB 7.0.16 replica set, pytest, httpx ASGI client.
- App: Expo SDK 51, Expo Router 3.5, React Native 0.74, `expo-secure-store` 13.0.2, TypeScript 5.4.
- Browser tests: Playwright, as in the existing `apps/mobile/e2e` suites.

**Spec:** `docs/superpowers/specs/2026-11-15-app-foundation-design.md` (approved 15 November 2026)

## Global Constraints

- **Cookie sessions keep their Origin and CSRF checks exactly as today.** No existing cookie test
  may change.
- **One session record per sign-in,** in the existing `staff_sessions` / `client_sessions`
  collections. Records without `transport` are treated as `"cookie"`.
- **A credential is accepted only over its own transport and role.** A request carrying both a
  bearer header and that role's cookie is refused with 401.
- **Bearer tokens are 1–128 characters,** the same bound as cookies today.
- **Native session lifetime is `AUTH_SESSION_SECONDS`,** the same as the web: 28800 seconds
  (8 hours) by default.
- **Token storage.** On native, the token lives only in `expo-secure-store`. On web, the app never
  sees the session token. The CSRF token is held in memory only.
- **No demo credentials** remain in the sign-in screen.
- **Password reset and invitation acceptance link out to the web flow.**
- **Backend error messages are shown to the user unchanged.**
- **Run every backend test against the real replica set:**
  `TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3'`. Start it with
  `bash backend/tests/start_mongodb.sh` after starting `dockerd`.
- **Baseline that must stay green:**
  - backend 394 passed, 2 skipped;
  - web lint and browser suites;
  - `pnpm typecheck:mobile`;
  - `node apps/mobile/e2e/finance.js`;
  - schema export check.
- **`.github/workflows/ci.yml` is infrastructure.** Any change to it is called out in the PR body
  for the owner.

## Review Focus

1. **Malformed `Authorization` headers** (`Basic …`, `Bearer` with no token, a 129-character
   token, a lowercase `bearer` scheme) return 401, never 500. A lowercase scheme is accepted, per
   RFC 7235. Owned by Task 1.
2. **A bearer header on invitation acceptance** is ignored. The request is treated as anonymous,
   because that endpoint stays cookie-only, and it is never a 500. Owned by Task 2.
3. **Web restore when the backend is down (503 or a network error)** shows a retryable
   "temporarily unavailable" state. It does not sign the user out or forget the remembered role.
   Owned by Task 4.
4. **Native secure storage holding a token with a missing or unknown role** deletes the record and
   lands on sign-in. Owned by Task 4.
5. **Sign-in double submit:** the button is disabled while a request is pending, so two taps
   create one session. Owned by Task 4.

---

### Task 1: Staff bearer sessions in the backend

**Files:**
- Modify: `backend/auth.py`:
  - add the credential helper and session issue;
  - change `require_staff` (175–199) and `require_staff_write` (201–208);
  - change `fence_staff_write` (211–240), `current_session` (243–251) and `logout` (254–262);
  - add `POST /api/auth/token`.
- Modify: `backend/booking_drafts.py:82` and `backend/public_content.py:108`. Each fence uses
  `request.state.staff_session["_id"]` instead of digesting the cookie.
- Modify: `backend/export_database_schemas.py:77-85,209`. Add optional
  `"transport": choice("cookie", "bearer")` to staff and client sessions, then regenerate
  `backend/schemas/*.schema.json` and the README field table.
- Test: `backend/tests/test_bearer_sessions.py` (new).

**Interfaces:**
- Produces, in `auth.py`:
  - `Transport = Literal["cookie", "bearer"]`
  - `def presented_credential(request: Request, cookie: str, denied: HTTPException) -> tuple[str, Transport]`
    - Raises `denied` if the request carries neither credential, carries both, has a malformed
      header, or has a token of 0 or more than 128 characters.
    - Parses `Authorization` as `<scheme> <token>`, with the scheme matched case-insensitively
      against `bearer`.
  - `def session_transport(session: dict) -> Transport`: returns `session.get("transport", "cookie")`.
  - `async def issue_staff_session(database, identity: dict, transport: Transport) -> tuple[str, datetime]`:
    returns `(raw_token, expires)` and writes the record with `transport`.
  - `request.state.staff_transport: Transport`, set by `require_staff`.
  - `POST /api/auth/token`:
    - body `LoginBody`;
    - response `{"identity": {...public_identity}, "token": str, "expires_at": iso, "expires_in_seconds": int}`;
    - no `Set-Cookie`;
    - no Origin dependency;
    - same throttles as `/api/auth/login`: ip 20, email 5.
  - `GET /api/auth/session` returns `"csrf_token": null` for bearer sessions.

- [ ] **Step 1: Write the failing tests** in `backend/tests/test_bearer_sessions.py`.

  Reuse `change_staff("provision", …)` and the constants from `test_auth.py`. Define the helper
  `bearer(token) -> dict` as `{"Authorization": f"Bearer {token}"}`.

  - `test_staff_token_login_returns_token_and_no_cookie`:
    - status 200 and `"set-cookie" not in response.headers`;
    - `len(body["token"]) >= 32`;
    - `body["expires_in_seconds"] == 28800`;
    - the stored session has `transport == "bearer"`, and `_id == auth.digest(token)`;
    - the raw token is not in `str(session)`;
    - `cache-control == "no-store"`.
  - `test_staff_token_login_needs_no_origin`: the request has no Origin header and gets 200.
  - `test_bearer_reads_and_writes_without_origin_or_csrf`:
    - `GET /api/studio/home` with `bearer(t)` returns 200;
    - `GET /api/auth/session` returns `csrf_token is None`;
    - `POST /api/auth/logout` with only `bearer(t)` returns 204;
    - afterwards `GET /api/studio/home` returns 401.
  - `test_bearer_token_refused_as_cookie`: setting `client.cookies["studio_session"] = t` (a bearer
    token) makes `/api/studio/home` return 401.
  - `test_cookie_token_refused_as_bearer`: a cookie-login token sent as `bearer(...)`, with the
    cookie jar cleared, returns 401.
  - `test_both_credentials_refused`: a valid cookie plus a valid bearer header returns 401.
  - `test_bearer_expiry_revocation_and_auth_version`: each of the following independently returns
    401:
    - setting `expires_at` in the past;
    - setting `revoked_at`;
    - running `change_staff("reset", …)`.
  - `test_staff_token_cannot_reach_client_routes`: a staff bearer token on
    `GET /api/auth/client/session` returns 401.
  - `test_token_login_throttled`: after five bad-password attempts for one email, the sixth
    returns 429 with `detail == "Too many sign-in attempts. Please try again later."` and a
    `Retry-After` header.
  - `test_malformed_authorization_headers` (Review Focus 1), parametrised over the header values
    `"Basic abc"`, `"Bearer"`, `"Bearer "`, `"Bearer " + "x"*129` and `"Token abc"`. Each returns
    401. `"bearer <valid>"` returns 200.
  - `test_cookie_writes_still_need_origin_and_csrf`: cookie logout without `X-CSRF-Token` returns
    403, and without Origin returns 403.
  - `test_bearer_write_through_transactional_fence`: a bearer-authenticated write that goes through
    `fence_staff_write` succeeds. Use the smallest existing staff write that calls it; find it with
    `grep -n fence_staff_write backend/*.py`.

- [ ] **Step 2: Run them and confirm they fail.**
  `cd backend && TEST_MONGODB_URI=… .venv/bin/pytest tests/test_bearer_sessions.py -q`
  Expected: failures. `/api/auth/token` returns 404, and bearer headers are ignored.

- [ ] **Step 3: Implement the helper and the token endpoint in `auth.py`.**
  - `login` and the token endpoint both call `issue_staff_session`. The cookie login keeps its
    exact response and cookie.
  - `require_staff` looks up the session, then refuses if `session_transport(session) != transport`.
  - `require_staff_write` returns early for bearer. Cookie requests run the existing checks
    unchanged.
  - `logout` revokes `request.state.staff_session["_id"]` and clears the cookie only for cookie
    transport.

- [ ] **Step 4: Replace the cookie digests in the three fences.** These are `auth.fence_staff_write`,
  `booking_drafts.py:82` and `public_content.py:108`. Each uses `request.state.staff_session["_id"]`.

- [ ] **Step 5: Add `transport` to the schema export and regenerate it.**
  `cd backend && .venv/bin/python export_database_schemas.py && .venv/bin/python export_database_schemas.py --check`
  Expected: the check passes. `git diff backend/schemas` shows only the added `transport` property
  and the README row.

- [ ] **Step 6: Run the new tests and the full suite.**
  `cd backend && .venv/bin/ruff check . && TEST_MONGODB_URI=… .venv/bin/pytest -q`
  Expected: every new test passes. The suite shows 394 + new passed, 2 skipped, 0 failed, and no
  existing test was edited.

- [ ] **Step 7: Commit.** Message: `Add staff bearer sessions beside cookie sessions`.

---

### Task 2: Client bearer sessions and cross-transport session management

**Files:**
- Modify: `backend/client_auth.py`:
  - `ClientSessionResponse.csrf_token: str | None` (line 49);
  - `insert_session(..., transport: Transport = "cookie")` (80–95);
  - `require_client` (116–140) and `require_client_write` (143–152);
  - add `async def token_login(body, request) -> dict`.
- Modify: `backend/client_access.py`:
  - add `POST /api/auth/client/token`;
  - `current_session` (532–545) returns a null `csrf_token` for bearer;
  - `logout` (548–) deletes the cookie only for cookie transport;
  - `accept` (334) stays cookie-only. Add a comment that it is deliberately cookie-only.
- Modify: `backend/account_sessions.py`. Confirm `fence` and `others` are transport-agnostic, since
  they key on `_id` and the identity. Change nothing if the tests pass.
- Test: `backend/tests/test_bearer_sessions.py` (extend). Use the client fixture pattern from
  `tests/test_account_sessions.py` to create a client identity through the invitation path.

**Interfaces:**
- Consumes: `presented_credential`, `session_transport` and `Transport` from Task 1.
- Produces:
  - `POST /api/auth/client/token`: the same response shape as the staff token endpoint, with the
    identity `{id, email, name}`, and the same limits as `/api/auth/client/login`
    (`login_budget`).
  - `request.state.client_transport: Transport`.

- [ ] **Step 1: Write the failing tests** (extend the file).
  - `test_client_token_login_and_bearer_read`:
    - status 200 with no cookie;
    - `GET /api/client/enquiries` with bearer returns 200;
    - the session has `scope == "client"` and `transport == "bearer"`.
  - `test_client_bearer_logout_without_origin_or_csrf`: logout with body `{}` returns 204, and the
    token then returns 401.
  - `test_client_cross_transport_and_cross_role`:
    - a client bearer token used as a `client_session` cookie returns 401;
    - a client cookie token used as bearer returns 401;
    - a client bearer token on `/api/studio/home` returns 401;
    - both credentials together return 401.
  - `test_client_bearer_invalidated_by_reset_and_disable`: running `change_client("reset", …)` and
    `change_client("disable", …)` each make the token return 401.
  - `test_session_counts_and_revoke_others_span_transports`: for one staff identity, create a cookie
    session and two bearer sessions.
    - `GET /api/auth/sessions` from the cookie session reports `other_active_sessions == 2`.
    - `POST /api/auth/sessions/revoke-others` from one bearer session returns `revoked_count == 2`.
    - Only that bearer session still works.
    - Repeat for a client through `/api/auth/client/sessions`.
  - `test_invitation_accept_ignores_bearer_header` (Review Focus 2): `POST /api/auth/client/invitations/accept`
    with a valid client bearer header, an Origin header and a fresh pending invitation behaves
    exactly as with no credential. It succeeds or fails on the invitation alone, never 500.

- [ ] **Step 2: Run them and confirm they fail.** Expected: 404 on `/api/auth/client/token`, and
  bearer headers are ignored.

- [ ] **Step 3: Implement client bearer sessions,** mirroring Task 1. `token_login` reuses the body
  of `login`, then calls `insert_session(..., transport="bearer")` and returns the token in the
  body.

- [ ] **Step 4: Run the full backend suite and the schema check.** Expected: all pass, with no
  existing test edited.

- [ ] **Step 5: Commit.** Message: `Add client bearer sessions and manage sessions across transports`.

---

### Task 3: The app's API client and credential storage

**Files:**
- Modify: `apps/mobile/package.json`. Add `"expo-secure-store": "~13.0.2"` with
  `pnpm -F @illuminate/mobile exec expo install expo-secure-store`, and commit the updated
  `pnpm-lock.yaml`.
- Modify: `apps/mobile/app.json`. Add `"expo-secure-store"` to `plugins`.
- Create: `apps/mobile/src/api/config.ts`, the base URL.
- Create: `apps/mobile/src/api/credentials.web.ts` and `apps/mobile/src/api/credentials.native.ts`,
  selected by Metro's platform extensions, plus `apps/mobile/src/api/credentials.ts`, which
  re-exports the shared types for `tsc`.
- Create: `apps/mobile/src/api/client.ts`, the request and error handling.
- Create: `apps/mobile/src/api/auth.ts`, the auth endpoints per role.
- Test: `apps/mobile/e2e/api-client.js` (new). It transpiles `src/api/*.ts` with `typescript` like
  `e2e/finance.js`, and runs against a fake `fetch`.
- Modify: `apps/mobile/package.json` `e2e` script. Run `node e2e/api-client.js` right after
  `node e2e/finance.js`.

**Interfaces:**
- Produces:
  - `type Role = "staff" | "client"`
  - `type Mode = "cookie" | "bearer"`
  - `interface StoredSession { role: Role; token?: string }`
  - `interface CredentialStore { mode: Mode; read(): Promise<StoredSession | null>; write(s: StoredSession): Promise<void>; clear(): Promise<void> }`
    - Web: `mode = "cookie"`. Stores `{role}` only, in `localStorage` under `illuminate.lastRole`,
      with every access in try/catch. It never stores a token.
    - Native: `mode = "bearer"`. Stores JSON under the SecureStore key `illuminate.session`.
  - `export const credentials: CredentialStore`, one per platform file.
  - `function apiBase(): string`:
    - Web: `process.env.EXPO_PUBLIC_API_URL ?? ""`, which means same origin.
    - Native: the value is required. If it is missing, or is not `https:` when `!__DEV__`, throw
      `new Error("EXPO_PUBLIC_API_URL must be set to the backend's HTTPS origin")`.
  - `class ApiError extends Error { status: number; kind: "unauthorized" | "forbidden" | "not_found" | "conflict" | "invalid" | "rate_limited" | "unavailable" | "other"; }`
    - `message` is the backend's `detail` string when present. For a network error,
      `status = 0` and `kind = "unavailable"`.
  - `function createApiClient(deps: { base: string; mode: Mode; fetch: typeof fetch; getToken(): string | null; getCsrf(): string | null; onUnauthorized(message: string): void }): ApiClient`
  - `interface ApiClient { request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T>; resetUnauthorized(): void }`
  - `interface SessionInfo { identity: { id: string; email: string; name: string }; expiresAt: string; csrfToken: string | null; token?: string }`
  - In `auth.ts`:
    - `signInRequest(api, mode, role, email, password): Promise<SessionInfo>`
    - `readSession(api, role): Promise<SessionInfo>`
    - `signOutRequest(api, role): Promise<void>`
    - Paths: staff `/api/auth/login` (cookie) and `/api/auth/token` (bearer), `/api/auth/session`,
      `/api/auth/logout`. Client `/api/auth/client/login`, `/api/auth/client/token`,
      `/api/auth/client/session`, `/api/auth/client/logout` (body `{}`).

- [ ] **Step 1: Write the failing checks** in `e2e/api-client.js`, each printed as PASS/FAIL like
  `finance.js`, exiting non-zero on any FAIL.
  - Cookie mode sends `credentials: "include"` and no `Authorization` header.
  - Cookie-mode `POST` sends `X-CSRF-Token: <getCsrf()>`. Cookie-mode `GET` sends none.
  - Bearer mode sends `Authorization: Bearer <getToken()>`, omits `credentials: "include"`, and
    sends no CSRF header.
  - The status-to-kind mapping: 401 → unauthorized, 403 → forbidden, 404 → not_found,
    409 → conflict, 422 → invalid, 429 → rate_limited, 503 → unavailable. The `message` equals
    the response's `detail`.
  - A rejected `fetch` gives `ApiError` with `status 0` and kind `unavailable`.
  - Three concurrent requests that all return 401 call `onUnauthorized` exactly once. After
    `resetUnauthorized()`, a new 401 calls it again.
  - `apiBase()` on native with no env throws the exact message above.

- [ ] **Step 2: Run `node apps/mobile/e2e/api-client.js`.** Expected: it fails because the modules
  don't exist.

- [ ] **Step 3: Implement `config.ts`, `credentials.*.ts`, `client.ts` and `auth.ts`** to the
  interfaces above.

- [ ] **Step 4: Run the checks and the typecheck.**
  `node apps/mobile/e2e/api-client.js && pnpm typecheck:mobile`
  Expected: all PASS, and tsc exits 0.

- [ ] **Step 5: Commit.** Message: `Add the app's API client with cookie and bearer credential modes`.

---

### Task 4: Real sessions, route guards and the sign-in screen

**Files:**
- Replace: `apps/mobile/src/state/session.tsx`.
- Modify: `apps/mobile/app/index.tsx`, `apps/mobile/app/sign-in.tsx`,
  `apps/mobile/app/(admin)/_layout.tsx`, `apps/mobile/app/(client)/_layout.tsx`.
- Modify: `apps/mobile/src/components/AppShell.tsx` (sign-out at 120, 154) and
  `apps/mobile/src/components/Luma.tsx:36`, which move to the new session value.
- Create: `apps/mobile/src/components/SessionGate.tsx`.
- Test: `apps/mobile/e2e/session-state.js` (new, node, transpiled like Task 3), which tests the pure
  state reducer.

**Interfaces:**
- Consumes: `credentials`, `createApiClient`, `apiBase`, `signInRequest`, `readSession` and
  `signOutRequest` from Task 3.
- Produces:
  - `type SessionStatus = "restoring" | "signed-out" | "staff" | "client" | "unavailable"`
  - `function sessionReducer(state: SessionState, event: SessionEvent): SessionState`, exported
    from `session.tsx` and pure. The events are:
    - `restored(role, info)`
    - `restore-failed-unauthorized`
    - `restore-failed-unavailable`
    - `signed-in(role, info)`
    - `signed-out(message?)`
  - `useSession(): { status: SessionStatus; identity: SessionInfo["identity"] | null; message: string | null; api: ApiClient; signIn(role: Role, email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>; signOut(): Promise<void>; restore(): Promise<void> }`
  - `<SessionGate require="staff" | "client">` renders:
    - a neutral splash for `restoring`;
    - a retry panel for `unavailable`;
    - `<Redirect href="/sign-in">` for `signed-out`;
    - a redirect to the other role's home on a role mismatch;
    - its children otherwise.

- [ ] **Step 1: Write the failing reducer checks** in `e2e/session-state.js`.
  - `restored("staff", info)` → status `staff`, with the identity set.
  - `restore-failed-unauthorized` → status `signed-out`, message null.
  - `restore-failed-unavailable` → status `unavailable`. The identity and remembered role are not
    cleared (Review Focus 3).
  - `signed-out("Your session has expired. Please sign in again.")` → status `signed-out`, carrying
    that message.

- [ ] **Step 2: Run it.** Expected: it fails because the export doesn't exist.

- [ ] **Step 3: Implement the provider.**
  - **Restore on web:** read the remembered role, try that role's session first, then the other.
    A 401 on both means signed out. A 503 or network error on either means unavailable.
  - **Restore on native:** read SecureStore. If the record is missing, or its role is not `staff`
    or `client` (Review Focus 4), call `credentials.clear()` and treat it as signed out. Otherwise
    call `readSession`. A 401 clears the store.
  - **`signIn`:**
    - guards against re-entry while a request is pending;
    - stores the token on native and the role on web;
    - keeps `csrfToken` in a ref;
    - calls `api.resetUnauthorized()`.
  - **`signOut`:** calls `signOutRequest`. Whatever it returns, it then clears the store and
    the CSRF token.
  - **`onUnauthorized`:** dispatches `signed-out(message)` and clears the store.

- [ ] **Step 4: Wire the routes.**
  - `app/index.tsx` maps `restoring` to the splash, `signed-out` to `/marketing`, `staff` to
    `/(admin)/dashboard` and `client` to `/(client)/home`.
  - Wrap each group layout's content in `SessionGate`.
  - Luma and AppShell use `status`.

- [ ] **Step 5: Rebuild the sign-in form.**
  - Keep the layout and the role toggle, relabelled Client / Studio. Its value maps
    `"admin"` → `"staff"`.
  - Use real email and password inputs: `autoComplete` set, `secureTextEntry` on the password,
    and the email sent trimmed with the password sent as typed.
  - The submit button is disabled and shows progress while pending (Review Focus 5).
  - The backend's error message is shown in an `accessibilityRole="alert"` text.
  - Remove the demo note and the pre-filled emails.
  - Add a "Forgotten password?" link, opened with `Linking.openURL`, to `${webBase}/client`.
    `webBase` is `EXPO_PUBLIC_WEB_URL`, defaulting to the same origin on web.
  - Keep the button label pattern `Enter studio portal` / `Enter client portal`, because the e2e
    suites match it.
  - On web, the AppShell account menu shows "Switch to studio portal" / "Switch to client
    portal". It opens `/sign-in?role=<other>` with that role preselected, and does not sign out
    of the current role. This is the design's role-switch call.

- [ ] **Step 6: Run the reducer checks, the typecheck and the finance checks.**
  `node apps/mobile/e2e/session-state.js && pnpm typecheck:mobile && node apps/mobile/e2e/finance.js`
  Expected: all pass.

- [ ] **Step 7: Commit.** Message: `Use real backend sessions in the app with route guards`.

---

### Task 5: Browser tests of the app's web build against a real backend

**Files:**
- Create: `backend/tests/app_server.py`. It mirrors `browser_server.py`:
  - it uses database `studio_suite_app_test`;
  - `AUTH_ALLOWED_ORIGINS` and `CORS_ORIGINS` are set to the e2e static server's origin, read from
    `APP_TEST_ORIGIN`;
  - it seeds one staff identity (`staff@example.test` / `app-test-password`) and one client
    identity (`client@example.test` / `app-test-password`, `role: "client"`, `enabled: true`) in
    the same way `browser_server.py` seeds staff.
- Create: `apps/mobile/e2e/serve.js`. A shared static server for `dist-e2e` that proxies
  `/api/*` to `APP_BACKEND_URL` and keeps the existing SPA fallback. `screens.js`, `kids.js` and
  `studio.js` use it in place of their inline servers.
- Create: `apps/mobile/e2e/auth.js`, the new suite.
- Create: `apps/mobile/e2e/run.js`. It starts `app_server.py` against `BROWSER_MONGODB_URI`,
  waits for `/api/ready`, runs the suites, and stops the server.
- Modify: `apps/mobile/e2e/screens.js:29-31`, `studio.js:47` and `kids.js:119`. Change only the
  sign-in step: fill the seeded email and password, then click `Enter … portal`. All assertions
  stay unchanged.
- Modify: `apps/mobile/package.json` `e2e` script → `expo export --platform web --output-dir dist-e2e && node e2e/finance.js && node e2e/api-client.js && node e2e/session-state.js && node e2e/run.js`
- Modify: `.github/workflows/ci.yml` (infrastructure). In the web job, after the browser fixture
  dependencies install, add a step "Mobile web build against a real backend" that runs
  `pnpm e2e:mobile` with `BROWSER_MONGODB_URI` set. Flag this in the PR body.

**Interfaces:**
- Consumes: the Task 1 and 2 endpoints and the Task 4 sign-in screen.

- [ ] **Step 1: Write `e2e/auth.js`** with PASS/FAIL lines at viewports 390×844 and 1280×800.
  - The staff signs in, lands on `/dashboard`, and the session survives `page.reload()`.
  - The client signs in, lands on `/home`, and survives a reload.
  - A wrong password shows exactly `Email or password is incorrect.` and stays on `/sign-in`.
  - A signed-in client visiting `/dashboard` is redirected to `/home`.
  - Sign-out returns to the marketing page, and `/dashboard` then redirects to `/sign-in`.
  - An expired session: call `POST /__test/expire-sessions`, a route added only by
    `app_server.py`, which sets `expires_at` in the past on every staff and client session. The
    next navigation lands on `/sign-in` and shows `Your session has expired. Please sign in again.`
  - The restore state never renders seeded studio data. Check this by asserting that the dashboard
    text is absent before `/api/auth/session` resolves (delay the route with `page.route`).
  - The backend is down during restore: `/api/auth/session` is aborted with `page.route`. The page
    shows the unavailable panel, and after the route is released, Retry restores the session.

- [ ] **Step 2: Run `pnpm e2e:mobile`.** Expected: `auth.js` fails until `run.js`, `serve.js` and
  `app_server.py` exist. The older suites fail at sign-in.

- [ ] **Step 3: Implement `app_server.py`, `serve.js` and `run.js`, and update the three sign-in
  steps.**

- [ ] **Step 4: Run the whole mobile suite.**
  `BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' pnpm e2e:mobile`
  Expected:
  - every `auth.js` check passes;
  - the existing counts are unchanged: finance 22, screens 125, kids 88, studio 76.

- [ ] **Step 5: Commit.** Message: `Test the app's web build against a real backend`. The PR body
  notes the CI change.

---

### Task 6: Local development, native verification and the test report

**Files:**
- Create: `docs/app-local-development.md`. It covers:
  - starting `dockerd`, the replica set, the backend with a dev `.env`, and `pnpm mobile` for web
    or native;
  - the `EXPO_PUBLIC_API_URL` values for web (`http://localhost:8000`) and for native on a LAN
    (`http://<machine-ip>:8000`);
  - the dev backend's `AUTH_ALLOWED_ORIGINS` / `CORS_ORIGINS`, including `http://localhost:8081`.
- Create: `backend/seed_dev_accounts.py`, for development only. It refuses to run when
  `ENVIRONMENT=production`. It:
  - provisions the staff account with `change_staff("provision", …)`;
  - creates the client through the real path: a public enquiry through the entry endpoint, a staff
    invitation, then invitation acceptance with a password;
  - takes passwords from interactive `getpass`, like `staff.py`.
- Modify: `backend/.env.example` and `apps/mobile/.env.example` (create if absent). Add the
  variables above with placeholder values.
- Modify: `README.md`, the "Run the mobile app" section. Link the new doc.
- Create: `test_reports/2026-11-15-app-foundation.md`.

- [ ] **Step 1: Write a backend test** `tests/test_seed_dev_accounts.py::test_seed_creates_staff_and_client_through_real_paths`.
  - Run the seed's core coroutine with passwords supplied directly.
  - Assert that both accounts can sign in through `/api/auth/token` and `/api/auth/client/token`.
  - Assert that the client has an access grant to the seeded enquiry.
  - Add `test_seed_refuses_production`, where `ENVIRONMENT=production` raises.

- [ ] **Step 2: Run it and confirm it fails.** Then implement `seed_dev_accounts.py`, and run it
  again until it passes.

- [ ] **Step 3: Native check.**
  - Follow the doc with Expo on an iOS simulator, an Android emulator or a device.
  - Check: sign in as staff, kill and relaunch the app (it stays signed in), sign out (it returns
    to marketing), then sign in as client.
  - If no simulator, emulator or device is available in the session, record that in the test
    report as **not run**, with the reason. Never record it as passed.

- [ ] **Step 4: Full verification.**
  - `ruff check`;
  - the backend suite against the replica set;
  - `export_database_schemas.py --check`;
  - `pnpm lint:web`;
  - `pnpm typecheck:mobile`;
  - `pnpm e2e:mobile`;
  - `node scripts/check-design.mjs`.

  Expected: all green. Write the counts into the test report, together with every Review Focus
  item and the test that covers it.

- [ ] **Step 5: Commit.** Message: `Document local app development, add the dev account seed and the
  test report`.
