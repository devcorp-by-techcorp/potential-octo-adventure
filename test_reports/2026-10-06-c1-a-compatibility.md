# C1-A compatibility follow-up — 6 October 2026

Run: C1-A-compatibility / DS-01/20. Start SHA:
`f496b2205e5a67753e02d922efa6b4aa1ed99a2b`, fetched main (PR #17 merge).
Branch: `codex/prerequisite-reconciliation-20261006`.
Ancestry confirms published C1-B tip `d8f604dd46cd079f82613517aa4d3079138869c0`.
Fresh branch advanced to fetched main before edits; initial tracked tree clean.
Read project protocol, handoff, goals, feature register, decisions, design audit,
C1-B report and Empirical IDs 6ac46c1500f9510b56212609 (publication note),
6ac46c2200f9510b5621265c and 6ac465f900f9510b562111a1.

Scope recorded before edits in work/c1-a-compatibility-scope.md: only public token
compatibility, historical API checks, CI wiring and records. C3-A not activated.
No shells, native foundations, recovery/domain changes, merge or deployment.
_ds and its tokens.ts mirror unchanged. Existing scratch/.empirical preserved;
booking HTTP 409 confirmation gating unchanged.

## Compatibility evidence

Separate compatibility.ts exports goldChampagne as palette.gold and sageLight as
palette.sage, restores numeric shadow alpha and rollup aliases, supports historical
shadowToCSS(key, RGB color) and default shadowToRN(key) #000. Explicit light/dark
helper arguments still use authoritative themed values. Generated CSS/themes stay
reference-derived. Added immutable pre-migration fixture from ec64ed91521456c23b2bc84128be041c45aa6908,
with independent historical comparisons of web and native bundles, all three
shadow sizes, custom colors, aliases and rollup shape. CI runs both contract gates
and triggers for this review branch.

Local acceptance passes: installed tsup + build-css; node scripts/check-design.mjs;
node scripts/check-token-compatibility.mjs; python scripts/audit-design-source.py;
web eslint and Vite production build (1664 modules); mobile tsc --noEmit.
This does not claim actual native/device or new browser acceptance. No DB work.
Initial API checker used child_process git show and hit sandbox spawnSync EPERM;
replaced with committed historical fixture to work in shallow CI checkouts.
Initial fetch failed to connect to proxy; supported additional network permission
succeeded. Main check-runs API returned Forbidden with both inherited auth and
GIT_PAT selected as GH_TOKEN. No credential values printed.

## Recovery and CI reconciliation

User reports reviewed green C1-B checks and merge. Fetched main independently
confirms merge/ancestry. Current-commit hosted results remain inaccessible through
GitHub REST; user-reported green checks are distinguished from independent evidence.
No intervening product recovery fix is established by the merge. The existing CI
web job invokes the production runner including studio_bookings.py; a green job
would demonstrate that run passed in its hosted environment, but would not explain
the retained failure on both prior production bundles. Four later denial modes
were not reached locally. Follow-up 6ac46c2200f9510b5621265c remains open: obtain
exact-head hosted logs/artifacts and reproduce/diagnose session restore/render
under production with unchanged denial/no-write assertions. Do not claim resolved.
Retained C1-B failure evidence is unchanged.

Next bounded run: recovery-render/hosted evidence reconciliation, separately from
this compatibility repair. C3-A only becomes eligible after prerequisite evidence
is reconciled. Parent C1 and full compliance remain open. Push and Empirical
updates explicitly authorized; final publication evidence follows below.

## Publication receipt

Implementation b491ebc24665d257a14aec5df05a5ee21a6f059a pushed successfully;
ls-remote matches local HEAD. Exact implementation check-runs and PR GraphQL
both returned Forbidden. No hosted pass or live PR state claimed.
Empirical agent-authored work-history receipt 6ac4703c00f9510b56212c87 created
and read back with matching start/implementation metadata. This records-only
publication commit follows; identify final SHA via Git/remote equality.
