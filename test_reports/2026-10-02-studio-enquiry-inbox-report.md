# 2026-10-02 — Phase 2 persistent studio enquiry inbox

## Baseline

Fresh clone initially checked out default branch at
`e50717002c05b41fd7a78a1126cc7c8d10fe1554`. Current fetched main and feature starting
commit: `d28337bd529641697444bbfc0ea2551635203406`.
`git merge-base --is-ancestor` verified main contains that merge,
`0ff090ce0c0c5f8edcb5fb80a966ad6bfb28081f` (Phase 1), and
`e50717002c05b41fd7a78a1126cc7c8d10fe1554` (public entry page).
Created `feature/phase-2-studio-enquiry-inbox` from origin/main. Clean checkout;
no pre-existing user changes. No applicable AGENTS.md found. Read README, entry,
authentication, Phase 1 report and CI, then inspected current handlers/UI/fixtures.

## Requirements-to-tests plan

| Requirements | Verification |
| --- | --- |
| Current staff authorization on all endpoints, session invalidation, supplied roles, CSRF/Origin | Handler security matrix against isolated MongoDB; browser direct routes and access changes |
| Allowlisted models, bounds, private errors/no-store, legacy read compatibility | Handler validation/projection and non-mutating-read tests |
| Atomic revisions, server actor/UTC time, archival/reopening, persistence | Concurrent handler writes; new clients/app instances; two-staff browser conflict |
| Public content/idempotency/pending state and privacy retained | Public submission/retries after updates; existing public/Luma regressions |
| Bounded keyset pagination, ties, filters, concurrent inserts, indexes | 10,000-record real-MongoDB traversal, explain and latency evidence |
| Loading/empty/missing/failure/conflict/reconciliation and private cleanup | Real-login/API/MongoDB browser suite; intercept failures only |
| Keyboard, themes and five widths; previous public/auth behavior | All three browser suites, overflow and page-error assertions |

## Implementation and final review

Three new allowlisted handler contracts in `backend/studio_enquiries.py` use
existing staff read/write dependencies. Keyset pagination fetches `limit+1`,
sorted by UTC creation time and string UUID descending. Cursors are bounded and
schema/filter/sort validated. Lists omit messages/notes/contact details; details
omit hashes and operational fields. PATCH forbids extra fields and compares the
expected revision atomically in a MongoDB update pipeline. Pipeline note values
use `$literal` so a leading `$` remains plain text. Actor/time are server-owned.
Missing legacy revision is 0; first authorized update normalizes triage only.
New public submissions receive defaults without changing idempotency or receipts.
No bulk migration, parallel persistence collection or notification action added.

`Studio.jsx` remains the shared session/sign-in/sign-out layer for home/inbox/detail;
`StudioEnquiries.jsx` contains list/detail/editor states. The existing API helper
adds PATCH support and rejects malformed successful JSON. Failure/conflict retains
the draft; refresh and explicit reconciliation precede rebasing a draft. Session
loss/identity changes clear private components; navigation aborts stale requests.
Customer content is text; preferred dates avoid timezone conversion; timestamps
are labelled UTC. Backend and browser filenames match the suggested conventions.

Reviewed the complete feature diff for scope, authorization, projections,
legacy compatibility, pipeline injection, lost updates, public retry preservation,
private-data errors/storage/URLs, bounded loads, index use and stale requests.
Existing public/auth tests were retained unchanged. No auth implementation,
provider production adapter, deployment manifest, lockfile or later-phase feature
changed. Desktop/dark and 320px detail screenshots were visually reviewed from
temporary artifacts. The operating guide covers shared notes, concurrent editing,
uncertain-save recovery, index initialization/permissions and privacy.

## Runtimes and commands

Installed fresh runtimes/tools into workspace temporary locations, independent
of prior-session binaries. Local host Debian 13, x86_64; Python **3.11.16**, Node
**20.20.2**, pinned pnpm **10.34.3**, MongoDB **7.0.16**, Playwright **1.58.0**,
Chromium **145.0.7632.6**, actionlint **1.7.7**. Activated PATH points to those
Node/pnpm/Python binaries. `PLAYWRIGHT_BROWSERS_PATH` selects the workspace browser
cache because the environment home cache is read-only. No committed configuration
or frozen dependency lock changes were necessary.

| Exact gate (repository root unless stated) | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile --store-dir /workspace/tools/pnpm-store` | PASS; pnpm 10.34.3, frozen lock unchanged |
| `pnpm build` | PASS; tokens completed before Vite/browser fixtures |
| `pnpm lint:web` | PASS |
| Backend: `ruff check .` | PASS |
| Backend: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pytest -q` | PASS; all required real-MongoDB cases |
| Backend evidence run: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 INBOX_PERFORMANCE_OUTPUT=/workspace/inbox-performance-final.json pytest -q -o addopts= --junitxml=/workspace/phase2-results.xml` | PASS; **135 passed in 23.28s**, zero failures/skips; original 90 + 45 Phase 2 cases |
| `python -m playwright install chromium` (workspace browser cache selected) | PASS; pinned Playwright Chromium downloaded |
| `BROWSER_MONGODB_URI=mongodb://127.0.0.1:27017 python web/tests/run_browser.py` | PASS; **all three suites**, zero page errors |
| `ruff check backend web/tests/run_browser.py web/tests/studio_inbox.py` | PASS |
| `actionlint .github/workflows/ci.yml` | PASS |
| `git diff --check` | PASS |

Baseline gates passed first: original **90** real-MongoDB backend tests plus
entry-page and studio-auth browser suites. Final browser suites retain those
cases and add the inbox integration. Feature verification has **zero skips**.
Real backend fixtures create fresh random `studio_suite_test_*` databases and
remove them after each case; browser fixtures use and remove only
`studio_suite_browser_test`. Provider credentials/replacements remain fixture-only.
No real emails or OpenAI traffic were sent.

## Acceptance evidence

| Acceptance group | Executed evidence |
| --- | --- |
| Every new endpoint rejects absent, expired, revoked, reset, disabled, non-staff identities; supplied roles/actors do not elevate | `test_authorization_every_endpoint` matrix; browser direct routes and save after all five access changes; zero unauthorized reads/writes |
| CSRF/Origin rejection and zero persistence changes | `test_write_verification_zero_changes`; original auth suite retained |
| Empty, defaults/legacy, complete detail, read non-mutation, no-store/projections | `test_legacy_reads_defaults_details_and_empty`; browser empty/filtered-empty and before/after detail Mongo comparison |
| UUID/missing IDs, status/note/revision/page/cursor bounds, unknown/injected fields, private errors/logs | `test_private_validation_and_injected_fields`, `test_list_invalid_bounds`, `test_missing_invalid_ids_and_cursor_schema`, `test_note_boundaries_literal_and_luma_privacy`; browser invalid/missing routes |
| Atomic concurrency, persistence across app/client/staff, UTC actor, archive/reopen | `test_atomic_writers_persistence_archival_and_literal_note`; real second staff browser conflict/reconciliation and persisted actor; zero lost updates |
| Public reference/content/idempotency/pending state/private leakage | `test_public_defaults_retries_preserve_triage_no_leak`; test-only notification capture; `test_note_boundaries_literal_and_luma_privacy`; original Luma/form suite; new public-reference-to-inbox flow; zero private-field leakage |
| Connection and operation failures on list/detail/update; uncertain save; no false success | `test_database_failure_generic_no_false_save`, `test_uncertain_save_retry_recovery`; browser list/detail/save 503 recovery and response lost after real successful PATCH |
| Deterministic bounded pagination, ties, all filters/newer inserts, indexes | `test_10000_pagination_indexes_and_latency`; static exact ID/order traversal for all four filters plus separate newer insert traversal per filter; no unbounded production loads |
| Reload/direct navigation/session cleanup, storage privacy, keyboard/focus, five widths, themes | `studio_inbox.py` plus retained auth/public suites; draft cleared on denial/sign-out, keyboard filter/edit/save, focus reconciliation, light/dark reload, widths 320/390/768/1024/1440 with zero overflow |

Browser success requests always use real login, Argon2id verification, MongoDB
sessions and real inbox handlers. Failure interception returns only errors; the
uncertain-save fixture forwards a real PATCH, then substitutes 503 to simulate a
lost response. The retained draft retries at its old revision and gets 409; Mongo
revision increments once. Backend injected post-write driver failure proves the
same recovery through ASGI handlers. No production bypass or fake successful
browser JSON was added.

## Pagination, indexes and local performance

Dataset: **10,000** initial records, including **2,500** without triage fields;
10 records share each creation timestamp. All/New/In review/Archived static
traversals matched exact expected order/ID sets once each; pages never exceeded
100. Newer inserts after page one were excluded from the ongoing traversal for
each filter without duplicates. Four insert tests leave **10,004** records for
latency measurement. Public app code has only bounded `to_list(length=limit+1)`;
full traversal exists solely in the isolated performance fixture.

[Full explain and latency evidence](2026-10-02-studio-enquiry-inbox-performance.json)
records the actual winning plans and execution statistics. No collection scan
or blocking SORT appeared in the representative first-page/mid-cursor queries.
Unfiltered first/cursor queries use `studio_enquiries_created_id`; filtered first
pages use `studio_enquiries_status_created_id`. New first page merges missing/null
and explicit New index branches. Cursor New may choose the creation index with a
filter; it remains ordered and bounded. The primary `_id_` index serves details
and conditional writes.

| Query (limit+1 = 101) | Returned | Keys examined | Documents examined | Mongo execution ms |
| --- | ---: | ---: | ---: | ---: |

| all | 101 | 101 | 101 | 0 |
| all_cursor | 101 | 101 | 101 | 0 |
| new | 101 | 102 | 101 | 0 |
| new_cursor | 101 | 203 | 203 | 5 |
| in_review | 101 | 101 | 101 | 0 |
| in_review_cursor | 101 | 101 | 101 | 2 |
| archived | 101 | 101 | 101 | 0 |
| archived_cursor | 101 | 101 | 101 | 2 |

Latency method: 30 sequential warm authenticated requests per endpoint through
httpx ASGITransport, real FastAPI/Motor/local MongoDB, measured with perf_counter.
Includes session/identity checks and response serialization; list also includes
idempotent index checks. p95 is nearest-rank sample 29/30. These local measurements
have no production SLA implication and do not include a hosted HTTP network.

| Endpoint | Samples | Median ms | p95 ms |
| --- | ---: | ---: | ---: |
| list | 30 | 3.134 | 5.457 |
| detail | 30 | 2.081 | 2.699 |

## Infrastructure, configuration and limits

**Infrastructure:** CI's browser step name now includes inbox; its existing command
uses the runner that appends `studio_inbox.py` after the retained public/auth
suites. No new services, permissions, runtime versions, deployments or lock changes.
Validated workflow syntax with actionlint. Indexes initialize idempotently on an
authorized list; the app DB account needs existing read/write permissions plus
createIndex on booking_requests. No new env variables or migration are required.
See [operating guide](../docs/studio-enquiry-inbox.md) for setup and recovery.

Main remained `d28337bd529641697444bbfc0ea2551635203406` at pre-publication review;
verified again with `git ls-remote`. Publication uses existing secure GitHub
credentials. Ready-for-review PR targets main; hosted CI results are checked for
the exact published head before final handoff (links provided there).

No deployment, merge, real email, live OpenAI/Resend, production TLS/proxy/CORS or
MongoDB Atlas verification was performed. Local browser verification used the
same-origin development proxy; original HTTPS ASGI cookie/CORS checks were
retained. Driver failure injection and browser failures exercise recovery, not a
physical hosted outage. Chromium only; other engines and assistive technology
were not exercised. These are environment limits, not omitted required local
checks. Later phases remain outside this implementation.
