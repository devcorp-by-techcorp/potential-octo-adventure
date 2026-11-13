# Phase 3 requirements-to-tests plan (recorded before implementation)

Baseline: fresh clone initially e50717002c05b41fd7a78a1126cc7c8d10fe1554;
fetched main and feature start 80fd4d309a621f0628e9426d5819b459e6258490.
Clean checkout, no user changes, no applicable AGENTS.md found. Git ancestry
verified Phase 2 reviewed feature bb0903c, Phase 1 merge d28337b; remaining
retained feature/public ancestors will also be recorded in the final report.

| Requirement | Planned evidence |
| --- | --- |
| Staff-only issue/status/revoke; CSRF/Origin, derived contact, replacement | Real-handler denial/write matrix and lifecycle tests; real staff browser UI |
| Hash-only tokens, 24h expiry, single use, no obsolete links | Mongo inspection, expired/revoked tests, concurrent issue/accept/revoke |
| Atomic identity/invitation/grant/session, rollback and uncertain response | Real MongoDB 7.0.16 replica-set transaction/concurrency/failure tests |
| Existing account matching authentication, no credential overwrite | Second invitation tests, wrong-client denial, persisted hash comparison |
| Separate client session scope; enabled/version/expiry/revocation and recovery | Client handler matrix, operator reset/disable, staff/client cookie swaps |
| Explicit per-enquiry grant, projections, no booking/triage/public changes | Two-client isolation; malicious fields; existing 135 cases retained |
| Bounded shared throttling, sanitized errors, DB failures | Limits and operation failure matrix; no private error/log assertions |
| Bounded keyset lists and lookup indexes | Multi-page traversal, explain/latency evidence; retained 10,000 inbox traversal |
| Fragment scrubbing, memory-only data, state cleanup, stale requests | Real client browser flow, URL/storage checks, denial/sign-out/reload |
| Invalid/expired/revoked/used invites, existing client, service recovery | Backend and browser state matrix; only failed responses intercepted |
| Keyboard/focus, themes and 320/390/768/1024/1440px | Fourth browser suite plus all three existing suites; page errors/overflow |
| Integration/infrastructure/docs/publication | All required gates, actionlint, final diff review and exact-head PR CI |

Transactions require an isolated replica set for both backend and browser gates.
No real providers, email, deployment, booking confirmation or later features.

## Executed integration verification

Main `2c09477761d84555ad8f06a3f9b4b8ba50d87394` merged normally into the existing
Phase 3 branch with merge `1ba0e9af054e693a007dc33b6f1004ef795bf54d`. One loaded
wait and the heading-focus/keyboard checks are retained. Final gates execute
239 backend cases (135 retained + 104 Phase 3), zero skips, and all four browser
suites. Added coverage includes retained-cookie recovery, explicit response-model
exclusion, real unique/compound/TTL indexes, completed-recovery denials, durable
access after replacement revocation, and bounded history with concurrent issuance.
Fresh query/performance evidence and the full requirements-to-executed-tests
mapping are in the [integration report](../test_reports/2026-10-02-client-invitations-report.md).
