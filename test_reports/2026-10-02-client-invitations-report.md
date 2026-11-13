# 2026-10-02 — Phase 3 integration and executed verification

This report supersedes the original verification report at feature head
`959c9631730211da40c810d6cb911941d11dbc24`. Earlier measurements are historical
references, not results from this integration run. PR: [#6](https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/6).

## Live baseline, safety and normal merge

Fresh GitHub queries and fetch verified main at
`2c09477761d84555ad8f06a3f9b4b8ba50d87394`, existing feature head at
`959c9631730211da40c810d6cb911941d11dbc24`, and the separate default branch
`claude/illuminate-gallery-rebuild-deploy-dy6bie` at PR #5 merge
`27d71e49fe65be433153a203bbb8b5e29ce8055e`. PR #6 was open, targeted main,
and was conflicting. Only PR #6 was open. The fresh feature clone was clean;
there were no existing user changes or applicable AGENTS.md files.

README, entry/auth/inbox/client guides, requirements plan, prior reports and JSON,
content policies, handlers, UI, tests, fixture setup, dependency manifests/lock,
environment examples and CI were reviewed. Existing security primitives,
tokens/design system, typed settings, abortable requests and bounded queries remain.

Normal merge `1ba0e9af054e693a007dc33b6f1004ef795bf54d` has both the original
feature head and current main as parents. Its only conflict was in
`web/tests/studio_inbox.py`: retain one actual loaded-status wait, the main/PR #5
explanatory comments and heading-focus assertion, and all keyboard assertions.
No sleeps or weakened assertions were introduced. A subsequent browser run exposed
another existing pagination timing race: cursor controls render before the next
row arrives. The test now polls for the changed row href and asserts restored
heading focus. The complete combined diff was inspected; no other conflict exists.

GitHub reported main unprotected, no required status contexts, no requested reviews
and no existing reviews. The ruleset API returned the repository-plan restriction
(403); the branch API explicitly reported protection disabled. Protection/review
state must be rechecked before merge. No administrator bypass, force-push,
branch retargeting, default-branch change or additional integration branch is used.
The default branch requires separate synchronization if repository policy calls
for it; this task integrates only into main.

## Concrete fixes and security review

The new recovery regression covers a committed acceptance whose real Set-Cookie
header reaches the browser while its body is lost. Previously memory held no
session/CSRF, so recovery could send an authenticated request without CSRF and
remain stuck. The acceptance page now rechecks the real current session after an
uncertain response and restores identity/CSRF in memory before recovery. It does
not navigate to private data or announce successful acceptance from the failed
operation. Both lost-cookie/password recovery and retained-cookie/session recovery
use real successful API/MongoDB handlers; only failed responses are intercepted.

Invitation issue/history/revoke/inspect/accept and client login/session now have
explicit allowlisted response models, complementing existing database projections
and client enquiry models. A test contaminates internal serialization helpers with
private fields/raw tokens and verifies the public responses exclude them. Only the
successful issuance response includes the one-time link.

Additional real-MongoDB coverage verifies all intended unique, compound and TTL
indexes and rejects duplicate identity/grant/token records; checks exact bounded
61-item invitation-history traversal with a concurrent new issue; denies completed
recovery after expiry, password reset, disable or grant removal without new sessions;
and proves revoking a pending replacement preserves accepted access. Query-plan
checks now explicitly reject blocking SORT as well as COLLSCAN.

Review verified server-derived recipients; hash-only random secrets; expiry separate
from TTL; replacement/accept/revoke serialization; snapshot/majority acceptance
transactions; reset/disable/logout fences; existing-password preservation; committed
outcome recovery; per-request role/scope/version/enabled/expiry/revocation checks;
Origin/CSRF/no-store; independent throttling budgets; explicit grants and customer
field allowlists; bounded queries/cursors/indexes; stale-request/private-state
clearing; text-only content; dates/UTC; manual delivery and pending booking state.
No provider replacement, failure injection or test identity entered production code.

## Runtimes, infrastructure and exact final gates

Fresh Python 3.11 virtual environment installed all declared backend development
dependencies. Actual runtimes: Python **3.11.16**, Node **20.20.2**, pnpm
**10.34.3**, MongoDB **7.0.16**, Playwright **1.58.0**, its Chromium
**145.0.7632.6**, Motor 3.3.1, PyMongo 4.5.0, Argon2-cffi 25.1.0, pytest 9.1.1,
Ruff 0.16.10, actionlint 1.7.7, FastAPI 0.110.1, Pydantic 2.13.5 and
pydantic-settings 2.15.0. Tools/caches are under `/workspace/phase3-tools` and
`/workspace/phase3-cache`; no machine-generated configuration or lockfile change.
pnpm reported ignored dependency build scripts; the required build passed without
changing repository configuration.

Inspected `backend/tests/start_mongodb.sh`: fixed container `studio-suite-ci-mongo`
and host port 27017, pinned mongo:7.0.16. Local verification instead used the pinned
MongoDB binary with a fresh session-owned data directory:

```bash
/workspace/phase3-tools/mongodb-linux-x86_64-ubuntu2204-7.0.16/bin/mongod \
  --dbpath /workspace/phase3-tools/mongo-data --bind_ip 127.0.0.1 --port 27017 \
  --replSet phase3 --logpath /workspace/phase3-tools/mongo.log --fork
```

Initialized via PyMongo `replSetInitiate` with one member advertising
`127.0.0.1:27017`; verified `isWritablePrimary` and replica set `phase3` before tests.
No pre-existing MongoDB/container was reused or removed. A first sandboxed startup
could not bind its socket; the same dedicated setup succeeded with network access.
Backend fixtures own random `studio_suite_test_*` databases; browser fixtures own
only `studio_suite_browser_test`. No production database/provider was contacted.

The combined baseline passed **231 backend cases in 96.82s**, no skips, and all
four browser suites. Final verification ran after the last relevant code change:

| Command (repository root unless indicated) | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS, pnpm 10.34.3, unchanged lock |
| `pnpm build` | PASS, shared tokens then web, before browser fixtures |
| `pnpm lint:web` | PASS |
| `python -m playwright install chromium` | PASS, pinned browser in writable workspace cache |
| backend: `ruff check .` | PASS |
| backend: `TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' CLIENT_PERFORMANCE_OUTPUT=/workspace/phase3-client-performance.json INBOX_PERFORMANCE_OUTPUT=/workspace/phase3-inbox-performance.json pytest -q -o addopts= --junitxml=/workspace/phase3-results.xml` | **239 passed in 84.17s; zero failures, errors, skips** |
| `BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' python web/tests/run_browser.py` | **All four suites passed**, zero uncaught errors/overflow |
| `ruff check backend web/tests/client_invitations.py web/tests/studio_inbox.py web/tests/run_browser.py` | PASS |
| `actionlint .github/workflows/ci.yml` | PASS |
| `git diff --check` | PASS |

Final JUnit records 239 tests, errors=0, failures=0, skipped=0. The original 135
backend cases remain and Phase 3 now has **104 cases** (96 original + 8 added).
All four suites exercise real authentication/private-data/acceptance handlers:
public entry, staff authentication, staff inbox and client invitations. Required
keyboard/focus checks, both themes and 320/390/768/1024/1440 widths pass.
The first expanded browser trial consumed the combined public enquiry rate budget;
the extra recovery record now belongs to the test fixture, preserving the public
limiter. Another trial exposed the pagination race described above. Both were
resolved before the passing final gates; no failing intermediate run is a pass.

## Requirements-to-executed-tests mapping

| Requirement group | Actual evidence |
| --- | --- |
| Staff-only issue/status/revoke, absent/expired/revoked/reset/disabled/role denial; CSRF/Origin and zero writes | `test_staff_denial_all_invitation_operations`, `test_staff_write_verification_no_writes`; real staff browser login/panel |
| Server-derived contact, normalized identity, explicit enquiry grant, no arbitrary roles/emails/owners/IDs | `test_lifecycle_hashes_privacy_persistence_and_scope`, `test_injected_input_is_private_and_cannot_grant`, `test_two_clients_explicit_enquiry_isolation_and_no_email_auto_grant`; wrong-account/ID browser tests |
| Hash-only 256-bit secrets, 24h default/validated bounds, pending/accepted/revoked/expired status, obsolete links | Lifecycle, `test_unusable_invites_zero_grants`, `test_invitation_lifetime_validated`, `test_atomic_lifecycle_races`; real copy/replacement/revoke/expiry/used/invalid browser UI |
| Argon2id enrollment; matching existing-client authentication; no password overwrite | Lifecycle, `test_existing_matching_account_never_overwrites_password`, distinct-invitation race; browser second invitation and persisted hash comparison |
| Exactly one completed acceptance/account/grant, transactional rollback and atomic race outcome | `test_concurrent_single_acceptance_and_no_duplicate_accounts_grants`, `test_concurrent_distinct_invitations_one_normalized_identity`, `test_each_durable_acceptance_failure_rolls_back`; parallel issue/accept/revoke/replacement tests |
| Acceptance cannot follow committed revocation/replacement; reset/disable/logout racing acceptance | Controlled snapshot barriers in `test_revocation_committed_before_acceptance_transition` and `test_operator_or_logout_committed_during_existing_acceptance` |
| Uncertain committed response; secure existing/new recovery; no success before durable completion | `test_transaction_rollback_and_uncertain_response_recovery`, `test_existing_acceptance_recovery_and_repeated_grant`, `test_recovery_pending_never_enrolls_or_claims_completed`; browser forwards real successful POST then loses response and recovers once |
| Durable access across reload/new browser/app/Motor instance, repeatable setup/no rewrite | Lifecycle; `test_fresh_motor_instance_and_repeatable_indexes_preserve_records`; browser reload and independently signed-in context |
| Current client identity/scope/version/enabled/revocation/expiry on every API; role separation | `test_current_client_authorization_every_request`, cookie-swap checks, production-cookie/CORS test; browser client/staff endpoint denial and expiry/revoke/reset/disable |
| Trusted Origin for login/enrollment, CSRF for authenticated writes, shared bounded throttling | `test_client_origin_denial_zero_writes`, login/logout/recovery tests, `test_shared_ip_bound_before_password_hash_and_email_key_growth`; missing CSRF tests; 20-IP/5-email budgets and window recovery |
| Client reset/disable, no credential arguments/piped input/public signup | Real PTY CLI reset/disable persistence test, `test_operator_no_password_arguments_or_piped_input`, registration 404, current-session invalidation tests |
| Explicit projections/no private studio or future fields, no-store/private validation | Lifecycle/projection tests; all operation failure/denial assertions; malformed/unknown/Mongo-operator/Unicode input tests and cursor/history bounds; browser text/privacy assertions |
| Database failure for every new handler and required durable acceptance write | `test_database_failures_sanitized_and_fail_closed` covers connection/operation failures for issue/status/revoke/inspect/accept/login/session/logout/list/detail; rollback at identity/invitation/grant/session writes |
| Bounded stable keyset pagination/ties, unique/compound/TTL indexes and performance | Exact 1,000-record traversal/order, first/cursor/token/grant explains and 30-request latency samples; original 10,000-enquiry traversal/index case retained |
| Fragment scrubbing before requests/forms, fragment-only changes, memory-only state/storage/log privacy | Fourth browser suite checks removed fragments, used/missing secrets, GET/request URLs, console, browser stores, hash-only Mongo persistence |
| Loading/ready/validation/invalid/expired/revoked/used/missing/failure recovery, identity switching and state cleanup | All four browser suites; actual invalid login and service failures; existing-account form; missing/inaccessible details; session restore failure; same-context client switching; delayed real private response after sign-out |
| Keyboard/focus, semantic controls, text rendering, dates/UTC, both themes and five widths | Fourth browser suite plus originals; copy/input focus, keyboard accept, sign-in error focus, heading focus, literal markup text, preferred date/UTC, light/dark reload and 320/390/768/1024/1440px |
| Public enquiry/retry/Luma/notification/staff triage preservation; pending state | All original 135 cases and three browser suites; original record equality before/after invitation/acceptance; identical receipt reference and pending-state assertions |

| Added integration requirement | Executed evidence |
| --- | --- |
| Retained-cookie uncertain response restores verified session/CSRF, no false success or duplicate grant | `web/tests/client_invitations.py` retained-cookie scenario; real acceptance then failed response; successful explicit recovery and exact identity/grant counts |
| Models exclude internal helper fields and raw session token | `test_private_response_models_exclude_internal_helper_fields` |
| Unique/compound/TTL index options and database-enforced uniqueness | `test_client_unique_compound_and_ttl_indexes` |
| Expired/missing-grant/reset/disabled completed recovery denies without new session | `test_completed_enrollment_recovery_fails_closed` (4 cases) |
| Pending replacement revocation retains existing accepted access | `test_pending_replacement_revocation_preserves_accepted_access` |
| Exact bounded invitation history/order under new insertion | `test_invitation_history_traversal_with_concurrent_new_issue` |
| PR #5 readiness/focus and next-page readiness without weaker keyboard coverage | `web/tests/studio_inbox.py`, all final browser suites |

Observed metrics are zero unauthorized cross-client/cross-role reads/writes,
private-field/secret leakage, duplicate completed acceptances/identities/grants,
acceptance after committed revocation/enforced expiry, password overwrites,
partially committed acceptance transactions and false success announcements in
the executed adversarial/concurrency/failure cases.

## Fresh pagination, query plans and performance

[Client full-suite evidence](2026-10-02-client-invitations-performance.json) contains
fresh token/grant/first-page/cursor/history explain plans and 30 warm authenticated
ASGI samples per endpoint on **1,000 explicitly granted enquiries**. Exact ordered
IDs match all grants, without duplicates/missing records; pages never exceed 100.
Production grant lookahead is at most 101, customer lookup at most 100, history
lookahead at most 26. History additionally traverses 61 records with 25-item pages
and a concurrent new issue. Only fixture code materializes expected test sets.

| Query | Winning index | Returned | Keys / documents examined |
| --- | --- | ---: | ---: |
| Invitation token | token_hash_1 (unique) | 1 | 1 / 1 |
| Explicit grant | client_id_1_enquiry_id_1 (unique) | 1 | 1 / 1 |
| First client page | client_access_page | 101 | 101 / 101 |
| Client cursor page | client_access_page | 101 | 201 / 201 |
| Invitation history | enquiry_id_1_generation_-1 (unique) | 1 | 1 / 1 |

Every covered winning plan uses IXSCAN, no COLLSCAN or blocking SORT. The history
plan uses the one issued item in the performance fixture; the separate traversal
case covers a larger history. Index options and uniqueness are asserted against
real MongoDB, including cleanup/expiry TTL values of zero.

[Fresh retained inbox evidence](2026-10-02-phase-3-retained-inbox-performance.json)
preserves the 10,000-enquiry traversal, 2,500 legacy records, timestamp ties, every
filter and concurrent insertions; its latency dataset contains 10,004 records.
Exact static order/ID-set checks and all covered indexed plans pass.

Method: 30 warm sequential authenticated httpx ASGI handler requests per endpoint,
local FastAPI/Motor/real replica set, perf_counter elapsed including authorization,
lookups and serialization, default 25-item list. Nearest-rank p95 is sample 29/30.
Actual runtimes are embedded in both JSON artifacts. No hosted HTTP latency or
production SLA is inferred.

| Measurement | List median / p95 ms | Detail median / p95 ms |
| --- | ---: | ---: |
| Earlier Phase 3 reference (historical) | 8.586 / 10.840 | 2.671 / 3.305 |
| Fresh final full suite | 7.881 / 8.648 | 2.726 / 6.966 |
| Fresh isolated comparison | 7.585 / 9.322 | 2.523 / 2.984 |
| Fresh retained inbox | 3.725 / 5.140 | 1.978 / 2.347 |

The full-suite client detail p95 increased while its median remained close to the
reference. This prompted an isolated rerun of `test_keyset_indexes_and_local_latency`
against a fresh equivalent 1,000-grant fixture on the same runtime/code, exporting
[comparison evidence](2026-10-02-client-invitations-performance-comparison.json).
That test passed (1 passed, 103 deselected); detail p95 returned below the earlier
reference and the indexed plans/bounded reads were unchanged. The higher tail was
not reproduced in that comparable run; its cause is not established. Both fresh
measurements are retained, without cherry-picking, a portable latency gate or a
claim about production performance.

## Operating changes, publication and verification limits

Phase 3 adds `CLIENT_INVITATION_SECONDS` only, default 86400 and range 60–604800;
`AUTH_SESSION_SECONDS` remains 28800/range 60–604800. Production requires
transaction-capable MongoDB, correct collection/index/write permissions, TLS,
trusted exact origins and the existing same-site cookie configuration. CI uses
isolated pinned single-member replica sets in both jobs. No additional dependency,
deployment manifest or lockfile change was needed for integration fixes.

The [operating guide](../docs/client-invitations.md) covers manual delivery,
replacement/revocation, durable grants, new/existing identities, scoped sessions,
operator reset/disable, private logging/storage boundaries, atomic rollback,
uncertain acceptance and retained-cookie recovery, database requirements/indexes
and exact gates. The requirements plan gains the executed integration mapping.
Publication, final-head/integration CI and merge verification belong to existing
PR #6 and the final delivery/handoff; old passing CI is not used for the new code.

No production deployment, provider traffic, production database/index changes,
Atlas/proxy/hosting/TLS verification occurred. Chromium used local same-origin
hosting; HTTPS cookie/CORS behavior used ASGI tests, not an external TLS server.
Other browser engines and assistive technology remain untested. Transaction and
outage cases use real local MongoDB plus controlled fixture failure/barriers,
not a physical production outage. Booking confirmation, availability reservation,
editing, scheduling, media/R2/uploads, contracts, payments, exports, deletion,
bulk invitations, public signup and email delivery remain excluded.
