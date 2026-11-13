# R0 bounded repair acceptance — 9 October 2026

Supplementary testable specification under immutable execution contract SHA-256 e8472eba2f0ea0dc6ab9bda2ab52011540841b8e6763c467eec80809345e0337. All eleven criteria, source pins, file allowlists, independent roles and operational stage ordering remain mandatory. This is infrastructure repair within R0; no product or publication authorization changes.

AC-2: Every recorded REWORK/BLOCKED/FAILED gate denies dependent advancement, retaining the last successful state across journal reload. Only explicit reconciliation against distinct repaired evidence, externally verified for the failed gate and exact binding, may release the denial. Reconciliation is durable and revalidated after restart; arbitrary text, reuse of failed evidence and invalid gates cannot clear failure.

AC-3: Explicitly allowlisted, hashed structured evidence must recursively reject normalized prohibited payload fields. Source authority explaining forbidden fields remains legitimate. Malformed JSON evidence cannot silently become uninspected plain text. Nested/camel-case prohibited-field negative cases must exercise evidence files, not only metadata.

AC-5: Exact mandatory unittest output must contain one coherent nonzero suite result and successful terminal summary, zero skips and no explicit failure/error summary. Contradictory FAILED plus trailing OK, multiple summaries and malformed results deny TESTED despite exit zero and correct hash.

AC-8: Final records acceptance requires actual regular-file, non-executable modes in addition to bound hashes and independent complete Git-tree manifest comparison. Executable-mode, symlink, byte drift and unallowlisted record negatives remain denied. Archived probe source bytes may be retained only as non-executable .txt records with exact-byte migration hashes; historical source manifests remain historical and cannot be rewritten to conceal previous paths.

AC-1: Freeze neutral source-scope receipt digests, verified receipt identifiers and ordering against the corresponding implementation before review. Keep previous verdict contents, findings, broad memory and builder history excluded. No mid-review changes to frozen input or broker facts.

AC-7/AC-11: Actual disposable lifecycle evidence must correlate controller/thread/turn/item IDs with successful native contextCompaction completion and distinct fresh bootstrap command outcomes, including memory-before-source ordering and stale-source rejection. Export only narrowly projected native lifecycle and command outcomes; no messages, memory contents, transcripts or private reasoning. Preserve explicit synthetic delivery receipts and qualification-only limits; actual R0 GREEN/reset remain separately due.

Verification: retain existing 50 tests and add meaningful reproductions above; rerun all five contract commands on the exact candidate. Fresh native source-only scope audit precedes this bounded repair, then complete actual supported disposable qualification and fresh independent outcome review. All later integration/records/CI/GREEN/actual reset gates remain pending until their live receipts pass.
