# R0 bootstrap contract — preparatory checkpoint, 8 October 2026

**State: PREPARATION_ONLY; existing review host qualified.** This freezes the
completed R0-A evidence and R0-B host probes. It does not declare SCOPED, GREEN,
independent scope acceptance, or permission to implement supervisor/gate code.
R0-A and R0-B remain preparatory tasks of one R0 phase.

## Frozen authority and baseline

- Parent goals: C0 and C11; source finding DS-22.
- Authority: `docs/development/long-running-session-plan.md`, sections
  “Bootstrap exception without bypassing acceptance”, “Review isolation and
  non-contamination”, “Self-compaction and fresh bootstrap”, and R0 backlog rows.
  SHA-256: `9e9c7bbc47bb995bc1368edad11d943aa3135379cbce4c113b3693cfefdd641d`.
- Assessment: `docs/development/readiness-assessment-2026-10-07.md`, sections
  “Verified baseline” and “First execution action”. SHA-256:
  `ebef319b9b0cd3f5122749bd597661118a667e326a3020edeecbd0e448ac0c50`.
- Application base: `11c537271958fd357f3ab9337f06bac0aa95ffee` on
  `codex/prerequisite-reconciliation-20261006`. No new integration branch is
  activated until the full R0 scope contract receives independent acceptance.
- Original authority/record hashes and live ancestry:
  `test_reports/artifacts/r0-2026-10-08/baseline.json` and
  `initial-records-manifest.json`.

## Preparation boundaries

Allowed records: this phase directory, `test_reports/2026-10-08-r0-bootstrap.md`,
`test_reports/artifacts/r0-2026-10-08/`, and factual current-checkpoint updates in
README, the development handoff/prompt/feature register/decisions/audit, and
`goals/GOALS.md`. Temporary disposable host probes may use task-specific `/tmp`
directories. They may create only synthetic sentinels, test outputs and qualification receipts.

Excluded: application, `_ds`, schemas, business rules, global host configuration,
credential changes, database startup/writes, main integration, deployment, paid
resources, supervisor/gate implementation and product-phase activation. Preserve
all pre-existing user records and historical failures.

Dependencies: connected Empirical workspace `studio_suite_v2`, current policy and
work-history/todo/scar-tissue recall; live Git/CI access; existing installed Codex
host and available namespace tooling. No full database/browser/native workload is
authorized by the measured approximately 1.7 GiB disk reserve alone.

## Observable preparatory acceptance

| ID | Assertion and commands/evidence | Disposition |
| --- | --- | --- |
| P-1 | `git ls-remote origin refs/heads/main refs/heads/codex/prerequisite-reconciliation-20261006`; fetched ancestry; PR #18 and exact run 37443377221/jobs. Baseline JSON and report. | Pass for captured application SHA; no final R0 integration claimed. |
| P-2 | `python3 scripts/audit-design-source.py`, `node scripts/check-design.mjs`, `node scripts/check-token-compatibility.mjs`. | Pass; source/token integrity only. |
| P-3 | Disposable `unshare --user --map-root-user --net bwrap …` probe hides host/source history, denies source/outside writes and egress, permits temporary output. `receipt.json` and `probe.py`. | Pass for this manually invoked boundary; not an integrated reviewer. |
| P-4 | `python3 /tmp/studio-suite-r0-reset-probe.py` through authorized host: effective `gpt-6.1-sol`/medium, actual compaction item completion plus successful turn, distinct empty-history fresh thread and successful marker turn. Preserved probe and lifecycle JSON. | Pass for capability smoke; not Empirical/source bootstrap or GREEN/reset acceptance. |
| P-5 | Actual model reviewer tools execute in the enforced boundary, with frozen inputs, no host credentials/history/connectors/unauthorized egress and a neutral scope packet. Native-profile receipts. | Pass under host-qualification-v2.md: fresh actual reviewer passed six criteria with eight live receipt hashes verified, actual host sentinel and frozen input unchanged. Earlier BLOCKED/stale-output evidence retained. No full R0 acceptance or supervisor scope approval. |

Resource scope is infrastructure-only; no web/iOS/Android feature acceptance.
P-5 now passes for the tested existing host; evidence is in `host-v2/` and Empirical
`6ac6d00d6705457911c73200`. Preserve narrow root-deny grants, fixed actual-instance
broker and prior failure evidence. Next prove the actual supported compaction and
fresh Empirical/source/Git/CI bootstrap under `bootstrap-qualification.md`.
Then freeze the full R0 supervisor, negative-gate, publication, records and reset
acceptance contract and obtain its fresh sandboxed scope audit before code.
Preparation does not supply a GREEN phase or RESET_CONFIRMED advancement.
Rollback is removal of this run's synthetic probes/records on a review branch
while preserving original sources and failed evidence.
