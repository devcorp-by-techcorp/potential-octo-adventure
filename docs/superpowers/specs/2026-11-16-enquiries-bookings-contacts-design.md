# Step 2: enquiries, bookings and contacts on real data

Date: 16 November 2026. Status: approved by the owner on 18 November 2026, including the calls listed at the end.

This is step 2 of the Studio Suite app work plan (`docs/development/app-work-plan.md`). Step 1
(`2026-11-15-app-foundation-design.md`) built the API client, hybrid sign-in and route guards.
This step puts six studio surfaces of the Expo app (`apps/mobile`) on real backend data.

## Intent

The Expo app becomes the single studio and client application, on desktop web first and native
second. Today its studio screens run on seeded, in-memory data. Step 2 makes the screens the studio
uses to take in and run work real:

- the public "Begin an enquiry" sheet;
- Inquiries;
- Bookings;
- the Shoot Tracker;
- Contacts;
- the Dashboard.

The bar is unchanged: nothing is released until every page, feature and service works against real
data and has been tested.

## Owner decisions for this step

1. **The backend is the source of truth, and the screens are trimmed to what it holds now**
   (option (a)). Where an app screen shows something the backend cannot store, the screen gives way.
   Step 2 changes no business behaviour in the backend. One owner-approved exception: read-only
   paging for the bookings list (see "Backend change: bookings paging").
2. **The shoot-phase ladder is kept**, mapped onto the backend's booking states (table below).
3. **Every trimmed feature, service or function is recorded**, so it can be built back into the
   page it came from. Each record goes in three places:
   - this document;
   - a comment on the working-branch PR (#8);
   - an Empirical record in the `studio-suite_v2` workspace, tagged `trimmed-surface`.

   A temporary loss of features is accepted; a permanent, unrecorded loss is not.
4. **Scope split** (below): search and bulk triage are in; client invitations are deferred.
5. **Data layer: TanStack Query** over typed endpoint functions on the step-1 API client. It is
   chosen for scale and for one traceable data pipeline that every later step builds on, not as a
   per-screen shortcut.
6. **Carried from the plan:**
   - booking confirmation follows the backend: an enquiry becomes a planning booking, and
     planning → confirmed stays refused (409) until the scheduling, authority and agreement/payment
     evidence checks exist;
   - one application;
   - hybrid sign-in;
   - password reset and invitation acceptance stay on the web.

## Goals

- Staff run enquiry intake and bookings from the app, on desktop web and phone, against the real
  backend, with no seeded data on these six surfaces.
- A member of the public can send an enquiry from the app's marketing page, and it lands in the
  studio's inbox.
- Every write is safe under concurrent editing: a stale edit is refused (409) and the screen offers
  "review the latest version". It never silently overwrites.
- Data is consistent across screens. A triage change updates the inbox, the new-enquiry badge and
  the dashboard without a manual reload.
- What was trimmed is fully recorded and traceable to the later step that restores it.

## Non-goals

- No new backend business features beyond the bookings paging exception. No new enquiry states, booking fields, contact creation or
  public availability endpoint.
- No booking confirmation. Planning → confirmed stays refused.
- No client invitations, enquiry documents, enquiry conversation, booking preparation drafts or
  booking resources in the app. All are deferred and recorded as trimmed.
- No change to the screens outside these six. Finance, Documents, Site Content, Staff, Illuminate
  Kids, Luma and the client portal keep their seeded data until their own steps.
- No production deployment.

## Anti-goals (failure even if it works)

- **Faked behaviour.** A screen that still pretends (a seeded number, a disabled-looking button that
  does nothing, a hard-coded "confirmed" state) on a surface claimed as real.
- **Data leaking between people.** Cached data from one signed-in user shown to the next person, or
  to a client after a portal switch. The query cache is cleared on every sign-in, sign-out, session
  expiry and portal switch.
- **Silent overwrite.** A write that ignores the record's revision.
- **An unrecorded removal.** Anything taken off a screen without a trimmed-surface record.
- **Mixing real and seeded data on one screen**, so a viewer can't tell which is which.
- **Weakening step 1's protections.** CSRF, Origin checks, the transport separation and the
  role guards stay exactly as they are.

## Scope

### In step 2

| Surface | What it does on real data | Backend endpoints |
| --- | --- | --- |
| Public enquiry sheet (marketing page, phone and desktop) | Date, event type, collection, details and an explicit consent checkbox. On success it shows the studio reference. The submission is idempotent on retry: one `request_id` per filled form. | `POST /api/bookings` (public) |
| Inquiries: list | Status filter (all, new, in review, archived) with cursor paging (`next_cursor`; a cursor is tied to its status filter, so changing the filter starts from the first page). Search box, which uses the operations endpoint: offset paging (`next_offset`, `window_exhausted`, offset capped at 10,000); its rows can carry an unknown legacy `studio_status`, shown as-is so staff can correct it. Bulk triage: select up to 50 rows, set one status, per-row outcome (`updated`, `conflict`, `not_found`, `unavailable`, `authorization_lost`, `not_attempted`). | `GET /api/studio/enquiries`, `GET /api/studio/operations/enquiries?query=`, `POST /api/studio/operations/bulk-triage` |
| Inquiries: detail | All enquiry fields; internal status and private note with revision-safe save; "review latest" when the record changed (409). If the bookings list holds a booking whose `source_enquiry_id` is this enquiry, detail shows "Open booking"; otherwise "Create planning booking". The create call is idempotent, so a booking missed by the capped list is returned, not duplicated, and then linked. | `GET`/`PATCH /api/studio/enquiries/{id}`, `POST /api/studio/enquiries/{id}/booking` |
| Bookings: list and detail | List with state filter and cursor paging (new, below). Detail: client, event, planned date, location, staff note, state history. Edit date, location and note (revision-safe). Move to the next state, cancel, reopen to planning. Confirmation is shown as unavailable, with the backend's reason. | `GET /api/studio/bookings`, `GET`/`PATCH /api/studio/bookings/{id}` |
| Shoot Tracker | The phase ladder, driven by booking state. Moving a booking along the ladder is a booking state change (the same PATCH). | as Bookings |
| Contacts | Client list, paged with the `after` request parameter (the response's `next_cursor` is passed back as `after`); contact detail with their enquiry relationships (paged the same way) and whether access is active; revoke an enquiry access grant. The revoke sends an empty JSON body, and it also revokes every pending invitation for that enquiry; the confirmation wording says so. | `GET /api/studio/contacts`, `GET /api/studio/contacts/{id}`, `POST /api/studio/enquiries/{eid}/client-access/{gid}/revoke` |
| Dashboard | Counts: active enquiries, new / in review / archived, bookings per state, enabled clients, active access grants; upcoming shoots (the soonest planned dates from today, Melbourne time, excluding cancelled and delivered); "observed at" time | `GET /api/studio/dashboard`, `GET /api/studio/reporting`, `GET /api/studio/bookings?order=scheduled&from=…` |
| New-enquiry count: the studio navigation badge, Luma's studio greeting ("N new inquiries waiting") and Site Content | One live count of new enquiries everywhere it appears. In Luma and Site Content only that value changes; the rest of those components stays seeded until their own steps. | `GET /api/studio/reporting` (`new_enquiries`) |

### Carried in from step 1's open items (required before authenticated screens)

- A browser test of the in-session 401 redirect: a session expires while the user is on a step-2
  screen, and the user is returned to sign-in with the expiry message.
- Backend bearer write tests through the `public_content` and `booking_drafts` write fences, in
  `backend/tests/`.
- A shared response model for the two token endpoints.

### Deferred, recorded as trimmed

Each entry below becomes a trimmed-surface record (see "The trimmed-surface record").

| Surface | Trimmed | Why | Restores in |
| --- | --- | --- | --- |
| Inquiries | The 6-state enquiry machine (tentative → awaiting studio → awaiting client → confirmed / needs a human / closed) and its labels, transitions and audit trail | The backend has triage status only: new, in review, archived | A later enquiry-workflow step (backend states plus an audit trail) |
| Inquiries | "Confirm booking" requiring a linked contact and a free date | Confirmation is blocked by owner decision; there is no date-conflict check | The evidence-checks step |
| Inquiries | "Add to contacts" from an enquiry | Contacts are created only by client invitation | With invitations (below) |
| Inquiries | Client invitations (issue, copy link, list, revoke) | The backend builds the link from the request Origin plus `/client/accept`, which fails from native (no Origin) and points at a page the Expo app doesn't have. A configured accept-page address is needed. | A later step that adds it (security-sensitive) |
| Inquiries | Enquiry documents panel | Step 3 scope | Step 3 |
| Inquiries | Enquiry conversation panel | Inbox is step 4 | Step 4 |
| Inquiries | Booking preparation drafts | Feeds the confirmation evidence checks | The evidence-checks step |
| Bookings | Price/value, package, time of day, "booked by", notes as the client's brief; the Payment card (total, retainer paid, balance due); the "Documents" and "Brief" buttons (no action today) | Not stored on bookings | Finance and booking-detail work (step 4); documents in step 3 |
| Bookings | Booking resources (rooms, equipment) | Feeds capacity checks | The evidence-checks step |
| Shoot Tracker | Phases "Agreement Sent", "Deposit Pending" and "Archived" | No booking state | E-signature and finance (step 4); archive policy (later) |
| Contacts | Partners and suppliers tab, business type, ABN/ACN, partner autocomplete | No backend collection | Finance and suppliers (step 4) |
| Contacts | "Add contact", tags, phone, "assigned" flag, prospect stage filter | Contacts are invited client identities only | A later contacts step |
| Contacts | Finance → Suppliers' "Add partner" landing on Contacts | Depends on partners | Step 4 |
| Public sheet | Striking through dates that already have a confirmed booking | No public availability endpoint, and no confirmed bookings can exist yet | The evidence-checks step |
| Public sheet | "Other" missing from the event types; the app's collection names map to the backend's (below) | Alignment, not removal: the backend list wins | n/a (fixed in step 2) |
| Dashboard | Revenue and value KPIs, recent activity feed, the in-progress phase lane's money figures | No backend source | Finance (step 4); an activity source (later) |
| Client portal | Its phase tracker keeps seeded data in this step | The client portal home is step 3 | Step 3 (reads `GET /api/client/bookings`) |

The builder adds to this table anything else found to be trimmed during the build. A removal found
in review that is not in the table is a review failure.

## Shoot-phase ladder mapping

The client-facing phases stay as the tracker's ladder. Booking states drive them:

| Booking state | Phase shown | Studio action on the tracker |
| --- | --- | --- |
| `planning` | Inquiry Received | A live "Confirm booking" action that sends the real state change; the backend refuses it (409) and its message is shown. When the evidence checks land, the same action starts working with no app change. |
| `confirmed` | Date Confirmed | Move to preparation |
| `preparation` | Date Confirmed (pre-shoot consultation) | Move to shoot |
| `shoot` | Shoot Day | Move to gallery preparation |
| `gallery_preparation` | Curating Your Gallery | Mark delivered |
| `delivered` | Gallery Delivered | none |
| `cancelled` | Shown apart from the ladder as Cancelled | Reopen to planning |

"Agreement Sent", "Deposit Pending" and "Archived" are not shown as reachable steps. They are
recorded as trimmed. Because planning → confirmed is refused, every new booking stays at Inquiry
Received or Cancelled until the evidence checks exist. Only records already further along can move.
The screen says so plainly, never by implication.

## Backend change: bookings paging

The owner approved this one read-only backend change, because without it the Bookings list, the
Shoot Tracker and the dashboard's upcoming shoots can never show more than 100 bookings.

`GET /api/studio/bookings` gains:
- `cursor`: an opaque cursor; the response adds `next_cursor` (null on the last page). A cursor is
  tied to its filters and order, and a mismatched or malformed cursor is a 422 with a plain message,
  following the enquiry list's pattern in `studio_enquiries.py`.
- `order`: `updated` (the default, today's newest-updated-first order) or `scheduled` (planned
  date ascending, then id).
- `from`: an optional calendar date (`YYYY-MM-DD`); with `order=scheduled` only bookings planned on
  or after it are returned.

Constraints:
- With no new parameters, the response is exactly today's (items in the same order, plus a
  `next_cursor` field), so the Vite web portal keeps working unchanged.
- `require_staff` as today; no write path changes.
- A supporting index on `(scheduled_date, _id)` (and with `state` where the filter uses it), added
  in `ensure_indexes` and in the exported schema manifest
  (`export_database_schemas.py --check` must stay current).
- Tests in `backend/tests/` against the real replica set: default order unchanged, both orders page
  completely with no duplicates or gaps across pages, the `from` filter, the state filter combined
  with paging, and bad cursors refused.

## Public enquiry sheet mapping

| App field | Backend field | Rule |
| --- | --- | --- |
| Date | `preferred_date` | ISO calendar date, today or later in Melbourne. The sheet refuses past dates before sending, and the backend's message is shown if it refuses. |
| Event type | `event_type` | One of Wedding, Editorial, Family, Portrait, Brand / Commercial, Other ("Other" is added) |
| Collection | `collection` | Essentials → `essentials`, Signature → `signature`, Atelier → `atelier`, plus "Not sure yet" → `undecided` |
| Name, email, phone, venue, message | same names | Backend limits: name 120, email 254, phone 40, venue 250, message 2000 |
| Consent | `consent: true` | An explicit checkbox; the sheet cannot send without it |
| (generated) | `request_id` | One UUID per filled form, reused on retry, so a resend never makes a duplicate. A new form gets a new id. |

Responses:
- 201 shows the reference, for example `IS-…`.
- 409 means a reused id with different content; the sheet starts a fresh form.
- 422 shows the field messages.
- 429 shows "Please wait a minute before trying again."
- 503 or a network failure shows a retryable "temporarily unavailable" message.

The endpoint is public and needs no session, so it works signed out on web and native.

## Approaches considered

1. **Each screen fetches through small shared hooks, with no data library.** Smallest and
   functional, but no shared cache: the badge and dashboard reload rather than update, and every
   later step re-solves caching and staleness. The owner rejected it as a shortcut with no benefit
   for scaling or a traceable data pipeline.
2. **Typed endpoint functions plus TanStack Query (chosen).** One cache keyed by backend resource,
   invalidation after every write, refetch on focus and reconnect, and one place to see what data a
   screen depends on. It costs a new core dependency and conventions every later step inherits.
3. **Keep `RecordsProvider`'s interface and make it backend-backed.** The screens barely change,
   but its interface assumes the 6-state enquiries, contact creation and confirmed-date checks, so
   keeping it means faking behaviour. Rejected, because it conflicts with decision 1 and hides what
   was trimmed.

## Design

### Data layer

- **Dependency:** `@tanstack/react-query` v5, pinned to an exact version. It supports React 18.2,
  React Native 0.74 and Expo 51, which the app uses.
- **Endpoint modules:** one TypeScript module per backend area, under `src/api/`: enquiries,
  operations, bookings, contacts, reporting and public enquiry. Each exports typed functions over
  the step-1 `ApiClient` (`api.request`), with request and response types mirroring the backend's
  Pydantic models. No screen calls `fetch` or `api.request` directly.
- **Query keys:** one key factory per resource, for example `["studio", "enquiries", "list",
  {status, cursor}]`, `["studio", "enquiries", "detail", id]` and `["studio", "reporting"]`. The
  keys are the single map of what depends on what.
- **Writes are mutations.** Each write invalidates the queries it affects:
  - a triage save invalidates that enquiry's detail, the enquiry lists, search results,
    reporting and the dashboard (its `active_enquiries` count excludes archived records);
  - a bulk triage invalidates every enquiry detail it touched, the enquiry lists, search results,
    reporting and the dashboard, whatever the per-row outcomes;
  - creating a booking invalidates the bookings lists, the dashboard and that enquiry's detail;
  - a booking edit or state change invalidates that booking's detail, the bookings lists, the
    dashboard and the tracker;
  - a grant revoke invalidates that contact's detail, the contacts list and reporting.
- **No optimistic updates.** Revisions are checked by the server; the screen shows the saved
  result only once the server confirms it.
- **The QueryClient is created in the root layout, inside `SessionProvider`.** Its cache is cleared
  (`queryClient.clear()`) whenever the session identity changes: sign-in, sign-out, expiry (the
  step-1 `onUnauthorized` path) and portal switch. While the session is restoring or signed out, no
  studio query runs: queries are enabled only when status is `staff`.
- **Errors:**
  - 401 goes through the step-1 client: the one-shot latch, then sign-in with the backend message.
    Queries must not retry 401, 403, 404, 409 or 422.
  - Network errors and 503 retry with backoff, up to 2 times, then show the retryable
    "temporarily unavailable" state.
  - Validation messages from FastAPI 422 lists are shown, not replaced by a generic message. This
    closes a step-1 open item for these screens.
- **Focus and reconnect:** on web, TanStack's default window focus and online handling. On native,
  `focusManager` is wired to React Native `AppState`. There is no NetInfo dependency in this step:
  reconnect refetch on native is left to focus. This is recorded as a known limit.
- **Freshness:** lists and reporting are considered fresh for about 30 seconds, then refetch on
  focus or mount. Exact values are the builder's call within that intent.

### Revision-safe editing

The enquiry and booking detail screens share one pattern:

- The edit form keeps the user's draft.
- Saving sends `expected_revision`.
- On a 409 conflict the draft is kept. A "This changed. Review the latest version." panel offers
  "Keep my draft against the latest" or "Use the saved version". This matches the web portal's
  reconcile behaviour.
- The booking detail blocks state changes while detail edits are unsaved, as the web portal does.

### Screens

- **Inquiries and Bookings keep their layouts**: master/detail side by side on wide screens, and a
  sheet or pushed detail on compact screens. They lose the fields and actions in the trimmed table.
- **The public sheet** keeps its three steps (date and session, details, received) and gains the
  consent checkbox, the "Other" event type and the "Not sure yet" collection.
- **Contacts** keeps the Clients view only. The Contacts (all) and Partners tabs are removed and
  recorded. The clients view lists invited client identities.
- **Dashboard** keeps its layout where a real figure exists and drops tiles with no backend source.
- **Every list has** loading, empty, error-with-retry and paged states.
- **The step-2 screens no longer import `useRecords`.** `RecordsProvider` stays for the screens
  outside step 2. The seeded data it held for step-2 surfaces (bookings, enquiries, contacts) stays
  only as long as those other screens need it, and nothing on a step-2 screen reads it.

### Accessibility and both form factors

Every step-2 screen is checked at phone (390×844) and desktop (1280×800) widths, as the step-1
suites already do. Controls keep accessible labels. Errors use `accessibilityRole="alert"`.

## The trimmed-surface record

- **This document's table** is the starting list. The implementation plan carries it per task.
- **PR #8:**
  - after each reviewed task, one comment lists what that task trimmed, using the same columns
    (surface, trimmed, why, restores in, files touched);
  - a final consolidated comment lists everything.
- **Empirical (`studio-suite_v2`):** one record per trimmed item, tagged `potential-octo-adventure`,
  `studio-suite`, `trimmed-surface` and the surface name (for example `inquiries`), so a later
  session can query everything to rebuild on a page.
- **The reviewer** of each task compares the diff with the task's trimmed list. Anything removed
  but unlisted fails review.

## Testing (how "done" is proven)

- **Backend (pytest against the real replica set):**
  - the three carried step-1 items;
  - the full existing suite stays green (426 passed, 2 skipped, plus the new tests).
- **App unit checks (node, no React Native):**
  - each endpoint module's request shape and response parsing;
  - the 422 list-message formatting;
  - the query-key and invalidation map (each mutation invalidates exactly the listed keys);
  - the shoot-phase mapping;
  - the public-sheet field mapping.
- **Browser checks of the web build against the real local backend**, at phone and desktop widths:
  - public enquiry sent, reference shown, enquiry visible to staff;
  - triage save, and a 409 conflict with both reconcile choices;
  - search, and bulk triage with a mixed outcome;
  - create planning booking (and idempotent re-create);
  - booking edit and state moves, confirmation refused with the message, cancel and reopen;
  - tracker phases;
  - contacts list and detail, and grant revoke;
  - dashboard counts matching the backend;
  - the new-enquiry badge updating after triage without a reload;
  - the cache cleared on sign-out and portal switch (no previous user's data visible);
  - the in-session 401 redirect.
- **Test data:**
  - the public endpoint allows 6 submissions per minute per address, so the browser suites send
    only a few enquiries through the real form;
  - the rest come from a test-only seeding route in `backend/tests/app_server.py`, which the real
    app does not have. It is the same pattern as the existing `/__test/` routes;
  - bookings in later states are seeded there too, because planning → confirmed is refused.
- **Existing seeded checks:**
  - `apps/mobile/e2e/studio.js` and `screens.js` assert seeded behaviour on these surfaces: the
    confirmed-date refusal, `ENQ-` references and the 6-state transitions;
  - those checks are replaced with real-data equivalents, never deleted to get green. Each replaced
    or removed check is listed in the plan and in the PR, beside the trimmed-surface record;
  - per step 1's rule, changing an existing test is raised, and this section is that raising;
  - checks on screens outside step 2 (Finance, Kids) stay unchanged.
- **Native:**
  - not runnable in the cloud container (no simulator, emulator or device), and stated plainly in
    the test report, never reported as passed;
  - the manual native checklist gains step-2 items: an enquiry from the phone, triage, a booking
    state move, and the cache cleared after sign-out.

## Constraints

- The repo is public: no secrets, real client data or credentials in code, tests or docs.
- Any change to CI, `railway.toml` or Railway settings is raised with the owner before it is made.
  Adding the new suites to the existing `pnpm e2e:mobile` command needs no CI change. If the step
  needs one, the builder stops and asks.
- Python lines stay at 100 characters or fewer (`ruff check`), and `ruff format` is never run
  across the repo.
- The step-1 session code is security-sensitive. Changes to `src/state/session.tsx` are limited to
  clearing the query cache on identity changes, and are reviewed as such.
- Draft PR only. Nothing is approved or merged by the builder.

## Builder's calls

- Module and file layout under `src/api/` and `src/state/`.
- Exact cache freshness and retry values, within the stated intent.
- Whether search and the status filter share one list view or switch modes.
- Visual treatment of trimmed areas: removed outright, never shown disabled as if coming soon,
  unless a disabled control states a real backend reason (as for confirmation).
- Test-only seeding route shape.

## Decisions marked as Claude's calls, for the owner to check

- **Collection mapping** adds "Not sure yet" (`undecided`), and the event types gain "Other", to
  match the backend's lists.
- **The phase mapping** shows `preparation` as "Date Confirmed (pre-shoot consultation)" rather
  than adding a ninth client phase.
- **Upcoming shoots** on the dashboard use the new `order=scheduled&from=<today>` query, first page
  only, excluding cancelled and delivered bookings in the app.
- **Confirmation on the tracker and booking detail is a live action**: it sends the real state change
  and shows the backend's 409 message. It is not a disabled control with copied text, so it starts
  working when the evidence checks land.
- **Enquiry detail finds an existing booking** by looking for its `source_enquiry_id` in the bookings
  list, and otherwise offers "Create planning booking". The create call is idempotent, so a miss can
  never duplicate a booking.
- **No NetInfo on native** in this step. Refetch happens when the app returns to the foreground.
- **The web portal's revoke-access call** in `web/src/pages/StudioInvitations.jsx` uses
  `DELETE /api/studio/client-access/{id}`, a route the backend does not have; the backend route is
  `POST /api/studio/enquiries/{eid}/client-access/{gid}/revoke`. This is out of step-2 scope and
  recorded as an open item, not fixed here.
