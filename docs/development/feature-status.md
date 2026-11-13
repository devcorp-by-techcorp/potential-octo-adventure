> **10 October 2026 — public marketing parity correction:** PR23 is live but its landing layout failed design-system acceptance. The public composition is being restored against `_ds`; see [parity register](../../test_reports/2026-10-10-public-marketing-parity.md). Source/lint/build checks pass; final CI, integration, deployment and visual acceptance remain pending. Full platform compliance remains open.

> **10 October 2026 — landing hero correction:** [PR #23](https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/23) restores the seven-session reference hero and corrects four visually mismatched prototype samples without changing `_ds`. See [evidence and remaining gates](../../test_reports/2026-10-10-landing-hero.md). Local lint/build/token/data checks pass; final-head CI, new preview deployment and full visual acceptance remain pending. Earlier portfolio-only fixes do not close this hero defect. Full DS compliance remains open.

> **R0 preparation — 8 October 2026:** [infrastructure evidence](../../test_reports/2026-10-08-r0-bootstrap.md) now includes independent PASS of the existing review host, with actual-instance grants/transport and original sentinel integrity verified. No application feature, full web/native parity or R0 GREEN is claimed. Actual preparatory fresh bootstrap also passed all six BQ rows; the full R0 supervisor/gate scope audit and remaining operational gates precede product execution.

> **Current checkpoint — 7 October 2026:** use the [readiness assessment](readiness-assessment-2026-10-07.md),
> [active execution plan](long-running-session-plan.md) and [controller prompt](next-session-prompt.md).
> Assessed application `11c5372` has green hosted CI; PR #18 is merged, token/API gates pass.
> Full web/native compliance remains open. R0-A is the next execution scope.
> Earlier dated status/activation statements below are historical where they conflict with this checkpoint.

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

# Feature register

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
[report](../../test_reports/2026-10-06-c1-b-gallery-theme.md).
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

Use the [autonomous session plan](autonomous-session-plan.md): one scoped goal
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
See the [current report](../../test_reports/2026-10-05-scoped-session-plan.md).
The older dated sections below are historical checkpoints.



Current draft review: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/13.
Source checkpoint: `e38c742ca56ceb3dbd4a361982ac7ff0a0a76cae`; resolve the later
records checkpoint with live Git. No merge or deployment.

## Current compliance status — 2026-10-06

PR #12 is **merged**; baseline default is `d446a72a73ded91ba1d5f626dbbd81e3e69771ae`.
Current review branch: `codex/design-system-compliance-20261006`. Local `_ds` is
authoritative and preserved in this change. See [the 22-finding assessment and
complete surface crosswalk](design-system-compliance-audit.md),
[source manifest](design-system-source-manifest.json),
[C0–C11 goals](../../goals/GOALS.md), and
[current verification](../../test_reports/2026-10-06-design-system-audit.md).

The historical “implemented and verified” statuses below refer to particular
workflow evidence. **No surface is established as fully design-system compliant:**
the full shipped-build web matrix and independent native geometry/functionality
gates have not passed. Mobile is a portrait-locked browser-launch shell, not the
native feature set shown under `_ds/apps/mobile`. Full finance/staff/supplier,
intake, private gallery/prints, signatures/template centre and manual CRM features
remain absent or partial. Token/theme/shell/touch-target defects are directly
confirmed from source. Application compliance/deployment acceptance remains open.

## Historical implementation register — 2026-10-05

The following checkpoints and PR status describe the earlier run; the current
Git/source status above supersedes them without altering their test evidence.

Audit date: 2026-10-05 (approved booking authority, authorization and resource configuration). Repository: `devcorp-by-techcorp/studio-suite_v2`.
Integration branch: `codex/studio-suite-integrated-development`.
Base commit: `aa50bd2` (merged deployment integration PR #8 plus subsequent default-branch booking and test work).
Latest application-code checkpoint: `48af5ee7693ca0c0b3515cb1cc6ff078d18ce0be` (staff resource configuration and approved-policy gating copy).
Earlier authorization increment: `4c65efed4525efe8872619323c87271f1815ec6a`.
Browser fixture corrections: `c48acc5` (denied-account restoration), `bfe9008` (overlapping invitation reloads) and `87d19d5` (distinct denials/conversation API waits), and `d754bc5` (public receipt/session-response waits and bounded crash diagnostics).
Draft PR: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/12.
Current full verification and final-tip hosted checks are recorded in
[resource verification](../../test_reports/2026-10-05-resource-configuration-verification.md).
Later documentation-only commits synchronize records; resolve the current tip with `git rev-parse HEAD`.

Statuses distinguish application behavior from prototypes and test fixtures.

| Workflow | Status | Evidence / limitation |
| --- | --- | --- |
| Public enquiries and Luma boundary | Implemented and verified | Existing API/browser coverage; enquiry creation never books. |
| Staff sessions and enquiry triage | Implemented and verified | Persistent FastAPI/MongoDB implementation; previous CI plus current development checks. |
| Client invitations and read-only enquiry access | Implemented and verified | PR6 integrated with PR7 deployment baseline; explicit grants and transactional replica-set CI. |
| Deployment baseline | Implemented and verified | Same-origin Caddy `/api`, readiness and production image routing retained from merged PR #8; local Caddy routing passed on the current app. Hosted production-image/Caddy verification passed in PR run 37286142437 and push run 37286138576 at `48af5ee`. |
| Booking lifecycle and client progress | Partially implemented | Persistent planning records, revision-checked operational history, client-safe projections and browser journeys are present. Creation/edits now fence staff identity and current session transactionally; see the booking authorization verification report for current checks. Planning-to-confirmation is now rejected by the API and disabled in the UI pending implementation of the approved scheduling/obligation policy and transactional resource/evidence checks. Three version 1.0.0 SKYNET files are snapshotted and hashed; the user explicitly approved all three. Resource definitions are configurable; package/resource assignment, intervals/holds/conflicts, confirmation permissions and required evidence remain unimplemented. No calendar/availability view is implemented. Existing confirmed records remain readable. |
| Booking resource configuration | Implemented; final verification recorded in report | Staff-only bounded catalog/create/revision edits, explicit capacities, enabled status, audit and immutable creation receipts; transactionally fenced authorization. Empty catalog until staff configure real inventory. Configuration reserves nothing and grants no confirmation permission. |
| Booking proposal drafts | Implemented and verified | Persistent timezone-labelled proposal drafts and history; retries/access/session fences covered. They never reserve availability or confirm a booking. |
| Shoot / fulfilment progress | Partially implemented | Persistent lifecycle stages and client-safe booking state exist. Stage definitions and client visibility are not yet approved; advanced stages depend on the booking/resource policy decision. |
| Per-enquiry access withdrawal | Implemented and verified | Transactional revoke/history, active-grant filtering, session fencing, fresh-invitation restoration and persistent staff view; replica-set and browser lifecycle coverage included. |
| Client/studio messaging | Implemented and verified | Persistent explicit-grant conversation, bounded history, idempotent messages and read state. No outbound notification delivery. |
| Documents | Implemented and verified | Private local storage boundary, upload/version/publish and protected download; R2 adapter code remains live-provider unverified. |
| Private galleries and image processing | Blocked by identified requirements | No media ownership/delivery/CDN and derivative policy; originals remain private. |
| Contacts | Canonical client roster implemented and verified | Persistent canonical identities and explicit relationships; does not grant access through email matching. Manual non-client contact creation/editing lacks a canonical record/editing contract. |
| Studio reporting | Implemented and verified | Real bounded Mongo aggregates and defined status/grant counts; browser suite covers staff/client isolation. |
| Public narrative content | Implemented and verified | Safe plain-text draft/publish/version flow; commercial package, pricing and policy edits excluded. |
| Indexed enquiry operations | Implemented and verified | Indexed search, privacy-filtered export and revision-checked bulk triage; no permanent deletion. |
| Operator recovery and account disable | Implemented and verified | Existing verified staff/client operator routes remain available; no public registration. |
| Own-account session withdrawal | Implemented and verified | Staff/client home controls show only other active-session counts; transactional withdrawal keeps the current session, fences authentication changes and saves a session-scoped retry receipt. 18 replica-set cases and focused real-browser staff/client lost-response/persistence coverage passed. No other-account administration or grant changes. |
| Client self-service password recovery | Partially implemented; not wired | Default-disabled candidate backend and 8-case test file; router/UI are not registered. Provider, sender, live/browser delivery remain unverified. Do not treat as usable. |
| Payments and orders | Blocked by provider and commercial decisions | Provider and authenticated payment evidence absent. Approved SKYNET mapping supplies category schedules and SOW precedence; underlying agreement/SOW sources and payment evidence remain required. No fake checkout represented as payment. |
| Signatures | Blocked by provider and evidence decisions | No provider/consent implementation. Approved SKYNET policy specifies version-linked acceptance evidence; actual agreement source, consent and provider verification remain required. No typed-name signature claim. |
| Notifications | Partially implemented | Existing enquiry notification path remains; messaging and invitations do not send real email. Recovery candidate is unregistered. |
| Retention/deletion | Blocked by an identified decision | Retention policy absent; permanent deletion not introduced. |
| Mobile | Partially implemented | Runnable Expo 55 shell and token sharing; typecheck, lint, origin tests and web/iOS/Android exports passed on 2026-10-05. Native authentication/session storage and device/browser end-to-end work remain. |

Design-system prototypes and sample rows do not establish functionality. See
[decisions.md](decisions.md), the dated [verification report](../../test_reports/2026-10-05-session-security-verification.md),
the [booking authorization verification](../../test_reports/2026-10-05-booking-authorization-verification.md),
and the handoff for current check results and exact limits. This branch is a draft
integration checkpoint, not release approval or production deployment.
