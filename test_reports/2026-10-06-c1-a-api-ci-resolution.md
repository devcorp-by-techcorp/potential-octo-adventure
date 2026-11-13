# C1-A API and CI resolution — 6 October 2026

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

Local web ESLint and Vite production build pass (1664 modules). Implementation-head hosted verification passes: all three jobs in run 37411342989.
Final records-commit verification is checked separately during publication.

No local Mongo/browser aggregate rerun: disk has only 167 MB free. Full backend,
browser and production-image evidence will come from isolated hosted CI; no
local aggregate pass is claimed.
