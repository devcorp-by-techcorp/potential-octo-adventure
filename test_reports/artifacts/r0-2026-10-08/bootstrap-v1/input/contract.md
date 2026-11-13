# R0 preparatory compaction and fresh-bootstrap qualification

Authority: the unchanged active plan, sections “Bootstrap exception without
bypassing acceptance”, “Knowledge and authority” and “Self-compaction and fresh
bootstrap”; SHA-256
`9e9c7bbc47bb995bc1368edad11d943aa3135379cbce4c113b3693cfefdd641d`.

Qualify the supported existing host before supervisor/gate implementation. This
is one disposable read-only rehearsal against the actual project checkpoint,
not a GREEN phase, product activation, or substitute for R0's eventual complete
gate/reset. No supervisor state machine or application code is implemented.

Use the already qualified Codex 0.161.0 host and exact gpt-6.1-sol/medium selection.
Complete an idle disposable controller turn, request `thread/compact/start`, and
observe matching contextCompaction completion plus successful lifecycle result.
Only then create a distinct empty-history thread with `thread/start`, never
resume/fork. Give the fresh controller standing instructions, the checkpoint
pointer and next contract ID; do not pass predecessor messages or compacted items.

The fresh controller must query live Empirical first. A fixed read-only host
callback retrieves current workspace, the exact host-qualification work-history
record `6ac6d00d6705457911c73200`, baseline record
`6ac6c8f46705457911c723b2`, scar-tissue record
`6ac6c9446705457911c724ab` and action record
`6ac6c94b6705457911c724fa`. Query policy through the connected read-only API if
the CLI does not expose it. Then read checkpoint, contract and source authority;
independently hash them. Verify actual Git branch/HEAD/tree and current remote
main/preview refs, merged PR #18, and exact application-head CI run 37443377221
and all three required jobs. Broker operations accept only fixed probe names
and a challenge, no arbitrary path, command, query, write or credential export.

Required evidence:

- BQ-1: successful completed controller turn followed by matching completed
  contextCompaction item and successful compaction turn; acknowledgement alone
  is insufficient.
- BQ-2: distinct fresh thread/start response, empty initial turns, effective
  gpt-6.1-sol/medium; initial input contains no predecessor conversation.
- BQ-3: live Empirical retrieval precedes source reads; selected project workspace
  and required record IDs/readbacks are verified. Memory failure blocks bootstrap.
- BQ-4: frozen checkpoint/contract/authority digests independently checked; live
  source bytes, Git/remote refs and exact-head CI agree with the checkpoint. No
  missing required job or stale-source agreement can pass.
- BQ-5: factual bootstrap receipt binds thread, source/Git/CI/memory facts and
  next scope. Current R0 is PREPARATION_ONLY and not GREEN; explicitly deny
  RESET_CONFIRMED and product phase advancement. The eligible continuation is
  R0's full supervisor/gate contract scope audit, not R0-C/C3/C4 implementation.
- BQ-6: a fresh negative bootstrap receiving a deliberately mismatched expected
  authority hash must report BLOCKED, name the mismatch and permit no advancement.

Return factual JSON with every BQ disposition, hashes, current prior-gate status,
next contract ID, advancement permission, findings and evidence limits. Do not
export private reasoning, credential values or raw transcripts. This test
qualifies the observed host/reset/bootstrap capabilities only. The later complete
R0 phase still requires its own scope/outcome/records reviews, supervisor and
negative-gate tests, integration/publication, exact final-head CI, memory readback,
GREEN checkpoint and actual compaction/fresh bootstrap at that boundary.
