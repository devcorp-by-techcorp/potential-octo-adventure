> **10 October 2026 — public marketing parity correction:** PR23 is live but its landing layout failed design-system acceptance. The public composition is being restored against `_ds`; see [parity register](../test_reports/2026-10-10-public-marketing-parity.md). Source/lint/build checks pass; final CI, integration, deployment and visual acceptance remain pending. Full platform compliance remains open.

> **R0 preparatory checkpoint — 8 October 2026:** R0-A baseline collected; existing reviewer host independently passed all six criteria, eight live receipt hashes verified, original host/source unchanged. **R0 is not GREEN.** Actual compaction/fresh Empirical-source-Git-CI bootstrap qualification passed all six BQ rows; full scope/build/test/review/integration/records/reset gates remain required. Resume the [checkpoint](../docs/development/phases/R0/checkpoint.md); [evidence](../test_reports/2026-10-08-r0-bootstrap.md). No product phase is active. Older R0-A-next text is historical.

> **Current checkpoint — 7 October 2026:** [assessment](../docs/development/readiness-assessment-2026-10-07.md)
> and [active plan](../docs/development/long-running-session-plan.md) govern execution.
> R0-A is next; C1-A token/API and current hosted gates pass at `11c5372`, PR #18 is merged.
> C1-B web lifecycle has hosted evidence; native/theme/source-conflict obligations remain open.
> C2–C11 remain incomplete. Earlier dated activation/status sentences below are historical where superseded.

## C1-A API/CI reconciliation — 6 October 2026

The published compatibility repair is present on PR #18 branch
`codex/prerequisite-reconciliation-20261006` at `505ad98`; fetched and reviewed
against main `f496b22`. Reused its adapters and historical API fixture rather
than duplicating them. Local token JS/native/declaration build, generated CSS,
historical web/native API contract, design-source drift/integrity and mobile
TypeScript checks pass. Historical fixture bytes match pre-migration `ec64ed9`.
CI now also checks native token consumption and the SHA-256/archive-CRC source
manifest. Design checker covers the themed gold shadow as well as sm/md/lg.

GitHub REST check-runs, Actions and PR queries succeed with supported network
permission on this host; no credential change was required. Exact-main hosted
CI run [37410494778](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37410494778)
passed backend, full production-built browser regressions and production image
routing. This resolves the inaccessible hosted-evidence gate for that main SHA;
it does not explain the previously retained local recovery-render failure.
Repair commit `a3b8df2548b5d25ae9fd89881b2f59aead24472a` is pushed and
remote-equal. Hosted [CI 37411342989](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37411342989)
passed all three jobs, including historical API/source/native gates and the full
production-built browser aggregate. C1-A API and hosted-evidence gates are closed
for that implementation SHA. Earlier API/CI-blocked statements below are historical
and superseded by this entry. PR #18 remains unmerged; no production deployment. C1 parent/native/full compliance and the
separate local recovery-render follow-up remain open.

## C1-A compatibility follow-up — 6 October 2026

Fetched main `f496b2205e5a67753e02d922efa6b4aa1ed99a2b` includes published C1-B
`d8f604dd46cd079f82613517aa4d3079138869c0`. Selected C1-A-compatibility only on
`codex/prerequisite-reconciliation-20261006`; C3-A stays inactive. Separate public
adapters restore palette.gold/sage, numeric shadow alpha, CSS color argument and
RN default #000; explicit themed helpers and unchanged _ds mirror retain authority.
Historical web/native API checks, source/theme drift, token build, web lint/build
and mobile typecheck pass. Current-main hosted API returns Forbidden; user-reported
green merge checks do not explain retained production recovery failures. Recovery
receipt 6ac46c2200f9510b5621265c stays open pending exact-head logs and reproduction.
No recovery fix or full C1 closure claimed. Preserve scratch/.empirical and booking
409; no merge/deploy. See test_reports/2026-10-06-c1-a-compatibility.md.

# Studio Suite design-system compliance goals — 2026-10-06

## C1-B gallery lifecycle — 6 October 2026

User requested proceeding after PR #16 merged to main. Fetched starting SHA
`76643e2e325819a887662ef8575df96086eb31d6`; review branch
`codex/c1-b-gallery-theme-20261006`. That instruction supersedes the earlier
activation hold, without resolving C1-A compatibility or claiming hosted CI.
GalleryViewer now owns dark tokens on its modal node; ordinary landing, studio,
client and fallback routes ignore stale saved dark choices and remain light.
The shared dialog restores focus/scroll and overflow, traps Tab within controls,
and does not write global theme attributes. Viewer controls fit the phone height.
Both generated themes and all `_ds`/token authority bytes remain unchanged.

Production-built Chromium lifecycle passes at 1440x1000 and 390x844 (reduced
motion): computed tokens/colors, repeated mount/dismiss, arrows/buttons and wrap,
focus containment/return, nonzero window/reel scroll restoration, history unmount,
forward/reload, normal light dialog/backdrop and ordinary light route checks.
The independent lifecycle suite uses denied API and SVG image fixtures; real
replica-set application regressions are tracked separately in the
[report](../test_reports/2026-10-06-c1-b-gallery-theme.md).
Web lint/build, token drift/source integrity and changed Python Ruff checks pass.
Shared browser runner now requires/serves a production build; CI includes the
lifecycle gate and retained artifacts. This is scoped C1-B infrastructure, not
C3 full-matrix implementation or native acceptance.

Thirteen existing production-built application suites pass in partitions. Booking
revoked-session sign-in rendering fails on both this branch and starting main;
root cause/fix is queued separately, with failures retained. Aggregate acceptance
and exact-head hosted verification remain open. Implementation `cca69ee` is
pushed and remote equality verified; exact-head REST/PR GraphQL are Forbidden.
Empirical work receipt `6ac46c1500f9510b56212609` and recovery follow-up
`6ac46c2200f9510b5621265c` are readback verified. C1-A historical palette/shadow API defects remain open.
C1, DS-02 native scope/source conflict and full compliance remain open.
Preserve untracked `.empirical`, booking HTTP 409, approved sources and failed
browser evidence. No merge or deployment. Historical sections below are retained.


## C1-A gate review — 6 October 2026

Fetched `codex/c1-a-token-contract-20261006` and verified starting HEAD
`4fc91f217ef4c6df1c6edfcefd62e4e338d9db27`. Read Empirical handoff
`6ac465f900f9510b562111a1`, including publication note. Exact-head GitHub
check-runs requests with inherited authentication and with configured GIT_PAT
selected as GH_TOKEN both returned Forbidden. Hosted CI remains unverified;
C1-B is not activated. Initial network attempts failed; supported additional
network permission allowed Git fetch, but did not resolve GitHub API access.

Read-only comparison with pre-migration `ec64ed9` found API regressions:
`palette.gold` (champagne ramp) and `palette.sage` (light ramp) were removed;
`shadowToCSS(key, color)` now interprets its second argument as a theme name;
`shadowToRN(key)` changed default color from `#000` to `#141e32` while retaining
the previous light shadow geometry.
The exported primitive `shadow.*.alpha` also changed from number to theme map.
Existing local drift checks validate reference equality, not the historical API.
No application edits or new acceptance pass are claimed. Resume by resolving
GitHub API access, verifying exact-head CI, then implementing separate compatibility
adapters and meaningful historical API checks while keeping `_ds` and its mirror
unchanged. Repeat C1-A acceptance/publication before activating C1-B only.
Untracked `.empirical` and booking HTTP 409 gating remain preserved.
No merge or deployment. This is a blocked gate-review records run.


## C1-A execution — 6 October 2026

Empirical skill/history access is resolved. C1-A token migration and separate
status compatibility aliases are locally verified; source equality, generated
web/native theme/shadow checks, token build, web lint/build, mobile typecheck
and source integrity pass. `_ds` remains unchanged. Parent C1 and full DS-01/20
acceptance remain open pending theme lifecycle and remaining platform work.
Branch: `codex/c1-a-token-contract-20261006`; starting HEAD `ec64ed9`.
See `test_reports/2026-10-06-c1-a-token-contract.md` from repository root.
GitHub check-runs API returned Forbidden; hosted CI is unverified.
Older access/branch instructions below are historical.


## Current execution update — 2026-10-05 UTC

Use the [autonomous session plan](../docs/development/autonomous-session-plan.md): one scoped goal
set per run, then verify, update records, commit/push, advise completion and only
then activate the next set. P0 is the planning scope; C1-A is next. Empirical
instructions/history/receipts are unavailable in this environment and must be
resolved before application implementation. The user authorized project-docs-only
planning for P0. No C1–C11 acceptance is claimed.

Fetched default and starting checkout are
`5e75171b0162dfc66af92e91d67ac4749725ec10`, containing the PR #13 merge.
The prior instruction to reuse that draft/branch is superseded. Planning branch:
`codex/scoped-session-plan-20261005`, workspace `/workspace/studio-suite_v2`.
GitHub GraphQL is forbidden; live PR metadata and exact-head CI remain unverified.
See the [current report](../test_reports/2026-10-05-scoped-session-plan.md).
The older dated sections below are historical checkpoints.


Current baseline: merged default `d446a72a73ded91ba1d5f626dbbd81e3e69771ae`;
review branch `codex/design-system-compliance-20261006`. Local `_ds` is the
design-system source of truth. PR #12 is already merged. This ledger supersedes
the historical baseline and completion claims below for current planning.

The session goal is to synchronize Git, preserve/reference `_ds`, assess gaps,
publish this plan and update/push records. Full application compliance is a
multi-increment implementation objective; C1–C11 cannot be marked complete from
this source audit. [Assessment](../docs/development/design-system-compliance-audit.md)
provides DS-01–DS-22 findings and the complete surface crosswalk.

| Goal | Status | Scope / dependencies | Required acceptance evidence |
| --- | --- | --- | --- |
| C0 — reconcile source and plan | verified | Fetch/default/PR check, fast-forward local branches, preserve authoritative `_ds`, inventory/CRC/SHA, audit every reference group, update docs, commit/push new review branch. | Initial trees equal; 30 old files archived identically; 86 files and 115 archive files inventoried; final remote head/draft PR and scoped checks recorded in dated report. |
| C1 — token/theme contract | partial; C1-A and web lifecycle hosted gates pass, native/source conflict open | DS-01/02/20. Migrate extracted tokens; keep app-specific adapters separate, preserve shared API/aliases; resolve dark scope under written gallery-only rule. | Exact source/adaptor drift enforcement, generated web/RN values for both themes/ramps/shadows/status, route/viewer mount/close/unmount theme restoration, no global non-gallery dark, build/typecheck and real browser evidence. |
| C2 — shared responsive shells/components | pending C1 | DS-03/04/08/09/11/20. Role shells, 280 rail/72 topbar, compact disclosure, sign-in composition, forms/tables/drawers/dialogs, logos/fonts/icons/focus/motion. Preserve all working APIs and privacy. | 375px and rotated phone, distinct tablet master-detail, 1152px nav fit, 44px controls, focus containment/return, token computed styles and responsive screenshot comparison; no inert controls. |
| C3 — web compliance gate | ready, parallel to C1/C2 | DS-05/22. Application route/state registry; production-built SPA matrix and visual baselines. Do not reuse prototype query auth or iframe results as application tests. | All 16 source rows, relevant orientations, intermediate 375–2560 widths including breakpoint edges, all overlays/empty/loading/error/conflict states, reachability and collapsed-scroll checks; CI fails real regressions and produces per-surface evidence. |
| C4 — native foundation and parity gate | ready foundation; identity contract dependency | DS-06/07/09/20. Unlock rotation, subscribed geometry/token interpolation, safe-area/keyboard/fonts/navigation/tablet panes; define secure native identity flow using existing grant/session policy. | iOS and Android real/emulated native 21-row matrix, constrained widths and intermediate samples, font scale/keyboard/rotation/safe areas, 44pt/48dp targets; secure credential/session revocation and API isolation. Export/web emulation alone cannot close. |
| C5 — approved scheduling/booking | ready independent subset; provider evidence dependency | DS-08/10/11. Actual resource/location/package assignment, half-open intervals/DST/buffers/travel/holds, transactional occupancy, permissions, agreement/payment evidence, calendar/details and matching native workflows. Three booking policies already approved. | Real replica-set simultaneous holds/confirmation, expiry/idempotency/CAS/authorization-loss and rollback tests; real UI conflict/recovery; required evidence omission denies confirmation. Keep 409/disabled until whole confirmation gate passes. |
| C6 — CRM/intake/progress/content/messaging | pending C2/C4; operational definitions dependency | DS-11/12/14/15/19. Persistent manual contacts/profile tabs, six questionnaire versions, restricted roles, briefs/escalation, persona assistance, inbox, stage visibility, identity/content administration. | Server authorization/versioning/audit/idempotency; grant isolation; six end-to-end intake journeys with real persistence; web/native state parity and matrix evidence. Do not invent restricted-data access or commercial edits. |
| C7 — private galleries/prints | provider/derivative/order requirements blocked; independent metadata work available | DS-13. Ownership, private R2/Worker delivery, derivatives, selections/downloads, gallery viewer and print requests on both platforms. | Explicit-grant/server-enforced media access/revocation and cross-account denial; original privacy, provider sandbox receipts, download and selection persistence, performance limits; order estimates cannot claim payment. |
| C8 — documents/contracts/signatures | pending C2/C4; authoritative template/consent/provider inputs blocked | DS-16. Global centre, 26-template contract, typed merge/filter/conditional/repeat engine, PDF preview/version evidence, restricted/internal controls and signatures. Extend existing versioned storage. | Exact approved template versions/source hashes; safe merge and server role checks; cross-client/version isolation; genuine sandbox signature evidence tied to immutable version, retries/denials; complete browser/native journeys. |
| C9 — finance/staff/suppliers | financial/commercial/permission decisions blocked; registry design available | DS-17/18. Six finance tabs, suppliers, invoices, immutable payment evidence, expense reauth/audit, ledger/reports, staff roster/contracts. No prototype tax defaults as authority. | Current primary-source financial rules and studio settings validated before calculators; money/rounding/reconciliation and concurrency tests, immutable audit tamper detection, real provider webhook replay/signature tests, scoped payroll/finance authorization and platform parity. |
| C10 — recovery/notifications/providers | sandbox/provider/retention dependencies blocked; unrelated work continues | DS-09/14/21. Wire verified recovery, notification outbox/preferences, Luma personas, retention rules, provider test delivery. | Non-enumerating single-use recovery with session invalidation and real sandbox delivery; retry/dedupe/provider evidence; no unapproved real customer communications or permanent deletion. |
| C11 — full acceptance/deployment handoff | pending C1–C10 | DS-21. Close all findings and source conflicts; all runtime gates, isolated environment readiness, resource/provider setup, production image/routing, backup restore and rollback rehearsal. | Exact-final-head backend/lint/build, web full matrix, both native matrices, provider sandbox, hosted CI and isolated deployed TLS/cookie/private-network readiness; approved reviewer acceptance. Production deployment needs explicit authorization. |

## Session sequence and stopping conditions

1. C0 publishes the source/report/docs on draft PR #13; verify exact pushed head before reuse.
2. Execute one scoped set per run using the current autonomous session plan.
   C1-A, C1-B, C3-A, C4-A and C2 follow separate publication/notification
   boundaries; establish native foundations early and retain full parity gates.
3. Deliver each domain as server + web + native with persistence, authorization,
   meaningful transaction/idempotency checks and real UI/matrix verification.
4. Start approved C5 resource/time/conflict work without waiting for finance;
   retain confirmation gating until all required acceptance/payment checks exist.
5. Keep C7–C10 source/provider decisions explicit; work on independent schemas,
   controls and UI without turning synthetic fixtures into live evidence.
6. Close C11 only after every source finding, all surface/platform gates and
   operational dependencies pass. A blocked item remains required for compliance.

Before local database/browser work, verify available disk and an isolated writable
replica-set primary. Preserve previous logs/data; the prior disk exit and browser
crash have distinct causes/evidence. Finish builds before browsers. Do not weaken
assertions, raise timeouts blindly, re-request approved booking policy, merge the
default branch, deploy, spend on infrastructure or change material business rules.

## Historical goal ledger — superseded baseline retained

The following records describe earlier runs and are not the current Git state
or full-compliance status.

# Studio Suite next-phase goal ledger

Baseline: local branch `work` at `4d8ec6f16e67be423bc448fcdcab2d16ed8706e0`; assessed `4236f42789a0a34525aed0ff552a3405c8ab5e95` is an ancestor. The only delta is merge PR #9 deployment preparation. Work continues on `codex/studio-suite-booking-design-next-phase`; the initial tree was clean and no Git remote is configured locally.

| ID | Status | Acceptance / dependencies | Evidence | Remaining blockers |
|---|---|---|---|---|
| G0 | verified | Baseline and ancestry recorded; clean feature branch; preserve deployment delta. | This ledger; `git diff 4236f42..4d8ec6f`; build/lint and Ruff evidence in test report. | Python/browser suites require unavailable Python packages and MongoDB; Docker CLI unavailable. |
| G1 | in_progress | Generated structural variables, source/drift check, semantic typography/focus/motion, 280/72 responsive shell and viewer-owned cinematic state. | `DECISIONS.md`; `scripts/check-design.mjs`; token build; web build/lint. | Fresh visual screenshots/browser computed-style evidence unavailable until browser dependencies are installed. |
| G2 | in_progress | Unique idempotent enquiry conversion; revisioned metadata/history; explicit confirmation and valid lifecycle. | `backend/bookings.py`; `backend/tests/test_bookings.py`; web bookings/tracker screens. | Real replica-set race suite has not executed in this environment. |
| G3 | in_progress | Explicit grant-derived client booking projection; selective audited accepted-grant revocation. | `backend/client_access.py`; booking tests; existing client tab-return revalidation. | Browser and real-Mongo isolation tests not executed. |
| G4 | in_progress | Persistent booking list/detail/tracker and database-derived dashboard UI; responsive navigation. | Booking API/UI files and build evidence. | Complete browser journey remains unverified without browser and MongoDB dependencies. |
| G5 | in_progress | Repeatable bounded notification worker retained; design enforcement added. | Existing `backend/notifications.py`; `scripts/check-design.mjs`; existing notification tests. | Full pytest/browser execution and shared multiworker limiter are not verified. |
| G6 | in_progress | Review, report, final checks, commit and PR handoff. | `test_reports/2026-10-03-next-phase-report.md`. | Push/CI unavailable because no Git remote is configured. |
| G7 | pending | Optional private-media vertical slice only after G0–G6. | Deferred by stopping rule. | Primary goals are not all verified; provider configuration absent. |

## 2026-10-04 focused booking follow-up

From main `0f27e05`, completed booking calendar validation, draft-preserving edit
recovery, saved-version reconciliation, unsaved-edit lifecycle safeguards and
list/detail retry states. Fresh evidence for the booking portions of G2–G4:
259 backend tests passed against MongoDB 7.0.16 replica set; all five browser
suites passed, including public enquiry conversion, rescheduling, concurrent
staff edits, lost responses, cancellation/reopening, explicit confirmation and
delivery. Build, ESLint, Ruff, design checks and production container routing
passed. See [verification report](../test_reports/2026-10-04-booking-planning-recovery.md)
for commands, screenshots and the local Docker proxy-certificate accommodation.
The table above records the earlier next-phase run; this follow-up is limited to
booking planning and recovery.
