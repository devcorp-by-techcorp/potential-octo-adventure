# 2026-10-04 — Booking planning and edit recovery

## Scope and baseline

Fresh, clean clone of `main` at `0f27e05bfda930d8da6865393d7e5dad9a65859a` from
`devcorp-by-techcorp/studio-suite_v2`. Fetched main again before integration;
the remote baseline remained unchanged. No applicable AGENTS.md was present.
Followed README, booking operations, the goal ledger, prior reports and the CI
runner. This run covers one feature set: reliable booking planning and staff edit
recovery.

## Behaviour and review

- Real calendar-date validation rejects impossible dates and explicit nulls before
  creation/update. Omitted fields retain existing values; empty optional details
  can be cleared. Dates remain strings and staff can correct historical records.
- The editor retains drafts after conflicts, outages and uncertain save responses.
  Staff review saved details/stage/revision and explicitly retain their draft or
  adopt saved details before resolving a stale revision. Keeping a draft requires
  a separate revision-checked save.
- Unsaved detail edits block lifecycle actions until saved or discarded. Writes
  disable inputs, announce success only after a successful response, abort on
  unmount and clear private content on authorization failure.
- List/detail recovery controls, missing/invalid-link states, keyboard focus and
  semantic input styling complete the planning editor workflow.
- History reads label timestamps as UTC, avoiding local-time interpretation of
  timezone-free MongoDB datetimes. Rescheduling preserves the original enquiry.
- The existing browser runner now includes a real public-enquiry-to-booking journey
  and two-staff conflict/lost-response recovery. CI picks it up through that runner.

Reviewed the diff for revision races, state transitions, date integrity, request
cleanup, private projections and scope. Tests exercise real handlers and MongoDB;
browser interception supplies failures or hides the response after a real write.

## Local verification

Runtimes: Node 24.19.0, pinned pnpm 10.34.3, Python 3.12.14, MongoDB 7.0.16
single-node replica set `phase3`, Playwright 1.58.0 and Chromium 145.0.7632.6.
CI retains its existing Node 22/Python 3.11 configuration.

| Gate | Result |
| --- | --- |
| Pinned pnpm frozen-lockfile install | Passed; lockfile unchanged |
| `pnpm build` | Passed; tokens followed by production Vite build |
| `pnpm lint:web` | Passed |
| `pnpm check:design` | Passed; token mirrors match, 25 runtime variables resolve |
| Backend `ruff check .` and changed browser Python files | Passed |
| Backend `TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' pytest -q` | Passed; all 259 tests |
| `BROWSER_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=phase3' python web/tests/run_browser.py` | Passed; all five suites, zero page errors or overflow |
| Production web container build and `python web/tests/production_server.py --image studio-suite-web:booking-test` | Passed with local certificate accommodation below |
| `git diff --check` | Passed |

The backend suite includes idempotent creation, concurrent metadata writers,
explicit retry after conflict, valid leap-day rescheduling, invalid/null rejection
without mutation, enquiry immutability, cancellation/reopening/delivery, Origin
and CSRF enforcement, and grant-derived client date/stage projection with private
notes excluded and revocation enforced.

## Environment accommodations

The environment's initial pnpm executable was version 11; installed the repository's
pinned version in workspace tooling and restored the workspace file it changed.
The direct Docker build encountered `SELF_SIGNED_CERT_IN_CHAIN` behind the local
proxy. A temporary Dockerfile adds the host's trusted CA bundle and sets
`NODE_EXTRA_CA_CERTS` in the build stage. The final Caddy stage and application
sources are unchanged by that accommodation; certificate verification stays on.
No certificate/configuration workaround is committed.

An early browser assertion matched both the draft textarea and saved note; scoped
it to the reconciliation panel. A subsequent run was interrupted by rebuilding
tokens while Vite was serving them. The final browser run holds the generated
files steady. Final results are recorded above.

Visually reviewed the 390px saved-version review in both themes. Inputs, history
and reconciliation controls fit the viewport; the suite checks 320, 390, 768,
1024 and 1440px. Archived evidence: [light](assets/booking-recovery-mobile-light.png)
and [dark](assets/booking-recovery-mobile-dark.png).

## Hosted integration follow-up

Initial hosted run [37194601599](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37194601599)
passed backend and production image/routing gates. Faster browser execution
exhausted the shared public enquiry budget before the new booking suite, returning
HTTP 429 on its public submission. The runner now starts a fresh test backend
(and disposable test database) for the independent booking suite, resetting its
process-local budgets without altering production rate limits. The whole browser
runner passed all five suites again after this isolation change, with zero page
errors or overflow.
