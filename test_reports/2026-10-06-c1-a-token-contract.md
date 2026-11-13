# C1-A token contract run — 6 October 2026

Starting SHA: ec64ed91521456c23b2bc84128be041c45aa6908. Fetched origin HEAD matches.
Empirical skill and project history read; prior P0 access limitation resolved.
Scope: DS-01/20, packages/tokens source, separate compatibility adapters,
CSS generation, scripts/check-design.mjs and relevant continuation records.
Reference _ds stays unchanged. Theme lifecycle, shells and domain work excluded.
Acceptance: token/workspace build, web lint, native typecheck, source integrity,
exact source equality, generated light/dark CSS and web/native adapter comparisons.
GitHub REST check-runs returned Forbidden; hosted CI cannot be claimed.
Existing untracked .empirical directory is preserved and excluded.

## Results

Local gates passed: tsup JS/native/declarations and CSS generation; web ESLint
and Vite production build (1663 modules); mobile tsc --noEmit; design checker
compares exact source, both bundled token objects, both compatibility maps,
all generated theme variables and native/web shadow adapters; 25 runtime vars
resolve. Source integrity: 86 files/115 archive entries and CRC/SHA match.
No browser/database/device/provider acceptance is claimed for this token-only run.
The pnpm launcher initially failed attempting its managed-version install under
/home/agent; equivalent installed tsup, ESLint, Vite and tsc binaries were used.
Whitespace gate passed. GitHub API Forbidden blocks exact-head hosted evidence.
C1-A implementation locally verified; parent C1 remains open. C1-B pending
publication/hosted verification. No merge/deploy/customer communication.

## Publication boundary

Implementation commit: a8e13ed. Automatic approval review rejected the push to
origin (repository payload/destination trust and explicit authorization concern).
No push occurred. The Empirical record write was separately rejected for external
project/work-history export authorization and destination ownership concerns.
No current-run memory receipt exists. User approval requested for both actions.
C1-B remains pending. Read-only fetch and origin HEAD verification succeeded;
GitHub REST hosted-check evidence remains Forbidden. This is local verification,
not a completed published autonomous run.

## Authorized publication follow-up

User explicitly approved GitHub push and Empirical update. Push succeeded;
remote branch SHA matched c1ef7349d09ff05d01ad38af2dceb2392ed494c5.
Empirical receipt 6ac465f900f9510b562111a1 created and read back successfully.
Exact-head check-runs API still returned Forbidden after approval; hosted gate
remains unverified. Follow-up records commit publishes this evidence and the
continuation prompt; resolve its SHA through Git history and remote readback.

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

Gate-review records commit `5e4d413f59794c6f8fc40bfe3ae3b56c7e2ad2c6`
was pushed and remote equality verified. Its exact-head CI request also returned
Forbidden. Empirical receipt `6ac4671d00f9510b56211fdb` was created and read
back with matching Git/session metadata. This follow-up publishes the receipt;
resolve its final SHA through Git history. C1-A and C1-B remain blocked.
