> **10 October 2026 — public marketing parity correction:** PR23 is live but its landing layout failed design-system acceptance. The public composition is being restored against `_ds`; see [parity register](../../test_reports/2026-10-10-public-marketing-parity.md). Source/lint/build checks pass; final CI, integration, deployment and visual acceptance remain pending. Full platform compliance remains open.

> **10 October 2026 — landing hero correction:** [PR #23](https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/23) restores the seven-session reference hero and corrects four visually mismatched prototype samples without changing `_ds`. See [evidence and remaining gates](../../test_reports/2026-10-10-landing-hero.md). Local lint/build/token/data checks pass; final-head CI, new preview deployment and full visual acceptance remain pending. Earlier portfolio-only fixes do not close this hero defect. Full DS compliance remains open.

> **R0 preparation — 8 October 2026:** DS source integrity and existing token/API checks were reverified; [R0 evidence](../../test_reports/2026-10-08-r0-bootstrap.md) records current refs, CI and host probes. This closes no additional DS feature/native/matrix finding. R0 and all dependent acceptance remain open.

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

# Design-system compliance assessment — 2026-10-06

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


## Outcome and assessment boundary

**The application is not fully compliant with the local `_ds` design system and
is not established as deployment-ready.** This assessment inventories every local
reference file and archive member, compares requirements and reference surfaces
with the actual application routes, tokens, CSS, backend registration, mobile
entry point and verification runner, and defines the remaining acceptance gates.
It is a source assessment, not a new runtime/pixel or native-device sign-off.
Existing passing workflow tests do not establish the universal design-system gate.

The current session delivers repository reconciliation, source preservation,
assessment, goals and development-record updates. The implementation programme is
tracked in [the goal ledger](../../goals/GOALS.md); its open goals remain required
before full compliance can be claimed.

## Live Git reconciliation

- Initial local/integration-remote tip: `8da0409f39ab93bfeaf7c91ef6601fa15f5ef38e`.
- Fetch revealed default remote
  `claude/illuminate-gallery-rebuild-deploy-dy6bie` at
  `d446a72a73ded91ba1d5f626dbbd81e3e69771ae`, the merge of PR #12.
- GitHub reports PR #12 merged at `2026-10-05T10:03:31Z`. Its historical draft
  instructions are no longer current status. No merge was performed this session.
- Integration tip was an ancestor, one commit behind; committed file trees were
  identical. Both local existing branches were advanced to that fetched default
  tip using fast-forward/branch ref updates. Work starts from that merge on
  `codex/design-system-compliance-20261006`.
- Initial working changes were 30 tracked `design-system/` deletions and the
  untracked `_ds/` replacement. The user explicitly made local `_ds` authoritative.
  All 30 deleted files match `_ds/Archive.zip` entries byte-for-byte. They are
  preserved in that archive; the replacement is included in the review branch.
- Other remote branches, including `main`, remain independent refs. Synchronizing
  development with the fetched default does not authorize merging every branch.

Final push/head/CI evidence is recorded in the
[session verification report](../../test_reports/2026-10-06-design-system-audit.md).

## Source authority and inventory

The [machine-readable manifest](design-system-source-manifest.json) lists **86
local files**, each with size, SHA-256 and role, plus **115 archive file entries**
with SHA-256, CRC and local-copy relationship. Both ZIPs pass CRC verification.
`python3 scripts/audit-design-source.py` checks the complete inventory against
these reviewed bytes; `--write` explicitly refreshes it after source review.

| Source group | Assessment and role |
| --- | --- |
| `_ds/uploads/Studio-Suit_Project-Defintion.md` | Written foundations, complete lifecycle, components, theme restrictions, intake/template scope and historical open questions. Its own prototype/scaffold descriptions and “Built” labels describe reference work, not this application. |
| `_ds/uploads/Studio-Suite_Universal-Responsive-Design-Requirements.md` | Binding completion conditions for both web and native: feature/style parity, measured geometry, orientation, touch targets, safe areas, keyboard, font scaling and continuous-range coverage. |
| `_ds/uploads/Studio-Suite_Universal-Responsive-Viewport-Matrix.md` | 16 listed web rows and 21 native rows, including constrained geometry. Mandatory explicit checkpoints plus intermediate sampling; applies to authenticated, public, modal, error and loading surfaces. |
| `_ds/packages/tokens/src/{tokens.ts,index.ts}` and package metadata | Latest extracted token reference: per-theme gold/sage ramps, surface/text CSS scale vocabulary, semantic aliases, shadows, gradients and platform adapters. Application tokens differ materially. |
| `_ds/Archive.zip` | 30 files / 36 total ZIP entries; all 30 equal the previously tracked reference. Contains desktop portal, bundled/style-guide HTML, stylesheet pair, older tokens/spec JSON, all 15 JSX component files, branding and assets. 26 members are archive-only paths; four assets also have identical extracted copies. No reference bytes were discarded. |
| `_ds/Mobile-first app design system build.zip` | 85 files; 84 identical extracted files. Only `.thumbnail` is archive-only. No local override was found. Archive itself remains intact. |
| `_ds/StudioSuite-Mobile.dc.html` | Rich browser prototype of public/client/admin surfaces, booking/contact forms, staff and finance. Local browser state/demo identity and success screens are design examples, not backend persistence, authentication or payment evidence. |
| `_ds/StudioSuite-{E2E,Matrix-Probe,Parity-Audit}.dc.html` | Prototype crawlers and historical report. Probe loads a browser iframe with query-string demo auth. Its “Native” dimensions exercise HTML, not a React Native binary. Crawl/report surface lists reflect different reference revisions; they must be rebuilt from application routes and state contracts. |
| `_ds/apps/mobile/app/` | Reference Expo Router screens: public marketing/sign-in, client home/gallery/inbox/documents/prints/profile/intake, admin dashboard/bookings/inquiries/tracker/contacts/documents/finance/content/staff, layouts/index/not-found. None is an authenticated native feature in the actual `mobile/` shell. |
| `_ds/apps/mobile/src/components/` | Shell, logos/icons/UI, booking detail, Luma, intake and all finance parts. Useful layout patterns; native behavior and protected server commands must be implemented rather than copying demo state. |
| `_ds/apps/mobile/src/{state,data}/` | Session, portal, studio and finance state plus seed/calculation data. `state/session.tsx` toggles local `authed`/role; it cannot establish native authentication. Finance seeds/date/rates cannot become live statutory or commercial authority. |
| `_ds/apps/mobile/src/{hooks,theme}/` | Subscribed geometry hook, token theme provider and hook. Reference mechanisms to adapt; physical native geometry/accessibility testing remains required. |
| `_ds/apps/mobile/` configs and README | Reference router, fonts, safe-area/keyboard and unlocked-orientation setup. Historical commands use npm and `@illuminate/*`; live app uses pinned pnpm, `@is/tokens`, Expo 55 and different entry paths. Preserve live architecture while adapting patterns. |
| `_ds/uploads/finance{,-core,-tabs,-audit}.jsx` | Six finance modules, supplier/register forms, reauth and hash-chain prototype. Missing from the application; browser-local books/password gates are not server authorization. Tax rules require separately verified current authority before use. |
| `_ds/uploads/design-system.html` | Standalone loader references `src/styles/*`, `src/components/components.jsx` and `src/design-system/*`, absent relative to `_ds/uploads/`. Not a runnable guide at its current location. Archive contains the older usable layout; avoid interpreting a broken loader as application compliance evidence. |
| `_ds/{assets,screenshots}/`, mobile images, `support.js`, `doc-page.js`, `github.md`, root package | Brand imagery, two historical screenshots, document runtime and historical sync record. `github.md` names another repository (`techcorp-DevApps/studio-suite`), an August date and obsolete paths: reference provenance only. `_ds` is excluded from deployable Docker context and pnpm workspaces. |

### Authority conflicts to retain explicitly

Local `_ds` controls design and required feature coverage. It does not replace
the approved [booking authority snapshots](../authority/booking-2026-10-05/README.md),
image-representation/Luma policy, explicit client grants or server authorization.
All three booking requirements were already approved; do not re-request that approval.

The written definition restricts dark mode to gallery-type surfaces, while
`github.md` describes admin as permanently dark and the archived JSON permits
additional cinematic surfaces. Use the written gallery restriction and the existing
DD-01 decision as the working implementation rule; retain the contrary examples
as an unresolved source conflict rather than silently broadening dark scope.

The newer token reference resolves ramps/bridge issues retained in the archived
older token file. Use the extracted reference for token values and reconcile
application compatibility adapters explicitly. The archived JSON is a historical
mirror, not authority to override those newer values. Scope-sensitive operations
(restricted documents, financial rules, provider consent, staff permissions) need
real backend controls and approved operational definitions; prototype badges,
password text, seeded figures or “confirmed” receipts cannot supply them.

## Compliance findings

Statuses: **defect** = directly contradicted by inspected implementation;
**partial** = real functionality exists but reference coverage is incomplete;
**missing** = no registered application implementation;
**unverified** = no complete evidence for the specified acceptance gate.
Priority P0 blocks a full-compliance claim; P1 is required functional completion;
P2 is reference/document tooling. IDs are stable plan and verification references.

| ID / priority | Requirement / reference | Application evidence and gap | Status / closure goal |
| --- | --- | --- | --- |
| DS-01 / P0 | Extracted token contract: per-theme ramps, CSS bridge, theme shadows/gradients | `packages/tokens/src/tokens.ts` retains single `palette.gold`/sage, different hover/border mappings and older `themeToCSSVars`. `scripts/check-design.mjs` formerly read deleted `design-system/scripts/tokens.ts`; now correctly reads `_ds` and fails on real drift. Compatibility layout/font/motion aliases must survive reconciliation. | defect / C1 |
| DS-02 / P0 | Written light-default/gallery-only dark rule and HTML theme attribute | C1-B removes the global persisted toggle/readers; GalleryViewer applies generated dark tokens to its own modal node while ordinary routes remain light. Production-built desktop/phone computed-theme, focus/scroll and route lifecycle gates pass locally. Hosted and broader regression evidence are recorded separately; native still follows OS dark preference and contrary prototypes remain an explicit source conflict. | partial web; native defect + source conflict / C1, C4 |
| DS-03 / P0 | 280px rail, 72px solid topbar, role shell and compact disclosure | `Studio.jsx` uses a centered `portal-entry`/link group. No shared rail/topbar/compact four-item plus More shell. Client is an enquiry list/detail, not module navigation. Marketing disclosure starts at 800px rather than the required below-1152 fit policy. | defect / C2 |
| DS-04 / P0 | 44px touch area, 1px focus, semantic component grammar | `index.css` has 34px mobile header icons and 36×36 reel controls, 2px focus outline and scattered hardcoded geometry. Some buttons already meet 44px. All states need measured target checks; no blanket pass. Lucide defaults are not centrally pinned to 1.25 stroke/18px. | defect / C2 |
| DS-05 / P0 | All web checkpoints, orientations, overlays and intermediate widths against shipped build | C1-B changes the existing 14-suite runner to serve the production build; narrow per-feature widths/heights remain. No complete all-state 16-row matrix, intermediate range sampling, collapsed-scroll detection, visual baseline or comprehensive computed-style gate. | unverified / C3 |
| DS-06 / P0 | Native rotation and measured geometry, safe areas, keyboard and font scale | `mobile/app.json` explicitly locks portrait; `mobile/App.tsx` has fixed token sizes, no runtime geometry hook, safe-area provider, keyboard layout or feature forms. Cannot meet native matrix or tablet pane rules. | defect / C4 |
| DS-07 / P0 | Exact web/native features and visual parity | Actual native app contains two OS-browser links. `_ds/apps/mobile` is a separate demo/router/state tree. Export/typecheck evidence validates the shell only. No native staff/client authentication, secure storage, lifecycle or protected APIs. | missing / C4 then every feature goal |
| DS-08 / P1 | Public marketing, reserve calendar, selected package and sticky summary | `Landing.jsx`, `BookingForm.jsx`, public Mongo enquiry and server Luma exist. Reference calendar holds/availability, full stepped enquiry and native marketing are absent. Never imply a reserve/confirmation before C5 authority/evidence checks. | partial / C2, C4, C5 |
| DS-09 / P1 | Split-image sign-in and role routing, recovery | Cookie-based staff/client sessions and denial handling exist. Sign-in lacks reference split composition; recovery candidate files are unregistered/default-disabled (`server.py`/`App.jsx`). Native identity exchange undefined. | partial / C2, C4, C10 |
| DS-10 / P0 | Booking schedule/detail, capacities, holds, DST, acceptance/evidence and confirmation | Revisioned planning/proposals, client projections and resource catalog exist (`bookings.py`, `booking_drafts.py`, `booking_resources.py`). Calendar/assigned intervals/conflict fences, permission mappings and agreement/payment evidence not implemented. Confirmation correctly remains 409/disabled. Approved requirements exist; missing implementation is the gate. | partial / C5 |
| DS-11 / P1 | Client dashboard, booking detail and shoot tracker module | `Client.jsx` renders narrow enquiry-linked progress; `StudioBookings.jsx` combines list/detail/lifecycle. Reference phase lanes, per-booking modules, client overview and native counterparts incomplete. Avoid inventing client visibility rules. | partial / C2, C5, C6 |
| DS-12 / P1 | Six intake definitions, persistence, escalation, photographer brief and Luma role | No registered intake/questionnaire/brief backend or application screens. Reference forms and `IntakeScreen.tsx` supply UX examples. Restricted birth/boudoir handling, versioning and brief placement remain operational dependencies. | missing / C6 |
| DS-13 / P1 | Private client gallery, selections, lights-out viewer, download and print collection/orders | Public reel/viewer is real; no client-private image ownership, authorised derivatives/delivery, persistent selections or print orders. No payment/order authority can be inferred from demo steppers. | missing / C7 |
| DS-14 / P1 | Inbox/correspondence and persona-specific Luma | Persistent per-enquiry messaging/read state exists in server/UI. No full cross-booking inbox/attachment workflow, native inbox or authenticated client/studio Luma workflow. Luma is safely server-side; literal reference `gpt-4.1` differs from configurable `gpt-4.1-mini` default, requiring product choice if exact model parity is intended. | partial / C6, C10 |
| DS-15 / P1 | CRM six-tab profile, manual contact edits and booking-derived stats | Canonical client roster/grant relationships exist (`studio_contacts.py`), not manual contacts/profile drawer with document/invoice/gallery/stage tabs or native counterpart. Email equality must never grant access. | partial / C6 |
| DS-16 / P1 | Global Documents Center, 26-template merge engine, restricted flags, PDF, e-signature | Private per-enquiry versioned upload/publish/download exists. No complete template library/merge engine, global centre or signatures. `docs/manifest.json` points to unavailable external contract paths; actual approved contract/SOW versions and provider consent/evidence remain required. | partial / C8 |
| DS-17 / P1 | Six-tab finance suite, invoices/expenses, accounts, audit, suppliers | No registered finance backend/UI. `StudioReporting` counts workflow records; it is not accounting. Prototype GST/BAS/super/depreciation/rate/period calculations and localStorage books are not current tax authority or durable audit records. | missing / C9 |
| DS-18 / P1 | Staff roster/contracts, studio identity and permissions | Operator-managed login identities exist; no employment/contract/supplier registers, studio identity CMS or confirmation permission administration. Reference employee/payroll data cannot be seeded into production. | missing / C9, C5 |
| DS-19 / P1 | Full Site Content surfaces and public/native identity | Existing four plain-text narrative draft/save/publish/restore fields work. No general packages/media/identity/policy CMS or native content administration. Commercial editing must preserve approved obligations. | partial / C6 |
| DS-20 / P1 | Theme logos, typography, tabular numerals, motion and asset behavior | Web local Cinzel/Cormorant/Inter fonts, selected editorial headings, numeric class and reduced-motion rules exist. No local JetBrains font asset, uniform per-page family/number enforcement or app-wide contextmenu/select/image-drag lock with input exceptions. Mobile lacks font/logo binding to the full reference UI. Safe-area CSS absent. | partial / C1, C2, C4 |
| DS-21 / P0 | Real provider/deployment evidence, recovery/delivery, retention and rollback | Historical CI image checks exist, not a live production/provider acceptance. Disk at 98% (589MB free at inspection) prohibits assuming local Mongo/browser infrastructure is sound. Notifications, recovery delivery, R2/Worker originals/derivatives, payment/signature providers and retention remain dependencies. | unverified / C10, C11 |
| DS-22 / P2 | Repeatable current source audit and usable reference discovery | Added full hash/CRC manifest and verification command; correct `_ds` checker path; source directory excluded from Docker context. Standalone guide has broken relative refs; prototype reports carry stale surfaces/repository/revisions. | partial; integrity tooling complete / C0, C3 |

## Complete reference surface crosswalk

Every row requires **both** web and native acceptance, including errors, loading,
empty/conflict states and open overlays. Native current status for every feature
row is absent (browser-launch shell only); the reference native screens are
patterns, not implemented application features.

| Reference surface / child flows | Web application comparison | Goals |
| --- | --- | --- |
| Public marketing, pricing, portfolio/reel, process, print preview | Actual public page/reel/package cards; print flow absent, styling/themes need reconciliation | C1–C4, C7 |
| Reserve a Date / collection preselection / receipt | Persistent non-reserving enquiry form; stepped calendar/summary missing | C5 |
| Public/client/admin sign-in, expired/denied state, recovery | Real web auth/denial, simple form, manual operator recovery | C2, C4, C10 |
| Luma launcher/drawer, each persona, enquiry handoff | Public server Luma and prefill; authenticated workflow/intake assistance absent | C6, C10 |
| Client home / profile / booking status | Enquiry list/detail, sessions and booking projection; full home/profile modules missing | C5, C6 |
| Client gallery folders / selections / viewer / download-all | Only public viewer; private workflow missing | C7 |
| Client prints / size steppers / estimate / order request | Missing | C7, C9 |
| Client inbox / message detail / attachment / document-signing flow | Per-enquiry persistent messages, no complete inbox/signature flow | C6, C8 |
| Client documents / reader / download / contracts | Protected published files exist; merge/template/signatures missing | C8 |
| Client intake / all six questionnaires / submission / brief/escalation | Missing | C6 |
| Studio dashboard / KPI / upcoming / activity / progress lane | Actual enquiry aggregates; schedule and finance-derived KPIs missing | C5, C9 |
| Studio bookings / filters / new booking / detail drawer / scheduling | Real enquiry conversion/planning edits; full reference schedule/detail missing | C5 |
| Studio inquiries / badge / triage / reply / accept-and-create | Persistent triage/conversation/invitations/conversion; needs shell and cross-platform composition | C2, C4, C5 |
| Studio shoot tracker / phase lanes / booking detail | Existing lifecycle list/detail; dedicated tracker and approved visibility mapping incomplete | C5, C6 |
| Studio contacts / add/edit / six-tab profile | Canonical read roster, incomplete manual/contact-detail workflow | C6 |
| Studio global documents / templates / editor / PDF / restricted gate | Per-enquiry uploads only | C8 |
| Studio staff / roster forms / contracts / renewal / identity | Operator login management only | C9 |
| Finance overview / settings / obligations | Missing; reporting is operational counts | C9 |
| Finance invoices / raise / detail / record payment / send / PDF | Missing | C9 |
| Finance expenses / create/edit/delete / reauth / audit chain | Missing | C9 |
| Finance GST & BAS / Reports / Accounts / period selection | Missing | C9 |
| Finance suppliers / goods-services rows / start expense | Missing | C9 |
| Site Content / studio identity / narrative / packages | Four narrative fields only | C6 |

## Acceptance strategy and external documentation

The mandatory matrices remain exactly as supplied under `_ds/uploads/`. C3
must register every application surface/state, test the production-built SPA,
both relevant orientations, 1152px navigation floor, 375×812 small end, keyboard/
constrained height, all overlays, ≥44px touch targets (with documented inline-text
exceptions), reachable scrolling and intermediate widths. Browser screenshots and
computed styles must include token/theme/typography/geometry assertions; merely
hiding `overflow-x` cannot pass. Baselines must represent approved `_ds` design,
not snapshots of the current defects.

C4 must separately run the 21-row native matrix and intermediate geometry on
iOS and Android, including rotation transitions, 275/320/360/372 constrained
widths, tablet panes, safe areas, raised keyboard, largest OS fonts and platform
44pt/48dp targets. A browser iframe or Expo web export is not native evidence.

Context7 was used to consult primary
[Playwright viewport/device configuration](https://github.com/microsoft/playwright/blob/main/docs/src/codegen.md)
and [browser/device projects](https://github.com/microsoft/playwright/blob/main/docs/src/test-projects-js.md).
These document reproducible browser emulation; native release gates require
separate device tooling. This documentation check changes no application
dependency or model version. GitHub connector reads independently verified the
repository default branch and merged PR state.

## Next concrete implementation

Begin C1: migrate token values from the extracted reference, preserve application
adapters in separate modules, and demonstrate web/native generated theme parity.
Then enforce gallery-scoped theme ownership with real navigation/unmount tests.
Build the C2 shell/components and C3/C4 gates before expanding new domains, so
each later feature receives functional, responsive and visual evidence together.
Approved booking implementation (C5) can proceed independently of absent finance
providers while confirmation remains gated. Dependencies never make an absent
surface compliant; track them and continue unrelated work.
