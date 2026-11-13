# R0 complete infrastructure execution contract — 8 October 2026

**Revised; QUEUED for fresh source-fidelity scope audit.** This is the complete single R0
phase, not a new product phase or an accepted implementation. Preparation has
established an existing host; do not implement these paths until scope PASS.

## Frozen scope

```yaml
phase_id: R0
parent_goal: C0
additional_parent_goal: C11
finding_ids: [DS-22]
outcome: an existing-host supervisor enforces every phase gate and clean continuation
base_commit: 11c537271958fd357f3ab9337f06bac0aa95ffee
base_tree: 3e212b16ab94df4ae705dbd17392d42e66de36c8
candidate_branch: codex/studio-suite-r0-candidate-20261008
integration_branch: codex/studio-suite-r0-supervision-20261008
controller_model: gpt-6.1-sol
controller_effort: medium
platform_scope: infrastructure_only
required_feature_platforms: []
next_product_phase: none_until_R0_GREEN_and_RESET_CONFIRMED
```

Authority inputs, pinned before scope review:

| Path | Sections / purpose | SHA-256 |
| --- | --- | --- |
| `docs/development/long-running-session-plan.md` | Bootstrap exception; knowledge; contracts; all phase transitions; isolation/input/result; records; compaction/bootstrap; R0-B; continuation/stops | `9e9c7bbc47bb995bc1368edad11d943aa3135379cbce4c113b3693cfefdd641d` |
| `docs/development/readiness-assessment-2026-10-07.md` | Verified baseline, environment constraints, first execution | `ebef319b9b0cd3f5122749bd597661118a667e326a3020edeecbd0e448ac0c50` |
| `docs/development/design-system-source-manifest.json` | Immutable DS/source inventory; no product reinterpretation | `abbcc51be2b6f4c3e381134d14732da4192257e27cde37a3f4a4ec8ae48f292f` |
| `.github/workflows/ci.yml` at base | Existing aggregate jobs to preserve | `642722fe0d30bfeced712cbcec8f21d03fa148d6b557e9527580c46f63a6364d` |

Dependencies: live Empirical workspace/policy/history/scar/todo recall, current
Git/CI/source reconciliation, qualified installed Codex 0.161.0 native root-deny
host, actual supported compaction and fresh memory-first bootstrap capabilities.
These are preparatory prerequisites, not predecessor GREEN phases. Each actual
review instance must produce its own challenge-bound grants/transport/sentinel
receipt; historical qualification cannot waive instance checks. R0 itself must
complete all gates and its final actual reset before product work starts.

Mandatory controller memory protocol, at activation and after every reset:
read the installed Empirical memory/work-history/scar-tissue/todo skills and
current policy; verify workspace key `studio_suite_v2`; recall recent project
work history, applicable scars and open todos before substantive source work.
Fetch full relevant records when a summary is truncated; relax filters when
results are empty. Retain exact IDs/dates and verify claims against source/Git/CI.
On memory failure retry once and use the documented connected/CLI alternative;
with `stopOnMemoryFailure=true`, failed access checkpoints and blocks new work or
advancement. Local artifacts cannot replace persistent memory. Initial source
access must remain denied until live workspace/policy/recall readback succeeds.
Tests must exercise truncated/empty retrieval and failed/alternative readback.

When Goal tools exist in the controller runtime, register the active R0 objective
after activation, use the actual lifecycle rules and preserve the goal ledger
across interruption/fresh bootstrap. Never invent a token budget, complete an
unfinished objective due to context/time limits, or pause without user instruction.
Observe actual tool availability/receipts; fixture absence/presence tests do not
substitute for available runtime calls. Scope reviewers do not activate objectives.

Implementation allowlist (exact files):

- `scripts/autonomous/__init__.py`
- `scripts/autonomous/protocol.py`
- `scripts/autonomous/review_host.py`
- `scripts/autonomous/gate.py`
- `scripts/autonomous/supervisor.py`
- `scripts/autonomous/tests/__init__.py`
- `scripts/autonomous/tests/test_protocol.py`
- `scripts/autonomous/tests/test_review_host.py`
- `scripts/autonomous/tests/test_gate.py`
- `scripts/autonomous/tests/test_supervisor.py`
- `.github/workflows/ci.yml`: add these two review-branch triggers and one
  standard-library infrastructure test job; preserve all existing required jobs,
  source/token/native-typecheck/browser assertions and permissions.

Non-executable records allowlist: `README.md`, `goals/GOALS.md`,
`docs/development/phases/R0/`, `docs/development/session-handoff.md`,
`docs/development/next-session-prompt.md`, `docs/development/feature-status.md`,
`docs/development/design-system-compliance-audit.md`,
`docs/development/decisions.md`, `test_reports/2026-10-08-r0-bootstrap.md` and
`test_reports/artifacts/r0-2026-10-08/`. Pre-existing planning/history/assessment/
active-plan records may be copied byte-for-byte into the isolated branch and
published; their authority hashes are frozen executable-manifest inputs and
cannot change in a records-only commit. Preserve the user's original checkout.
Do not put executables, tests or generated application assets in records paths.

Excluded: application/mobile/backend/token/DS/schema changes; business policy;
database startup/writes; provider/native acceptance claims; global configuration,
credentials, model substitution; main merge, deployment, force push, branch
deletion, paid resources and customer messages. No dependency installation is
needed for the standard-library harness. Full application regressions use the
existing isolated hosted CI resources, not this capacity-limited local database.

## Observable mandatory acceptance

| ID | Required behavior and verification | Evidence |
| --- | --- | --- |
| AC-1 | Fresh source-only scope audit passes before code. Actual builder/controller launch is gpt-6.1-sol/medium, with live Empirical first and no silent fallback. | Contract/source digests, scope verdict, effective launch and recall receipts. |
| AC-2 | Supervisor follows QUEUED→SCOPED→BUILT→TESTED→REVIEWED→INTEGRATED→RECORDED→GREEN→RESET_CONFIRMED. Failed/blocked/rework states preserve last successful state and deny dependent work. Arbitrary phase/receipt text cannot promote a state. Every transition binds the exact contract, candidate and evidence. Conditional Goal-tool registration/lifecycle/ledger and no invented budget are verified. | `python3 -m unittest discover -s scripts/autonomous/tests -v`; event journal, actual available Goal-tool receipts and disposable qualification cycle. |
| AC-3 | Packet constructor uses an explicit file/field allowlist, frozen base/candidate/source/evidence manifests and neutral instructions. Reject transcript, analysis/hidden-reasoning payloads, prior reviewer verdicts and caller-selected untrusted paths; source text describing forbidden fields remains legitimate authority. No reasoning export is created. | Real packet construction plus hostile packet/property fixtures; raw rejected cases. |
| AC-4 | Each fresh reviewer has read-only frozen source/authority, separate output/scratch, narrow helper reads, root deny and disabled egress/integrations/inherited history. Fixed broker exposes only same-instance allowlisted metadata. Actual harmless input-write, hidden-host read/write, IPv4/IPv6/metadata/local network, PID/root/env, namespace/mount and extra-field callback probes prove original host/source integrity and transport isolation. A mandatory unverified check fails review. | Actual native-profile/API facts, raw independent commands, challenge-bound sentinel/packet/transport receipts; `test_review_host`. |
| AC-5 | Gate verifies every mandatory AC disposition, no unresolved blocking finding, exact candidate SHA/tree/packet/source hashes and independently produced instance receipts. Reject missing evidence, changed candidate, stale authority and malformed/leaked reasoning fields. Builder cannot waive findings or manufacture PASS from unavailable tests. | Outcome reviewer dispositions plus negative gate tests exercising material changes, not mirror-only happy-path assertions. |
| AC-6 | One atomic controller lease per branch. Concurrent duplicate is rejected; killed/interrupted owner can be reconciled safely using actual process identity/journal/Git/receipt facts. Restart never blindly replays a mutation or counts an incomplete gate as passed. Bound observation limits to explicit unresolved status; close only owned processes. | Concurrent subprocess lease test, interruption/restart test, actual disposable host process cleanup facts. |
| AC-7 | Harmless disposable infrastructure qualification exercises the complete supported orchestration path, including fresh scope/outcome/records contexts, gate failures and compaction/fresh bootstrap. Synthetic fixtures remain labelled synthetic and cannot satisfy live publication, memory or final-head CI. The actual R0 phase supplies those live gates separately. | Qualification-mode raw events, every gate disposition, actual app-server lifecycle/negative bootstrap; fixture/live provenance fields. |
| AC-8 | Freeze executable/source/test/config/dependency/authority manifest and separate records allowlist. Integrate only reviewed bytes on the dedicated branch by fast-forward. Records changes require fresh consistency review; any change outside records invalidates approval. Final receipt binds both manifests to the final commit without self-hash recursion. | Candidate/integration/final SHA/tree, executable equality, records review and manifest receipts. |
| AC-9 | Publish only the dedicated review branch without overwrite; verify exact remote equality and successful backend, web, production routing and new infrastructure CI on integration SHA and final records SHA. Maintain a new draft PR; PR #18 is already merged. Pending/missing jobs remain blocked. | Live GitHub run/job/remote/draft-PR receipts and links. |
| AC-10 | Reconcile affected documents and goals without closing native/product parents. Follow the exact mandatory memory protocol above. Each completed coding unit uses `authorType: agent`, `work-history`, `mass: 1`, project tag `studio-suite_v2`; verify selected workspace before writes. Capture exact discoverable `data.session`/`data.git` before each write, including runtime/session ID, matching transcript path only when found, actual repo/worktree/branch/HEAD/start commit/related commits only when verified. Respect applicable metadata authorization already supplied; never infer missing authority or invent metadata. Update existing relevant todos/scars; verify each write receipt and full readback. Missing readback blocks RECORDED/GREEN. | Dated report/checkpoint, source/doc consistency review, installed-skill/policy/workspace/recall/failure-handling tests, actual Empirical IDs/receipts/readback and metadata authority. |
| AC-11 | After independent final gate validation, save ≤1000-word factual GREEN checkpoint, compact the actual idle R0 controller via supported method and require matching completed contextCompaction/successful lifecycle. Start distinct empty-history medium thread with standing instructions/checkpoint pointer/next ID only. Live Empirical first, then current source/Git/CI/prior GREEN verification; mismatch or failed memory/compaction/bootstrap denies RESET_CONFIRMED and product activation. Never send compaction to reviewers. | Actual phase-boundary lifecycle and new bootstrap receipts; failed compaction/bootstrap/stale-source rejection tests. |

Additional exact checks: `python3 scripts/audit-design-source.py`,
`node scripts/check-design.mjs`, `node scripts/check-token-compatibility.mjs`,
`git diff --check`; preserve source hashes and all retained failures/skips.
Local unit and sandbox tests do not claim aggregate application/native/provider
success; successful exact-head hosted jobs are the separate aggregate evidence.

Implement the host/supervisor as Python standard-library modules around the
installed app-server protocol and native permission profiles. Keep transport
credentials outside reviewer tools. Validate effective features/grants through
actual APIs before tools launch. Fixed live Empirical callbacks may use the
authorized CLI/connected read-only policy bridge; memory writes stay controller
operations under the explicit project policy, never reviewer capabilities.
No new container/cloud account/service or unrestricted network grant is allowed.
Private virtual scratch files or private namespace/mount operations do not by
themselves establish an original-host escape; checks must distinguish their
mounts and verify excluded original host/source objects remain unchanged.

The disposable qualification cycle may use a temporary Git repository and
explicit synthetic receipt fixtures to test transitions/negative cases. It must
also execute actual host review/compaction/bootstrap capabilities. Report its
synthetic integration/CI/memory facts as synthetic; the real R0 integration,
publication, document/memory readbacks and final independent gate must pass before
R0 GREEN. Only after the factual GREEN checkpoint may actual controller compaction
and fresh bootstrap run; both must pass before RESET_CONFIRMED and product
activation. This distinction preserves every
mandatory operational gate while keeping the rehearsal harmless.

Resource envelope: measured approximately 1.7 GiB free/94% used, 6590 MiB RAM,
no swap; allocate ≤100 MiB temporary qualification artifacts, one active model
process at a time, bounded observable API/test waits. Re-measure before build;
stop local preparation below 512 MiB free. Existing hosted CI remains required.

Stop for failed scope/outcome/records review, source/candidate drift, unsupported
host API/effective model/grants, missing authority/memory/publication/CI evidence
or inadequate capacity. After two same-failure repair/review cycles diagnose and
revise/split with fresh scope review; never weaken mandatory acceptance. Continue
independent reversible evidence recovery while dependent gates stay blocked.

Rollback: isolated worktree/review branches retain original user checkout and
source bytes. Close only owned probes/controllers, preserve failed evidence and
verified checkpoints; ordinary corrective review-branch commits are reversible.
No destructive reset, force push, branch deletion or unapproved main operation.
