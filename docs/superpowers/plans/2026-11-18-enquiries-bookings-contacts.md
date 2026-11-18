# Enquiries, Bookings and Contacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put six studio surfaces of the Expo app on real backend data, on desktop web and phone:
the public enquiry sheet, Inquiries, Bookings, the Shoot Tracker, Contacts and the Dashboard.
Every feature trimmed along the way is recorded so it can be built back.

**Architecture:**
- **Endpoint modules:** typed endpoint modules sit on the step-1 `ApiClient`.
- **Data layer:** TanStack Query is the only data layer. Query keys are rooted at the signed-in
  identity, and one tested invalidation map says what each write refreshes.
- **Backend:** it gains one read-only change, cursor paging and a planned-date order for
  `GET /api/studio/bookings`, plus the three items step 1 deferred.
- **Screens:** they keep their layouts and lose what the backend cannot hold.

**Tech Stack:**
- Backend: FastAPI, Motor, MongoDB 7.0.16 replica set, pytest with the httpx ASGI client.
- App: Expo SDK 51, Expo Router 3.5, React 18.2, React Native 0.74, TypeScript 5.4,
  `@tanstack/react-query` 5.59.0.
- Tests: node unit checks (TypeScript transpiled, as in `e2e/api-client.js`), and Playwright
  browser suites run by `e2e/run.js` against a real backend.

**Spec:** `docs/superpowers/specs/2026-11-16-enquiries-bookings-contacts-design.md` (approved
18 November 2026). Read it before any task. Its "Deferred, recorded as trimmed" table is the
starting trimmed list.

## Global Constraints

- **The backend is the source of truth.** Screens show only what it holds. No seeded data and no
  faked behaviour on a step-2 surface.
- **Backend business behaviour does not change**, except the bookings paging in Task 1. No new
  enquiry states, booking fields, contact creation or availability endpoint.
- **Planning → confirmed stays refused (409).** The app offers a live "Confirm booking" that sends
  the real PATCH and shows the backend's message.
- **Every write sends the record's revision.** A 409 keeps the user's draft and offers
  "Keep my draft against the latest" or "Use the saved version". There are no optimistic updates.
- **Query keys are rooted at the signed-in identity**, `staff:<identity.id>`, and the cache is
  cleared on every identity change. Studio queries run only while the session status is `staff`.
- **Every removal is recorded.** Each task lists its trims. Anything removed but not listed fails
  review.
- **Existing tests are never deleted to get green.** A replaced check is listed in its task, and
  the controller lists it on PR #8.
- **No change to `.github/workflows/`, `railway.toml` or Railway settings.** Adding suites to
  `apps/mobile/package.json` `e2e` or to `e2e/run.js` is allowed (the owner was told). Anything
  beyond that: stop and ask.
- **Python lines are at most 100 characters.** Run `cd backend && .venv/bin/ruff check .` before
  every commit. Never run `ruff format` across the repo.
- **The repo is public:** no secrets or real personal data, only `example.test` addresses in
  fixtures.
- **Session code is security-sensitive.** `src/state/session.tsx` is not changed in this plan.
- **Calendar dates** (`preferred_date`, `scheduled_date`) are `YYYY-MM-DD` strings. They are shown
  by reformatting the string, never by passing them through `Date`, so the display never shifts
  with the time zone.
- **The Illuminate Kids panels** (`KidsOverview`) on the Dashboard, Bookings, Inquiries and Tracker
  stay seeded, keep their headings, and gain a visible label: "Sample data until Illuminate Kids is
  connected."
- **Draft PR #8 only.** Never approve or merge.
- **The test environment:**
  - Start dockerd, then run `bash backend/tests/start_mongodb.sh`. If it reports a name conflict,
    first run `docker rm -f studio-suite-ci-mongo`.
  - Run backend tests with
    `TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3'`. `pytest.ini` already sets
    `-q`, so don't add `-q`, or the summary line disappears.
  - Run browser suites with
    `BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' APP_TEST_PYTHON=/home/user/potential-octo-adventure/backend/.venv/bin/python`.
  - Never run two `e2e/build.js` or `run.js` processes at once: they share `dist-e2e`.

## Review Focus

These five inputs are implied by the spec but easy to miss. Each is pinned by a test in the task
that owns the code.

1. **Changing the status filter while on page 2 of the inbox.** The cursor is tied to its status,
   so the app must drop it and load page 1, never show the backend's 422. (Task 5)
2. **Double-clicking Save, "Create planning booking" or a state move.** This sends one request and
   gives one outcome. A repeated create returns the same booking. (Tasks 6 and 7)
3. **Staff A signs out and staff B (or a client) signs in on the same browser.** Nothing of A's is
   ever visible, not even for one frame. (Task 3 unit test; Task 10 browser test)
4. **The network drops in the middle of a save.** The draft is kept, a retryable "temporarily
   unavailable" message shows, and "Saved" is never claimed. (Task 6)
5. **A viewer in another time zone**, such as Los Angeles. Planned and preferred dates show exactly
   as stored. (Tasks 4 and 7, with a Playwright context `timezoneId: 'America/Los_Angeles'`)

---

### Task 1: Bookings paging in the backend

**Files:**
- Modify: `backend/bookings.py` (models, `ensure_indexes`, `list_bookings`)
- Modify: the schema manifest that `backend/export_database_schemas.py --check` verifies (regenerate it with that script)
- Test: `backend/tests/test_bookings.py`

**Interfaces:**
- Produces: `GET /api/studio/bookings`
  - Query parameters: `state` (as today), `limit` (1–100, default 50), `order`
    (`"updated"` | `"scheduled"`, default `"updated"`), `from` (`YYYY-MM-DD`, only with
    `order=scheduled`; with `order=updated` it is a 422) and `cursor` (opaque string, 1–512
    characters).
  - Response: `BookingPage { items: BookingSummary[]; next_cursor: str | None }`.
  - Order `updated` sorts by `[("updated_at", -1), ("_id", -1)]`, which is today's. Order
    `scheduled` sorts by `[("scheduled_date", 1), ("_id", 1)]`.
  - The cursor encodes `{version: 1, order, state, from, last sort values}`, in the same base64
    JSON style as `studio_enquiries.py` (`Cursor`, `page_query`, `next_cursor`). A cursor whose
    order, state or from don't match the request, or one that is malformed, gives a 422 with
    "Invalid booking cursor. Refresh the list."

- [ ] **Step 1: Write the failing tests** in `test_bookings.py`, seeding bookings through the real create path (`POST /api/studio/enquiries/{id}/booking`) plus PATCHes for dates. Write these tests:
  - `test_list_default_order_unchanged`: with no new parameters, items come in the same order as before and `next_cursor` is `None` when everything fits.
  - `test_list_pages_updated_order_completely`: with 7 bookings and `limit=3`, follow `next_cursor` to the end. Expect 3+3+1 items, every id exactly once, and descending `updated_at`.
  - `test_list_pages_scheduled_order_completely`: the same with `order=scheduled`. Dates come ascending, ties are broken by id ascending, and there are no duplicates or gaps.
  - `test_scheduled_from_filters`: `order=scheduled&from=2027-03-01` returns only `scheduled_date >= "2027-03-01"`.
  - `test_state_filter_with_paging`: `state=planning&limit=2` pages only planning bookings.
  - `test_bad_cursor_refused`: a malformed cursor, a cursor reused with a different order, and one reused with a different state each give 422 with the message above.
  - `test_from_requires_scheduled_order`: `from` without `order=scheduled` gives 422.
- [ ] **Step 2: Run them to see them fail.** Run `cd backend && TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' .venv/bin/pytest tests/test_bookings.py`. Expected: the new tests FAIL, because the parameters are unknown and the response has no `next_cursor`.
- [ ] **Step 3: Implement it** in `bookings.py`. Add `next_cursor` to `BookingPage`, and add `BookingCursor` and the query construction. Add indexes `[("scheduled_date", 1), ("_id", 1)]` and `[("state", 1), ("scheduled_date", 1), ("_id", 1)]` in `ensure_indexes`. Fetch `limit + 1` to decide `next_cursor`.
- [ ] **Step 4: Run the tests and schema check.** Run the Step 2 command, then `.venv/bin/python export_database_schemas.py --check`. If the check reports drift, regenerate with the script and rerun. Expected: all pass, and the manifest is current.
- [ ] **Step 5: Run the full backend suite and lint.** Run `.venv/bin/ruff check .`, then the full pytest. Expected: ruff clean, and 426 + the new tests passed, 2 skipped.
- [ ] **Step 6: Commit.**

**Trimmed in this task:** none.

---

### Task 2: The step-1 backend follow-ups

**Files:**
- Modify: `backend/auth.py` (`token_login`), `backend/client_access.py` (`token_login` route), `backend/clients.py` or `backend/auth.py` (the new model's home)
- Modify: `backend/tests/test_bearer_sessions.py`

**Interfaces:**
- Produces: `TokenSessionResponse(BaseModel)` with fields `identity: PublicIdentity` (the shape `public_identity` returns), `token: str`, `expires_at: datetime` and `expires_in_seconds: int`. It is used as `response_model` on both `POST /api/auth/token` and `POST /api/auth/client/token`. The JSON stays identical to today's.

- [ ] **Step 1: Write the failing tests:**
  - `test_token_responses_share_one_model`: both endpoints' bodies have exactly the keys `{"identity","token","expires_at","expires_in_seconds"}`, and `app.openapi()` lists the same schema name for both 200 responses.
  - `test_bearer_write_through_public_content_fence`: a bearer staff token sends `POST /api/studio/content/draft` with a valid body (copy the shape from `test_public_content.py`) and no Origin or CSRF. Expect 200.
  - `test_bearer_write_through_booking_drafts_fence`: a bearer staff token sends `POST /api/studio/enquiries/{id}/booking-draft` for a seeded enquiry (copy the setup from `test_booking_drafts.py`). Expect 200, and the draft is stored.
  - `test_bearer_write_fences_refuse_revoked_token`: after the bearer session is revoked, both writes give 401.
- [ ] **Step 2: Run them to see them fail.** Run `.venv/bin/pytest tests/test_bearer_sessions.py`. Expected: the model test fails; the fence tests may pass already, and if so they are kept as regression coverage, which is their purpose.
- [ ] **Step 3: Implement `TokenSessionResponse`** and set it as `response_model` on both routes. Remove the hand-built dicts' duplication only as far as the model requires.
- [ ] **Step 4: Run the tests.** Run `ruff check .` and the full pytest. Expected: all green.
- [ ] **Step 5: Commit.**

**Trimmed in this task:** none.

---

### Task 3: The data layer, test fixtures and error messages

**Files:**
- Modify: `apps/mobile/package.json` (add `"@tanstack/react-query": "5.59.0"`, an exact pin; add `node e2e/query.js` to the `e2e` script after `session-state.js`), and `pnpm-lock.yaml` via `pnpm install`
- Create: `apps/mobile/src/query/keys.ts`, `src/query/invalidation.ts`, `src/query/QueryProvider.tsx`, `src/query/retry.ts`
- Modify: `apps/mobile/app/_layout.tsx` (`QueryProvider` directly inside `SessionProvider`)
- Modify: `apps/mobile/src/api/client.ts` (422 list messages)
- Modify: `backend/tests/app_server.py` (test-only fixture routes)
- Create: `apps/mobile/e2e/query.js` (node unit checks); create `apps/mobile/e2e/fixtures.js` (a helper used by the browser suites)
- Test: `apps/mobile/e2e/query.js`, `apps/mobile/e2e/api-client.js`

**Interfaces:**
- Produces (`src/query/keys.ts`), with every key relative to the identity root:
  - `keys.enquiryList({ status?: TriageStatus; cursor?: string })` → `["enquiries","list",{status,cursor}]`
  - `keys.enquirySearch({ query: string; status?: TriageStatus; offset: number })` → `["enquiries","search",{…}]`
  - `keys.enquiryDetail(id: string)` → `["enquiries","detail",id]`
  - `keys.bookingList({ state?: BookingState; order: "updated"|"scheduled"; from?: string; cursor?: string })` → `["bookings","list",{…}]`
  - `keys.bookingDetail(id)` → `["bookings","detail",id]`
  - `keys.contactList({ after?: string })` → `["contacts","list",{after}]`
  - `keys.contactDetail(id, { after?: string })` → `["contacts","detail",id,{after}]`
  - `keys.reporting()` → `["reporting"]`
  - `keys.dashboard()` → `["dashboard"]`
  - `type TriageStatus = "new"|"in_review"|"archived"` and `type BookingState = "planning"|"confirmed"|"preparation"|"shoot"|"gallery_preparation"|"delivered"|"cancelled"` are exported from `keys.ts` and reused by the endpoint modules.
- Produces (`src/query/invalidation.ts`):
  - `type Mutation = {kind:"triageSave";enquiryId:string} | {kind:"bulkTriage";enquiryIds:string[]} | {kind:"createBooking";enquiryId:string} | {kind:"bookingUpdate";bookingId:string} | {kind:"grantRevoke";clientId:string}`
  - `invalidationsFor(m: Mutation): ReadonlyArray<readonly unknown[]>` returns relative prefixes, exactly as in the test below.
- Produces (`src/query/QueryProvider.tsx`):
  - `QueryProvider`;
  - `useIdentityRoot(): string | null`, which is `"staff:<id>"` while the status is `staff`, `"client:<id>"` for clients, otherwise `null`;
  - `useStudioQuery<T>(key: readonly unknown[], fn: () => Promise<T>, options?)`, which prefixes the root and is enabled only when the root starts with `staff:`;
  - `useStudioMutation<V, R>(fn: (v: V) => Promise<R>, toMutation: (v: V, r: R) => Mutation)`, which on success invalidates `[root, ...prefix]` for each prefix and ignores calls while one is pending.
- Produces (`src/query/retry.ts`): `shouldRetry(failureCount: number, error: unknown): boolean`. It returns true only for `ApiError` of kind `unavailable` while `failureCount < 2`.
- Produces (backend test-only routes, in `app_server.py` only):
  - `POST /__test/studio-reset` empties `booking_requests`, `bookings`, `client_access` and `client_invitations`.
  - `POST /__test/studio-fixture`:
    - Body: `{ enquiries?: [{ name, email?, preferred_date, event_type?, collection?, studio_status? }], bookings?: [{ enquiry: number, state, scheduled_date }], grants?: [{ enquiry: number }] }`.
    - Returns `{ enquiries: [{ id, reference }], bookings: [{ id }], grants: [{ id }] }`.
    - Documents get the same field set the real write paths produce. Copy it from `entry.py` `book()`, `bookings.py` `create_booking` and the grant written in `client_access.py` `accept`. Grants are for the fixture client `app-client`.
    - `studio_status` may be any string, so legacy values can be seeded.
- Produces (`e2e/fixtures.js`): `reset(backend)`, `seed(backend, body)` and `signInStaff(pg, base)`, shared by Tasks 4–10.

- [ ] **Step 1: Write the failing unit checks** in `e2e/query.js` (transpile `keys.ts`, `invalidation.ts` and `retry.ts` like `api-client.js` does):
  - `invalidationsFor({kind:"triageSave",enquiryId:"e1"})` deep-equals `[["enquiries","detail","e1"],["enquiries","list"],["enquiries","search"],["reporting"],["dashboard"]]`.
  - `bulkTriage` with `["e1","e2"]` returns the two detail keys followed by `["enquiries","list"],["enquiries","search"],["reporting"],["dashboard"]`.
  - `createBooking` "e1" returns `[["bookings","list"],["dashboard"],["enquiries","detail","e1"]]`.
  - `bookingUpdate` "b1" returns `[["bookings","detail","b1"],["bookings","list"],["dashboard"]]`.
  - `grantRevoke` "c1" returns `[["contacts","detail","c1"],["contacts","list"],["reporting"]]`.
  - Every key from `keys.*` starts with one of the prefixes above, so invalidation can reach it.
  - `shouldRetry`: unavailable at counts 0 and 1 is true, at 2 false; unauthorized, forbidden, not_found, conflict and invalid are always false.
  - Two identity roots produce disjoint full keys for the same relative key (Review Focus 3).
- [ ] **Step 2: Write the failing api-client check** in `e2e/api-client.js`: a 422 with `{"detail":[{"loc":["body","email"],"msg":"Value error, Provide a valid email address"},{"loc":["body","name"],"msg":"String should have at least 1 character"}]}` gives an `ApiError` of kind `invalid` with the message `"Provide a valid email address. String should have at least 1 character."`.
- [ ] **Step 3: Run them to see them fail.** Run `cd apps/mobile && node e2e/query.js; node e2e/api-client.js`. Expected: query.js fails on missing modules, and the api-client 422 check fails.
- [ ] **Step 4: Implement it.**
  - Write the modules above.
  - In `client.ts`, when `detail` is an array, join each `msg` with the `"Value error, "` prefix stripped, each ending with a full stop.
  - In `QueryProvider`:
    - Create one `QueryClient` with `retry: shouldRetry` and `staleTime: 30_000`.
    - Watch `useIdentityRoot()` and call `queryClient.clear()` whenever it changes.
    - On native, wire `focusManager.setEventListener` to `AppState` `change` events.
  - Add the two test-only routes to `app_server.py`, with the same "Test-only (this file, never the real app)" docstring as the existing ones.
- [ ] **Step 5: Run the checks.** Run `node e2e/query.js && node e2e/api-client.js && cd ../.. && pnpm typecheck:mobile && cd backend && .venv/bin/ruff check .`. Expected: all pass.
- [ ] **Step 6: Run the full app suite.** Run `pnpm e2e:mobile` from the repo root, with the env above. Expected: every existing suite passes unchanged, and query.js passes.
- [ ] **Step 7: Commit.**

**Trimmed in this task:** none.

---

### Task 4: The public enquiry sheet

**Files:**
- Create: `apps/mobile/src/api/publicEnquiry.ts`, `apps/mobile/src/data/dates.ts`
- Modify: `apps/mobile/src/components/EnquirySheet.tsx`
- Modify: `apps/mobile/e2e/studio.js` (replace the "Public: Begin an enquiry" section)
- Test: `apps/mobile/e2e/query.js` (mapping checks), `apps/mobile/e2e/studio.js`

**Interfaces:**
- Consumes: `ApiClient` from `useSession().api` (it works while signed out).
- Produces:
  - `type EventType = "Wedding"|"Editorial"|"Family"|"Portrait"|"Brand / Commercial"|"Other"`;
  - `type CollectionChoice = "Essentials"|"Signature"|"Atelier"|"Not sure yet"`;
  - `collectionValue(c: CollectionChoice): "essentials"|"signature"|"atelier"|"undecided"`;
  - `interface EnquirySubmission { request_id: string; name: string; email: string; phone: string; event_type: EventType; preferred_date: string; collection: "essentials"|"signature"|"atelier"|"undecided"; venue: string; message: string; consent: true }`;
  - `submitEnquiry(api: ApiClient, body: EnquirySubmission): Promise<{ reference: string; booking_state: string }>` sends `POST /api/bookings`;
  - in `dates.ts`: `melbourneToday(): string` (`YYYY-MM-DD`, via `Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" })`) and `calendarLabel(iso: string): string` (`"2027-06-14"` → `"14 Jun 2027"`, parsed from the string, never through `Date`). Tasks 7 and 10 consume both.

Behaviour:
- **Form:** the sheet keeps its three steps. It adds the "Other" event type, the "Not sure yet" collection and an unticked consent checkbox labelled "I agree to Illuminate Studios contacting me about this enquiry". "Send tentative request" is refused until consent is ticked, with the message "Please confirm we may contact you."
- **request_id:** one `request_id` (a UUID generated in the app) per filled form, reused on retry. A new id is generated after success or after a 409.
- **Errors:** 422 shows the joined field messages; 429 shows the backend message; unavailable shows "The studio is temporarily unavailable. Please try again."
- **Success:** shows the reference.
- **Date picker:** it no longer reads `confirmedDates` or `useRecords` at all. Past dates are refused in the app with `melbourneToday()`.

- [ ] **Step 1: Write the failing unit checks** in `query.js`: `collectionValue` maps all four choices; a built `EnquirySubmission` has exactly the backend's keys (name, email, phone, event_type, preferred_date, collection, venue, message, consent, request_id); and Melbourne's "today" helper returns `YYYY-MM-DD`.
- [ ] **Step 2: Rewrite the "Public: Begin an enquiry" section of `studio.js`** against the real backend, at both viewports (phone 390×844 and tablet-land 1180×820, as the suite uses). Call `reset` first. Write these checks:
  - the sheet opens on the date step, with no prices;
  - Continue needs a date;
  - details need a name, a valid email and consent;
  - "Other" and "Not sure yet" are selectable;
  - after sending, the reference matches `/IS-[0-9A-F]{12}/`;
  - the enquiry then appears in staff `GET /api/studio/enquiries`, read through `fetch` against the backend with a staff bearer token from `/api/auth/token`;
  - a context with `timezoneId: 'America/Los_Angeles'` sends 14 June 2027, and the stored `preferred_date` is `"2027-06-14"` (Review Focus 5);
  - a resend after an aborted response (route the first POST to `abort`, then retry) creates exactly one enquiry.
- [ ] **Step 3: Run them to see them fail.** Run `node e2e/build.js && node e2e/run.js studio`. Expected: the new checks FAIL. Run the suite this way in every later task.
- [ ] **Step 4: Implement `publicEnquiry.ts`** and the sheet changes.
- [ ] **Step 5: Run the checks.** Run `node e2e/query.js`, typecheck, then the Step 3 command. Expected: the public section passes. The other sections may fail until their tasks replace them; record which.
- [ ] **Step 6: Commit.**

**Trimmed in this task:** the struck-through confirmed dates on the public calendar (no availability endpoint).

**Replaced checks:**
- "a date with a confirmed booking is refused" is removed (trimmed).
- The `ENQ-` reference check becomes an `IS-` reference check.

---

### Task 5: The Inquiries list, search, bulk triage and the live new-enquiry count

**Files:**
- Create: `apps/mobile/src/api/studio/enquiries.ts`, `apps/mobile/src/api/studio/operations.ts`, `apps/mobile/src/api/studio/reporting.ts`
- Modify: `apps/mobile/app/(admin)/inquiries.tsx` (the list side), `apps/mobile/app/(admin)/_layout.tsx` (badge), `apps/mobile/src/components/Luma.tsx` and `apps/mobile/app/(admin)/content.tsx` (the count only)
- Create: `apps/mobile/e2e/studio-data.js` (the new browser suite); add `['studio-data.js', []]` to the suite list in `e2e/run.js`
- Test: `apps/mobile/e2e/studio-data.js`

**Interfaces:**
- Produces, in `enquiries.ts`:
  - `EnquirySummary`, `EnquiryDetail` and `EnquiryPage`, mirroring `backend/studio_enquiries.py`;
  - `listEnquiries(api, { status?: TriageStatus; cursor?: string; limit?: number }): Promise<EnquiryPage>`;
  - `getEnquiry(api, id): Promise<EnquiryDetail>`;
  - `updateEnquiry(api, id, { expected_revision: number; studio_status?: TriageStatus; studio_note?: string }): Promise<EnquiryDetail>`.
- Produces, in `operations.ts`:
  - `OperationPage { items: (EnquirySummary & { studio_status: string })[]; next_offset: number | null; window_exhausted: boolean }`;
  - `searchEnquiries(api, { query: string; status?: TriageStatus; limit?: number; offset?: number })` calls `GET /api/studio/operations/enquiries`;
  - `bulkTriage(api, { studio_status: TriageStatus; items: { id: string; expected_revision: number }[] }): Promise<BulkResponse>`, with `BulkResponse` mirroring `backend/enquiry_operations.py`.
- Produces, in `reporting.ts`:
  - `StudioReport`, mirroring `backend/studio_reporting.py`;
  - `getReporting(api)`;
  - `getDashboard(api): Promise<{ active_enquiries: number; bookings: Partial<Record<BookingState, number>> }>`;
  - `useNewEnquiryCount(): number | null`, a studio query on `keys.reporting()` that returns `new_enquiries`.

Behaviour:
- **List:**
  - A status filter (All, New, In review, Archived) with cursor paging ("Next page", "First page"). Changing the filter drops the cursor (Review Focus 1).
  - A search box. A non-empty query switches the list to `searchEnquiries`, with offset paging and a "Narrow your search" note when `window_exhausted`. An unknown `studio_status` is shown as its raw value.
  - Select mode allows up to 50 selections, one status, and "Apply". Per-row outcomes are shown in plain words ("Updated", "Changed by someone else", "Not found", "Temporarily unavailable", "Stopped: sign in again", "Not attempted"). On `authorization_lost`, sign-in is required through the client's 401 path.
  - Loading, empty ("No enquiries yet." or "No enquiries match this filter.") and error-with-retry states.
- **The 6-state machine:** the list's state chips, tones and transition labels go, and `inquiries.tsx` stops importing `~/data/enquiry` for those.
- **Counts:** the badge, the Luma admin greeting and Site Content all read `useNewEnquiryCount()`. While it is `null`, the badge is hidden and the greeting uses 0 wording. Nothing else in Luma or Content changes.

- [ ] **Step 1: Write the failing browser checks** in `studio-data.js`, at phone and desktop. Call `reset` and seed 30 enquiries with statuses mixed, including one `studio_status: "legacy_waiting"`. Write these checks:
  - the list shows 25 rows, then "Next page" shows the rest;
  - on page 2, switching the filter to "New" shows page 1 of new enquiries and no error alert (Review Focus 1);
  - search for a seeded unique name finds exactly it;
  - search shows "legacy_waiting" for the legacy row;
  - bulk-set 3 rows to In review, with one row's revision made stale by a direct PATCH first, shows "Updated" ×2 and "Changed by someone else" ×1;
  - the badge count equals the reporting `new_enquiries` and drops after the bulk triage without a reload;
  - the Luma greeting shows the same number.
- [ ] **Step 2: Run them to see them fail.** Run `node e2e/build.js && node e2e/run.js studio-data`. Expected: FAIL.
- [ ] **Step 3: Implement the modules and the list side.**
- [ ] **Step 4: Run the checks** (studio-data, typecheck, `node e2e/run.js kids`). Expected: studio-data list checks pass, and the kids suite is unchanged.
- [ ] **Step 5: Commit.**

**Trimmed in this task:** the 6-state labels, tones and chips in the list, and the "N tentative requests" wording.

**Replaced checks:** none yet. The `studio.js` transitions section is replaced in Task 6.

---

### Task 6: Inquiry detail: triage, conflict reconcile, and create or open booking

**Files:**
- Create: `apps/mobile/src/components/ReconcilePanel.tsx`
- Create: `apps/mobile/src/api/studio/bookings.ts` (the types and the create call, extended in Task 7)
- Modify: `apps/mobile/app/(admin)/inquiries.tsx` (the detail side)
- Modify: `apps/mobile/e2e/studio.js` (replace the "Studio: guarded transitions" section), `apps/mobile/e2e/studio-data.js`

**Interfaces:**
- Produces:
  - `ReconcilePanel({ savedSummary: string; onKeepDraft(): void; onUseSaved(): void })`, which renders "This changed. Review the latest version." and the two buttons "Keep my draft against the latest" and "Use the saved version";
  - in `bookings.ts`: `BookingSummary`, `BookingDetail` and `BookingPage` (with `next_cursor`), mirroring `backend/bookings.py` after Task 1;
  - `createBooking(api, enquiryId): Promise<BookingDetail>`, which calls `POST /api/studio/enquiries/{id}/booking` with body `{}`;
  - `listBookings(api, { state?, order?, from?, cursor?, limit? }): Promise<BookingPage>`.
- Consumes: `useStudioQuery` and `useStudioMutation` (Task 3), and `getEnquiry` and `updateEnquiry` (Task 5).

Behaviour:
- **Detail fields:** name, email, phone ("Not supplied"), event type, preferred date (string-formatted `DD/MM/YYYY`), collection, venue, message, consent, received, last studio update and revision.
- **Triage:** an internal status select and a private note (2,000-character limit, with a counter). "Save changes" is disabled while pending.
- **On 409:** keep the draft and show `ReconcilePanel`. "Keep my draft" rebases onto the latest revision; "Use the saved version" replaces the draft.
- **On a network failure or 503:** the draft is kept, "The studio is temporarily unavailable. Please try again." is shown, and no "Changes saved." appears (Review Focus 4).
- **Booking:** "Open booking" shows if `listBookings({ order: "updated", limit: 100 })` has an item with this `source_enquiry_id`. Otherwise "Create planning booking", which then shows "Open booking". "Open booking" navigates to `/(admin)/bookings?id=<bookingId>`.
- **Removed:** the transition buttons, the audit trail and "Add to contacts".

- [ ] **Step 1: Write the failing checks** in `studio-data.js`, at both viewports, with fresh seeds:
  - a triage save shows "Changes saved." and persists across a reload;
  - a stale save (bump the revision with a direct PATCH) shows the reconcile panel, keeps the draft text, and each of the two choices behaves as described;
  - a route to the PATCH that aborts keeps the draft, shows the unavailable message and never shows "Changes saved." (Review Focus 4);
  - double-clicking "Save changes" sends exactly one PATCH (count the requests with `pg.on('request')`);
  - double-clicking "Create planning booking" creates exactly one booking, then "Open booking" appears (Review Focus 2);
  - reopening the enquiry shows "Open booking", not "Create".
- [ ] **Step 2: Rewrite the "Studio: guarded transitions" section of `studio.js`** as triage on a real enquiry: filter, open, save the status and note, then create a planning booking. Remove the 6-state transition checks.
- [ ] **Step 3: Run them to see them fail.** Run `node e2e/build.js && node e2e/run.js studio-data studio`. Expected: FAIL.
- [ ] **Step 4: Implement it.**
- [ ] **Step 5: Run the checks** (both suites and typecheck). Expected: pass.
- [ ] **Step 6: Commit.**

**Trimmed in this task:**
- the enquiry state machine's transitions and the audit trail;
- "Confirm booking" needing a linked contact and a free date;
- "Add to contacts";
- the invitations, documents, conversation and booking-draft panels, which were never in the app; they are recorded for parity with the web portal.

**Replaced checks:** the guarded-transition checks in `studio.js` (list them by name in the commit message).

---

### Task 7: Bookings list and detail

**Files:**
- Modify: `apps/mobile/src/api/studio/bookings.ts` (add `getBooking` and `updateBooking`)
- Modify: `apps/mobile/app/(admin)/bookings.tsx`, `apps/mobile/src/components/BookingDetail.tsx`
- Test: `apps/mobile/e2e/studio-data.js`, `apps/mobile/e2e/query.js`

**Interfaces:**
- Produces:
  - `getBooking(api, id): Promise<BookingDetail>`;
  - `updateBooking(api, id, { expected_revision: number; scheduled_date?: string; location?: string; staff_note?: string; state?: BookingState }): Promise<BookingDetail>`;
  - `BOOKING_STATE_LABELS: Record<BookingState, string>`, with exactly: planning "Planning", confirmed "Confirmed", preparation "Preparation", shoot "Shoot", gallery_preparation "Selected-gallery preparation", delivered "Delivered", cancelled "Cancelled";
  - `NEXT_STATE: Partial<Record<BookingState, BookingState>>`, with planning→confirmed, confirmed→preparation, preparation→shoot, shoot→gallery_preparation, gallery_preparation→delivered and cancelled→planning;
- Consumes: `calendarLabel` and `melbourneToday` from `src/data/dates.ts` (Task 4).

Behaviour:
- **List:** a state filter and cursor paging. Each row shows the reference, client, event and planned date. Master/detail on wide screens, a sheet on compact screens (keep `bookings.tsx`'s layout switch). `?id=` opens that booking.
- **Detail:** client, stage, planned date, location, staff note, revision and the state history (from, to, at).
- **Editing:** date, location and note, revision-safe with `ReconcilePanel`. State actions are blocked while edits are unsaved, with the notice "Save or discard your detail changes before changing the booking stage."
- **State actions:**
  - "Confirm booking" (planning) sends the PATCH, and the backend's 409 message is shown as an alert.
  - "Move to <next>" for the later states.
  - "Cancel booking" unless cancelled or delivered.
  - "Reopen to planning" when cancelled.
- **Removed:** the Payment card (total, retainer, balance), the Documents and Brief buttons, value, package, time and booked-by.

- [ ] **Step 1: Write the failing unit checks** in `query.js`: `calendarLabel("2027-06-14") === "14 Jun 2027"` with `process.env.TZ` set to `America/Los_Angeles` and to `Pacific/Kiritimati` (child processes); and `NEXT_STATE` and `BOOKING_STATE_LABELS` exactly as above.
- [ ] **Step 2: Write the failing browser checks** in `studio-data.js`, at both viewports, seeding 55 bookings across states:
  - paging reaches all 55 with no duplicates;
  - the state filter works;
  - editing the location saves;
  - a stale edit shows the reconcile panel;
  - "Confirm booking" on a planning booking shows the backend's message, "Confirmation is unavailable until resource capacity, scheduling, approval, contract and payment checks are implemented.", and the state stays Planning;
  - a seeded `shoot` booking moves to "Selected-gallery preparation";
  - cancel, then reopen to planning;
  - a double-clicked state move sends one PATCH (Review Focus 2);
  - in a `timezoneId: 'America/Los_Angeles'` context, a booking stored as `2027-06-14` shows "14 Jun 2027" (Review Focus 5).
- [ ] **Step 3: Run them to see them fail.** Expected: FAIL.
- [ ] **Step 4: Implement it.**
- [ ] **Step 5: Run the checks** (query.js, studio-data, kids, typecheck). Expected: pass, and kids is unchanged, including "bookings page shows the Kids summary once".
- [ ] **Step 6: Commit.**

**Trimmed in this task:** price or value, package, time of day, booked-by, the client brief, the Payment card (total, retainer paid, balance due), and the Documents and Brief buttons.

---

### Task 8: The Shoot Tracker

**Files:**
- Create: `apps/mobile/src/data/shootPhases.ts`
- Modify: `apps/mobile/app/(admin)/tracker.tsx`
- Test: `apps/mobile/e2e/query.js`, `apps/mobile/e2e/studio-data.js`

**Interfaces:**
- Produces:
  - `LADDER: { key: string; label: string; description: string; states: BookingState[] }[]`, in this order:
    1. "Inquiry Received" [planning]
    2. "Date Confirmed" [confirmed, preparation]
    3. "Shoot Day" [shoot]
    4. "Curating Your Gallery" [gallery_preparation]
    5. "Gallery Delivered" [delivered]

    The descriptions are copied from `PHASES` in `src/data/seed.ts` for the same labels.
  - `phaseFor(state: BookingState): { index: number; label: string } | { index: null; label: "Cancelled" }`, where preparation's label is `"Date Confirmed (pre-shoot consultation)"`.
- Consumes: `listBookings` and `updateBooking`, `NEXT_STATE` and `BOOKING_STATE_LABELS` (Task 7).

Behaviour:
- Each booking shows its phase on the ladder. Cancelled bookings sit in a separate "Cancelled" group with "Reopen to planning".
- The advance action is the booking's next state, through `updateBooking`. Planning shows the live "Confirm booking", which shows the 409 message.
- A one-line note: "New bookings stay at Inquiry Received until confirmation checks are available."
- The tracker no longer reads `PHASES` or `setBookingPhase`.

- [ ] **Step 1: Write the failing unit checks:** `phaseFor` for all 7 states, and `LADDER` labels in order.
- [ ] **Step 2: Write the failing browser checks**, at both viewports:
  - seeded bookings in each state appear at the right phase;
  - advancing a `preparation` booking moves it to Shoot Day and persists across a reload;
  - a planning booking's Confirm shows the 409 message;
  - a cancelled booking reopens to Inquiry Received.
- [ ] **Step 3: Run them to see them fail.**
- [ ] **Step 4: Implement it.**
- [ ] **Step 5: Run the checks.**
- [ ] **Step 6: Commit.**

**Trimmed in this task:** the "Agreement Sent", "Deposit Pending" and "Archived" phases, and free phase-setting independent of booking state.

---

### Task 9: Contacts

**Files:**
- Create: `apps/mobile/src/api/studio/contacts.ts`
- Modify: `apps/mobile/app/(admin)/contacts.tsx`
- Modify: `apps/mobile/e2e/studio.js` (replace the "Directory: three tabs" section, and remove the "A confirmed date becomes unavailable to the public" section)
- Test: `apps/mobile/e2e/studio-data.js`, `apps/mobile/e2e/studio.js`

**Interfaces:**
- Produces:
  - `ContactSummary { id; name; email; enabled: boolean }`;
  - `ContactPage { items; next_cursor: string | null }`;
  - `ContactDetail { identity: ContactSummary; relationships: { grant_id: string; enquiry: EnquirySummary | null; access_active: boolean }[]; next_cursor: string | null }`;
  - `listContacts(api, { after?: string; limit?: number })`;
  - `getContact(api, id, { after?: string })`;
  - `revokeGrant(api, enquiryId: string, grantId: string): Promise<unknown>`, which calls `POST /api/studio/enquiries/{eid}/client-access/{gid}/revoke` with body `{}`.

Behaviour:
- **Clients only.** Each row shows the name, email and "Access enabled" or "Access disabled", paged with "More clients" (passing `next_cursor` as `after`).
- **Detail:** the identity, then the relationships (enquiry reference, event, date and "Access active" or "Access ended"), paged the same way.
- **Revoke:** "Revoke access" on an active relationship asks for confirmation with the text "This ends <name>'s access to <reference> and cancels any pending invitations for it." On success it shows "Access ended".
- **Removed:** the Contacts (all) and Partners tabs, add-contact, tags, phone, assigned, the stage filter and the partner search. The Finance → Suppliers "Add partner" deep link now lands on Clients without opening a form. Check `app/(admin)/finance.tsx` for the link: its button stays but the form target is gone; record it.

- [ ] **Step 1: Write the failing browser checks**, at both viewports:
  - seed 27 enquiries with grants for `app-client`, plus one revoked grant;
  - the client list shows App Client as "Access enabled";
  - the detail shows 25 relationships, then "More" shows 3;
  - the revoked one shows "Access ended";
  - revoking one shows "Access ended" and the reporting `active_access_grants` drops by one;
  - no Partners tab is present.
- [ ] **Step 2: Rewrite the `studio.js` directory section** as the clients view, and delete the "confirmed date becomes unavailable" section. List the removed check names in the commit message.
- [ ] **Step 3: Run them to see them fail.**
- [ ] **Step 4: Implement it.**
- [ ] **Step 5: Run the checks** (studio-data, studio, kids, the Finance suite `node e2e/finance.js`, typecheck).
- [ ] **Step 6: Commit.**

**Trimmed in this task:** the partners and suppliers tab, business type, ABN/ACN and the partner autocomplete; add contact, tags, phone, "assigned" and the stage filter; the "Add partner" landing; the all-contacts fuzzy search across enquiries and partners.

**Replaced checks:** the directory three-tab checks, and the confirmed-date unavailability checks (trimmed).

---

### Task 10: Dashboard, the in-session 401 and cache isolation

**Files:**
- Modify: `apps/mobile/app/(admin)/dashboard.tsx`, `apps/mobile/src/components/KidsOverview.tsx` (the "Sample data until Illuminate Kids is connected." label only)
- Test: `apps/mobile/e2e/studio-data.js`, `apps/mobile/e2e/auth.js`

**Interfaces:**
- Consumes: `getDashboard`, `getReporting` (Task 5); `listBookings` with `order: "scheduled"` and `from: melbourneToday()` (Tasks 6 and 7); `phaseFor` (Task 8).

Behaviour:
- **KPI tiles:** "Active enquiries" (`active_enquiries`), "New" / "In review" / "Archived" (reporting), "Bookings" (sum of the dashboard's `bookings`), "Planning" (bookings.planning ?? 0), "Clients with access" (`enabled_clients`) and "Active access grants".
- **Upcoming shoots:** up to 5 from the first page of the scheduled order, excluding cancelled and delivered. Each shows the planned date (`calendarLabel`), client, event and phase label.
- **"Observed at":** the reporting `observed_at`, in the viewer's local time.
- **Removed:** the revenue and value KPIs, the activity feed, and the money figures in the phase lane.
- **Kids panel:** `KidsOverview` keeps its headings and gains the sample-data label.

- [ ] **Step 1: Write the failing checks:**
  - in `studio-data.js`, at both viewports: the dashboard numbers equal `GET /api/studio/dashboard` and `/reporting` read directly; upcoming shoots list the soonest planned future bookings in date order and omit a cancelled one; after triaging one enquiry to archived in Inquiries, returning to the dashboard shows "Active enquiries" one lower without a reload; the Kids panel shows the sample-data label.
  - in `auth.js`, at both viewports, the in-session 401: sign in as staff, open `/inquiries`, call `/__test/expire-sessions`, change the status filter. The user lands on `/sign-in` showing "Your session has expired. Please sign in again."
  - in `auth.js`, cache isolation (Review Focus 3):
    1. Seed an enquiry named "Visible To First Login".
    2. Sign in as staff and open `/inquiries`, where it shows.
    3. Sign out, then sign in as the client.
    4. Watch every frame for that name, using `pg.waitForFunction(() => document.body.innerText.includes('Visible To First Login'), null, { timeout: 2000, polling: 'raf' })`. The name never appears; the expected outcome is a timeout.
    5. Repeat with a portal switch (staff to client without signing out) and confirm the same.
    6. Prove the cache was cleared, since every staff member legitimately sees the same studio data: after signing out, hold `GET /api/studio/enquiries` with `pg.route`, sign in as staff again and open `/inquiries`. While the request is held, the same frame watch must time out, because a surviving cache would render the name at once. Release the route; the name then appears.
- [ ] **Step 2: Run them to see them fail.** Run `node e2e/build.js && node e2e/run.js studio-data auth`.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the checks**, including `node e2e/run.js kids`. The "main dashboard carries Kids overview" check is unchanged.
- [ ] **Step 5: Commit.**

**Trimmed in this task:** the revenue and value KPIs, the recent activity feed and the phase lane's money figures.

---

### Task 11: Verification, the test report and the docs

**Files:**
- Create: `test_reports/2026-11-18-enquiries-bookings-contacts.md`
- Modify: `docs/development/app-work-plan.md` (step 2 status; open items), `docs/app-local-development.md` (the native checklist gains step-2 items)
- Modify: `apps/mobile/src/state/records.tsx` (only if a step-2 field is now unused by every remaining consumer; otherwise no change)

- [ ] **Step 1: Confirm no step-2 screen reads seeded data.** Run `grep -rn "useRecords\|~/data/seed\|~/data/enquiry" "apps/mobile/app/(admin)/"{inquiries,bookings,tracker,contacts,dashboard}.tsx apps/mobile/src/components/{EnquirySheet,BookingDetail}.tsx`. Expected: only imports of pure helpers that hold no records (for example `initials`), each named in the report.
- [ ] **Step 2: Run the full verification and record each result:**
  - `cd backend && .venv/bin/ruff check .`
  - the full pytest (record passed and skipped counts)
  - `.venv/bin/python export_database_schemas.py --check`
  - `pnpm lint:web`
  - `pnpm typecheck:mobile`
  - the full `pnpm e2e:mobile`, recording per-suite counts. The screens suite prints "N clean, M with findings".
  - `node scripts/check-design.mjs`
- [ ] **Step 3: Write the test report** in the step-1 report's format:
  - the per-suite table;
  - Review Focus coverage, each item mapped to its test names;
  - the replaced checks, by name;
  - "Native verification: NOT RUN", with the step-2 manual items added to the checklist: an enquiry from the phone, triage, a booking state move, and the cache cleared after sign-out.
- [ ] **Step 4: Update `app-work-plan.md`:**
  - step 2's status;
  - the open items: the web portal's broken `DELETE /api/studio/client-access/{id}` call, the native reconnect limit (no NetInfo), and the trimmed list (pointing at the spec table and the PR #8 comments).
- [ ] **Step 5: Commit.**

**Trimmed in this task:** none.

---

## Controller duties (not implementer steps)

After each task passes review, the controller:
1. pushes the branch;
2. posts one PR #8 comment listing the task's trims and replaced checks, with columns: surface, trimmed, why, restores in, files;
3. writes one Empirical record per trim in `studio-suite_v2`, tagged `potential-octo-adventure`, `studio-suite`, `trimmed-surface` and the surface name;
4. appends every ruling to the progress ledger.

After Task 11, the controller:
- posts the consolidated trimmed list;
- runs the final whole-branch review on the most capable model, one fix wave, then a scoped re-review.
