# Studio Suite resource configuration verification — 2026-10-05

Repository: `devcorp-by-techcorp/studio-suite_v2`.
Branch: `codex/studio-suite-integrated-development`.
Preceding verified application: `4c65efed4525efe8872619323c87271f1815ec6a`.
Preceding browser corrections: `87d19d5554f0038cd6ab477bb6d20d6208bede59`.
Draft PR: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/12.
Resource implementation checkpoint: `48af5ee7693ca0c0b3515cb1cc6ff078d18ce0be`.
Latest inbox fixture correction: `d754bc521360379a76a9ebc6b791599bc77b9caf`.
No merge, deployment, production writes or real customer communication occurred.

## Approved authority and selected task

The user supplied `/mnt/chromeos/removable/SKYNET/srudio-suite/`. All three
version 1.0.0 files were read in full and copied unchanged to
`docs/authority/booking-2026-10-05/`; source hashes are in the
[authority checklist](../docs/development/booking-decision-checklist.md).
Each original file is marked OWNER-APPROVAL CANDIDATE. The user explicitly
replied **“Approve all three as implementation requirements”** to the question
about those exact versions. This supersedes candidate status for implementation;
it does not supply provider credentials or deployment authorization. Empirical
receipt `6ac360d400f9510b562014b0` records the decision with authorType user.

IS-BOOK-AUTH-002 sections 1–2 establish concrete resource instances and integer
capacity, default one. Staff resource configuration was selected as the next
independent workflow. It has no dependency on signed agreements, payment
providers or reservations. The catalog starts empty; no inventory is invented.

## Implemented behavior

Staff catalog/create/revision edits at `/studio/booking-resources` use real
FastAPI/MongoDB persistence. Names/type/capacity/enabled status, UUID identity,
timestamps and revision are explicit. Type and identity are immutable. Bounded
cursor pagination returns all configured types, including disabled definitions.
Names render as literal text. Capacity is a positive safe JSON integer; the
technical `2**53 - 1` bound prevents demonstrated BSON overflow and browser
precision loss, without choosing studio-wide business capacity.

Creation retains its original input/receipt in the transaction. A same-ID retry
returns the original creation result even after edits; changed input with the
same ID returns 409. The browser retains UUID and exact payload after uncertain
delivery, locks those inputs until exact retry succeeds, and refreshes persisted
state. Definitive validation failures allow correction. Revision conflicts require
refresh and explicit selection of the saved definition; uncertain edits are
reconciled rather than repeated automatically. Audit history records actor,
UTC time and before/after values, including disabling; no deletion is added.

Every write transaction fences the current staff identity and browser cookie
session. Origin/CSRF, account enable/role/version, session identity/revocation/
expiry and snapshot-conflict retry validation are preserved. Errors abort both
fences and resource data. Client cookies/grants cannot authorize the API; private
responses are no-store and audit/receipt internals are omitted.

No resource write creates or changes a booking, enquiry, grant, hold or external
provider state. Confirmation remains HTTP 409 with disabled controls. API/UI copy
now correctly says approved scheduling/approval/contract/payment checks await
implementation; it no longer claims the policy has not been defined. Existing
confirmed records remain readable. No confirmation or override permission is
assigned by this increment.

## Verification and diagnostics

- Initial resource backend run: all cases except the database-failure injection
  passed. The test patched one Motor collection object, while later property
  access created another object. Corrected to patch the collection class only
  for the resource collection, following the existing booking regression pattern.
  `/tmp/studio-resource-backend-focused.log`, exit 1; not an application failure.
- Numeric regression before correction: `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests/test_booking_resources.py -k invalid_capacity` rejected ordinary invalid values but `2**64` reached persistence and raised `OverflowError: MongoDB can only handle up to 8-byte ints`. `/tmp/studio-resources-integer-before.log`, exit 1. The final validator rejects it with 422 before fences/writes.
- A superseded full run was deliberately interrupted for that numeric fix and the
  approved-policy message updates: 148 passed before KeyboardInterrupt, exit 2,
  `/tmp/studio-resources-backend-full.log`. It is not a full pass.
- `.venv/bin/ruff check backend web/tests` and `git diff --check` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm lint:web` — passed; `/tmp/studio-resources-lint-final.log`.
- Same PATH, `pnpm build` — passed before browser startup, tokens then Vite;
  JavaScript 347.28 KB / gzip 104.10 KB. `/tmp/studio-resources-build-final.log`.
- `CADDY_BINARY=/home/techcorp2024/studio-suite-tools/caddy .venv/bin/python web/tests/production_server.py` — passed on the final build; `/tmp/studio-resources-caddy-final.log`.
- Initial new browser run passed creation/retry/concurrency then timed out waiting
  on an incorrect test-only client-login URL. `/tmp/studio-resources-browser-focused.log`,
  exit 1. Corrected to the actual `/api/auth/client/login` endpoint. The next run
  exposed an ambiguous status selector matching both the save receipt and list
  loading; `/tmp/studio-resources-browser-focused-corrected.log`, exit 1. Assertions
  now target the exact save text and wait for response/render completion. No
  timeout or authorization assertion was weakened.
- Final focused browser: `BROWSER_SUITES=booking_resources.py BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/python web/tests/run_browser.py` — passed, exit 0. Real persistence, lost-response exact retry, input-validation correction, concurrent-tab CAS rejection/recovery, disable, real client denial, real staff authorization loss/private UI clearing, literal names and four widths; `/tmp/studio-resources-browser-final-focused.log`.
- The first final backend attempt on 27027 reached the end of all new resource cases, then fixture access/cleanup began failing after the Mongo process disappeared. It was interrupted to prevent continuing against an unavailable service; cleanup still failed, exit 1, `/tmp/studio-resources-backend-final.log`. It is not a full pass.
- Aggregate on 27027 also failed during inbox, including browser closure and connection-refused cleanup. `/tmp/studio-resources-browser-aggregate.log`, exit 1. This is distinct from successful hosted coverage.
- A separate local replica set `resources` was created on 27028, with a new data directory, 64 MB oplog and 0.25 GB WiredTiger cache. Init uses `directConnection=true` before replica-set primary selection; an initial pre-init non-direct connection could not select a primary and was corrected before tests. Live hello and isolated write/read/drop proved readiness. The original 27027 data/logs remain untouched. This isolation and bound do not establish the prior process-exit cause.
- Full independent backend: `TEST_MONGODB_URI='mongodb://127.0.0.1:27028/?replicaSet=resources' .venv/bin/pytest -q -o addopts= backend/tests` — **381 passed**, one existing python_multipart deprecation warning, exit 0, 831.93s. `/tmp/studio-resources-isolated-backend.log`; includes all 23 new resource cases and all prior 358.
- Initial independent aggregate passed entry/auth then failed inbox receipt UI assertion while the actual public submission was still sending. Mongo remained alive and writable. `/tmp/studio-resources-isolated-browser.log`, exit 1. The test now waits for and verifies real `POST /api/bookings` status 201 before checking the reference and persistence; no timeout was increased.
- Corrected independent aggregate: same Node PATH, `BROWSER_MONGODB_URI='mongodb://127.0.0.1:27028/?replicaSet=resources' .venv/bin/python web/tests/run_browser.py`; `/tmp/studio-resources-isolated-browser-final.log`. The runner includes fourteen suites. Entry/auth passed; inbox failed at its denied-session reload URL assertion, exit 1. This is not an aggregate pass.

The final bounded inbox diagnostic used the same Node PATH, with
`BROWSER_SUITES=studio_inbox.py BROWSER_MONGODB_URI='mongodb://127.0.0.1:27028/?replicaSet=resources' .venv/bin/python web/tests/run_browser.py`.
It failed with **Page crashed** while reloading the disabled-account case;
`/tmp/studio-resources-inbox-focused-diagnostic.log`, exit 1. Captured diagnostics
showed the page was not closed and browser remained connected. Cleanup then
failed with connection refused. The fixture now awaits the actual denied session
response and emits bounded API path/status diagnostics without cookies or bodies.
No timeout or authorization assertion was weakened. This focused run did not pass.

At 09:45:28 UTC the independent Mongo log recorded journal write error 28,
**No space left on device**, followed by WT_PANIC and fatal assertion 50853.
This establishes the cause of the latest 27028 exit, not the earlier 27027 exits
or the browser crash. Subsequent filesystem inspection showed 587 MB available
on the 27 GB volume (98% used); that later snapshot does not negate the recorded
write failure. Original data/logs remain preserved. No further local reruns were
attempted: disk capacity must be established before restarting an isolated replica
set, followed by writable-primary and write/read/drop checks. Local aggregate
verification remains incomplete. No watched application edits or token rebuilds
occurred during these browser runs.

Mobile sources unchanged; mobile checks/exports not rerun. Native authentication
still requires actual device/emulator verification. Docker is unavailable locally;
hosted production-image evidence is separate from local Caddy routing.

## Remaining implementation and dependencies

Next concrete task: approved Melbourne local-time/DST interval preparation and
explicit package/resource assignment, then occupied-buffer/travel calculations,
active holds, capacity fencing and simultaneous-confirmation/reschedule tests.
Legacy date-only confirmed records cannot acquire inferred intervals/resources;
legacy direct confirmed-date edits are not the approved reschedule workflow.
Replace them with preserved-original pending requests before calling rescheduling
policy-complete. Actual package durations/resource needs, locations/route estimates,
confirmed-record migration decisions and confirmation permission assignments must
be explicit. The current staff role is not implicitly owner/admin.

Final confirmation still requires immutable reviewed-summary acceptance, human
approval, actual version-linked agreement/consent evidence and verified cleared
required payments/instalments. Provider credentials and signed agreement/SOW
sources remain unavailable; no fake provider result is treated as success.
Other dependencies remain private R2/Worker delivery/derivative requirements,
retention policy, notification sandbox, client-recovery provider/browser delivery,
and native secure credentials/device authentication. Recovery stays unregistered
and default-disabled. Enquiries/chats/invitations/proposals reserve nothing.

Concurrent unrelated `design-system/` deletions/new assets are preserved and
excluded from all development commits. No restore/delete/broad staging occurred.

## Hosted evidence and Empirical receipts

At `48af5ee`, PR run [37286142437](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37286142437)
and push run [37286138576](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37286138576)
passed backend, web and production-image/routing jobs. Direct PR log readback
explicitly confirms `All 14 browser suites passed` and the resource journey.
These are full hosted runs, separate from the failed local attempts. The final records tip is resolved with `git rev-parse HEAD`; its hosted runs must
be read back before handoff, independently of these application-checkpoint runs.

Verified Empirical creation receipts: `6ac3701900f9510b5620193e` (completed
resource unit with full local backend and hosted evidence),
`6ac3732700f9510b56201a88` (latest journal disk-exhaustion diagnosis; corrected session/Git metadata read back),
`6ac3702000f9510b5620199e` (completed invitation reload unit),
`6ac360d400f9510b562014b0` (user-authored approval),
`6ac322aa00f9510b56200c5a` (booking authorization/earlier diagnosis) and
`6ac2eedf00f9510b561ffcea` (inbox fixture restoration).
Completed-work payloads use authorType agent, work-history tag, mass 1 and
verified Codex session/transcript/Git metadata; creation receipts were read back.
