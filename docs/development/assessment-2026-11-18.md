# Assessment: design system, functional state and readiness for step 2

Date: 18 November 2026. Base: `main` at `380643c` (PRs #1 to #7 and #9 merged) plus PR #8
(`claude/app-work-plan` at `e234d0d`).

## Summary

- **Design system:** the Expo app (`apps/mobile`) is a close port of the reference app in
  `_ds/apps/mobile`, and the shared tokens match `_ds` exactly. The October compliance audit's
  native findings describe an older two-link shell that no longer exists. Its web findings
  (`web/`) still stand, but that portal retires once the Expo app matches it.
- **Function:** only sign-in, sessions and route guards run on real data. Every business screen
  still runs on seeded, in-memory data.
- **PR #8** is sound and green in CI, and is 3 commits behind `main` (PR #9), with no overlap.
- **The step 2 plan** matches the backend on every route, parameter, limit, field and message
  checked, with five corrections, now folded into the plan. It is ready for owner approval.

## 1. Design system

### Source integrity and tokens

| Check | Result |
| --- | --- |
| `pnpm check:design-source` | 86 files and 115 archive entries; the SHA-256 manifest matches and the archive CRCs are valid. |
| `pnpm check:design` | Token mirrors match `_ds`; 25 runtime variables resolve. |

### `apps/mobile` against `_ds/apps/mobile`

The reference has 48 files under `app/` and `src/`, and all 48 exist in the app. Of these, 22 are
byte-identical (the finance components, client portal screens, `Logo`, `Icon`, `BookingDetail`,
`IntakeScreen` and the studio, portal and finance state). The other 26 differ, in four groups:

| Delta (changed lines) | Files | Cause |
| --- | --- | --- |
| Real authentication | `state/session.tsx` (212), `sign-in.tsx` (87), `AppShell.tsx` (41), `_layout.tsx` (24), `index.tsx` (17) | Step 1: hybrid sign-in, `SessionGate` and sign-out of both portals. These are intended departures. |
| Beyond the reference | `contacts.tsx` (387), `inquiries.tsx` (196) | PR #3 added a three-tab directory and a six-state enquiry machine that the backend can't hold. Step 2 trims these back and records each trim. |
| Public enquiry entry | `marketing.tsx` (48) | The `EnquirySheet` entry points. |
| Small edits | 18 files, each under 20 lines | Kids panels, the wage net-of-withholding fix (`data/finance.ts`) and the admin nav. |

The app also has files that the reference doesn't: `src/api/*`, `SessionGate`, `EnquirySheet`,
`KidsOverview` and the `kids/*` public flow, `illuminate-kids.tsx`, and `state/records.tsx`.

### The October audit (`design-system-compliance-audit.md`), now

| ID | October finding | Now |
| --- | --- | --- |
| DS-03 | No rail, topbar or compact shell | The Expo app has the reference `AppShell` (rail, bottom bar and More sheet). Still open for `web/` only. |
| DS-06 | Native locked to portrait; no safe areas or keyboard handling | `app.json` sets `orientation: "default"`. Safe-area insets are used in the root layout and the public screens, and the code has 18 `KeyboardAvoiding` references. On-device checks have never been run. |
| DS-07 | Native app is two browser links | Superseded: the Expo app carries every reference screen. It is not yet on real data. |
| DS-04 | 44px touch targets and focus | Unverified in the Expo app. `e2e/screens.js` checks overflow, crashes and blank renders at 5 sizes, but no suite measures targets. Step 2 now adds a measured sweep for its screens. |
| DS-05 | Viewport matrix | Partial: 5 sizes in `screens.js` and 2 in the feature suites. The full 16-row web and 21-row native matrix is not run. |
| DS-01, 02, 20 | Tokens, gallery-only dark mode, typography | Tokens pass. Dark-mode scope and typography were not re-audited here. |
| DS-08 to 19 | Feature coverage | Tracked as app steps 2 to 5 (below). |

The audit and `goals/GOALS.md` predate the Expo app, and nothing marks their native rows as
superseded. A later records task should do that, rather than leave them as live defects.

## 2. Functional state by surface

| Surface | Data | Step |
| --- | --- | --- |
| Sign-in, sessions, guards and sign-out | Real (cookie on web, bearer on native) | 1, done |
| Public enquiry, Inquiries, Bookings, Tracker, Contacts and Dashboard | Seeded | 2 |
| Site Content, Documents and client portal home | Seeded; the backend partly supports them | 3 |
| Inbox, e-signature, Finance, Illuminate Kids and Staff | Seeded; no backend | 4 |
| Galleries and Prints | Seeded; needs the media Worker deployed | 5 |

Not run anywhere yet: native on a device or simulator, and the media Worker deployment.

## 3. PR #8 review

**Contents:** the sign-out fix from the Codex review of PR #7, the step 2 design (approved
18 November) and the step 2 plan.

**Code (`session.tsx`, `AppShell.tsx`, `SessionGate.tsx`, `client.ts`, `auth.ts`):**
- `signOut()` waits for a sign-in already in flight, then revokes that new session.
- A double click joins the sign-out already running.
- `signIn()` is refused while a sign-out is pending.
- Both phases have time limits: 8 s for sign-out and 15 s for sign-in.
- `roleRef` closes the gap where `stateRef` lags a render behind.
- An abort while the body is being read maps to "unavailable".
- `SessionGate` shows the splash while signing out, and `leave` navigates once sign-out resolves.

No defects found. One trade-off is documented in the code and accepted: a server logout cut off by
the time limit leaves that server session alive until it expires, though the device is signed out.

**Checks:**
- CI on `e234d0d` passed all four jobs: backend, the web job including `pnpm e2e:mobile`, the
  production image and R0.
- After merging `main` locally: `pnpm typecheck:mobile` is clean, `api-client` passed 45,
  `session-state` 18 and `finance` 22.

**State:**
- 3 commits behind `main`. PR #9 touched only `HANDOFF.md`, `backend/tests/app_server.py` and
  `scripts/cloud-env-setup.sh`, and it merges cleanly.
- `HANDOFF.md` calls PR #8 a draft, but GitHub shows it as ready for review.

## 4. Step 2 plan review against the backend

Checked against the code:
- **Routes:**
  - `POST /api/bookings`;
  - studio enquiries list, detail and patch;
  - operations search and bulk triage;
  - bookings create, list, detail and patch;
  - `/dashboard` and `/reporting`;
  - contacts list and detail;
  - `.../client-access/{gid}/revoke`;
  - the content draft and booking-draft fences;
  - both token endpoints.
- **Limits:**
  - enquiries and contacts default to 25, bookings to 50, and all cap at 100;
  - bulk triage takes 1 to 50 items;
  - the search offset caps at 10,000;
  - field lengths are 120, 254, 40, 250 and 2000.
- **Enums:**
  - event types include "Other";
  - collections include `undecided`;
  - bulk outcomes are the six the plan names.
- **Formats and messages:**
  - the reference format is `IS-` plus 12 upper-case hex digits;
  - the confirmation 409 text is as the plan quotes it;
  - the booking state transitions match.
- **Test harness:** the `studio.js` section names, the `run.js` suite list, the existing
  `/__test/` routes and CI running the whole `pnpm e2e:mobile`.

Corrections folded into the plan:

| # | Task | Issue | Change |
| --- | --- | --- | --- |
| 1 | 2 | The client token body is built in `client_auth.py`; `clients.py` is the operator CLI. Typing `expires_at` as `datetime` would turn today's `+00:00` into `Z`, which breaks the plan's "JSON identical" rule. | File list corrected. `expires_at: str`; the test asserts the `+00:00` suffix and the identity keys. |
| 2 | 5, 6 | The enquiry revision field is `studio_revision`, while bookings use `revision`. Mixing them up would send `expected_revision: undefined` and get a 422. | Named explicitly in the interfaces. |
| 3 | 10 | Reporting returns `unclassified_enquiries` (legacy statuses), which the plan's tiles left out. With the seeded `legacy_waiting` row, New + In review + Archived would not add up to the total. | An "Unclassified" tile, shown only when above 0, with a test. |
| 4 | 10 | Upcoming shoots read only the first page and filter out cancelled and delivered bookings in the app, so a run of cancelled bookings could empty the panel. | Follow `next_cursor` (capped at 3 pages of 100), with a test. |
| 5 | All | The plan had no design-system constraint for its new controls. | A global constraint (use `ui.tsx` primitives and tokens, 44px targets, review against `_ds`) and a measured touch-target sweep in Task 10. |

Points left as they are, by design:
- the "Open booking" lookup reads only one page of 100 (create is idempotent, so a miss can't
  duplicate);
- the scheduled-order cursor can skip or repeat a row whose date is edited while someone pages;
- there is no NetInfo on native.

## 5. Next phase

1. **The owner:**
   - approves the step 2 plan as amended;
   - merges PR #8, or this branch's PR into it.
2. **The build:** step 2 with subagent-driven development, Tasks 1 to 11 in order. Tasks 1 and 2
   are backend-only and independent of the app. Each task follows the plan's controller duties:
   - push;
   - a PR comment listing the task's trims;
   - Empirical trim records;
   - a ledger entry.
3. **Parallel and not blocking:**
   - deploy the media Worker (owner-held secret);
   - the native device checklist;
   - mark the October audit's superseded native rows.
