# Studio Suite booking authorization verification — 2026-10-05

Repository: `devcorp-by-techcorp/studio-suite_v2`.
Branch: `codex/studio-suite-integrated-development`.
Starting checkpoint: `d1b7c3d52c8d50b071a860dcc0bbd25618d02e93`.
Inbox race fix: `c48acc555f7fc49943d8187c9378c826d379ab42`.
Invitation reload fix: `bfe9008bbbe9a449379de8f43c659cf87bf3e436`.
Application increment: `4c65efed4525efe8872619323c87271f1815ec6a`.
Draft PR: https://github.com/devcorp-by-techcorp/studio-suite_v2/pull/12.
Backend full verification passed. Failed local aggregates, corrected six-suite
remainder and successful hosted all-suite evidence are recorded below.
No merge, deployment, production writes or customer communications occurred.

## Source and task selection

Live GitHub default remains `claude/illuminate-gallery-rebuild-deploy-dy6bie`
at `aa50bd25a8898c2cbc437be2e6cf275b54636fb2`. Initial local/remote/PR heads
all matched `d1b7c3d`; PR #12 was open and draft, and all six checkpoint checks
were successful. Applicable instructions and all four development records plus
the newest session-security report were read. Empirical recent work-history,
scar-tissue and open follow-ups were queried; the latter returned no open entries.
The filesystem memory registry had no Studio Suite match.

The next independent product task was a demonstrated authorization gap in
existing operational booking writes. `docs/booking-operations.md` and the existing
staff cookie/Origin/CSRF contracts establish this workflow; no new scheduling or
commercial rule is needed. A real replica-set regression disabled the account
after actual dependency validation, then POST still returned 200 and persisted a
planning booking. `/tmp/studio-booking-auth-before.log` records that expected
regression failure (exit 1). Existing enquiry conversion and revision contracts
are preserved rather than reimplemented.

Creation, metadata edits and stage changes now write-fence the enabled staff
identity/version and authorizing browser session inside the same transaction as
the booking. Session ID, identity ID, version, revocation and expiry must still
match. Snapshot conflicts retry against current authorization; denial/failure
aborts the booking and fence writes. Unique enquiry conversion, revision conflicts,
lost-response reconciliation and append-only transition history retain their
existing contracts. Creation timestamps use MongoDB millisecond precision so
concurrent/retried responses agree with persistent reads. Confirmation stays 409.

## Local browser diagnosis

MongoDB was already healthy: `hello` returned replica set `phase3`,
`isWritablePrimary=true`, primary `127.0.0.1:27027`; `serverInfo` returned 7.0.16.
The continuation log had no current FTDC fatal/write failure. No restart, repair
or data-directory deletion was performed. The earlier FTDC root cause remains
unconfirmed.

The inherited local inbox failure occurred at the next sign-in after a denied
read. The `/studio` redirect starts another session-restoration request; the test
restored enabled/role before that request finished, allowing the old cookie to
reauthenticate and redirect home before cookies were cleared. The test now waits
for the actual sign-in form before restoring fixture identity. Its real denied
PATCH, unchanged-persistence and private-content assertions are preserved.
Local entry, authentication and inbox then passed. That baseline aggregate was
intentionally interrupted while invitations ran so the demonstrated application
fix could be applied with no active watched application changes; exit 130,
`/tmp/studio-browser-20261005-continuation.log`. The initial full backend run was
also deliberately interrupted for the new fix (exit 2); neither is a full pass.

The new booking browser journey waits for the real login response, then tests
revocation, disable, role change, password-version reset and expiry during actual
browser save dispatch. It continues each request to the real application, verifies
401/403 and unchanged booking/enquiry records, and verifies private UI clearing.
No successful or denied application response is fabricated. Fixture restoration
waits for sign-in before re-enabling the account, avoiding the same race.

## Executed checks

All application tests use isolated test databases on the loopback replica set.
Provider settings are fake/disabled. Build completed before browser startup.
No watched application files are edited during the final aggregate.

- `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests/test_booking_authorization.py backend/tests/test_bookings.py` — 27 passed (initial ten authorization cases plus seventeen existing booking cases), exit 0; `/tmp/studio-booking-auth-after.log`.
- `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/pytest -q backend/tests/test_booking_authorization.py` — 16 passed, exit 0; `/tmp/studio-booking-auth-final.log`. Includes dependency invalidation, snapshot-conflict retry rejection and exact fence rollback on database errors. A subsequently added distinct-staff concurrency case is included in final full verification.
- `.venv/bin/ruff check backend web/tests` and `git diff --check` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm lint:web` — passed.
- `PATH=/home/techcorp2024/.nvm/versions/node/v22.22.1/bin:$PATH pnpm build` — passed, tokens then Vite; JS 342.49 KB / gzip 102.94 KB. No frontend application source changes in this increment.
- `CADDY_BINARY=/home/techcorp2024/studio-suite-tools/caddy .venv/bin/python web/tests/production_server.py` — passed, exit 0; temporary loopback SPA/asset/cookie/Origin/CSRF/upstream-error routing checks.
- Full backend: `TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' nice -n 10 .venv/bin/pytest -q -o addopts= backend/tests` — **358 passed**, one existing `python_multipart` deprecation warning, exit 0, 1720.74s; `/tmp/studio-backend-20261005-booking-fence.log`.
- The first final-tree aggregate
  passed entry/auth/inbox, then failed in `client_invitations.py:95` reading a
  captured response body (Chromium Network.getResponseBody: no data found).
  `/tmp/studio-browser-20261005-booking-fence.log`, exit 1. Issuing already starts
  an automatic list reload; the test immediately triggered a second refresh
  that could abort the captured first response. The helper now waits for the
  existing reload to render instead of refreshing twice, and an explicit refresh
  waits for prior loading to finish. The focused invitation suite then passed.
  That two-suite run failed at the first booking save: the old five-second UI-only
  wait still showed the unsaved-change status before the API result was
  captured. `/tmp/studio-browser-20261005-invitations-bookings.log`, exit 1.
  Booking success, keyboard-save and lifecycle assertions now await and check
  actual PATCH responses before rendered status; no timeout was raised.
  Focused booking then passed, with unchanged persisted records/private UI
  clearing, but later review caught that Playwright supplies a second handler
  argument that overwrote the default denial-mode parameter: that run tested
  revocation under all five labels, not five distinct modes. The callback now
  uses a factory returning a one-argument handler and asserts the actual saved
  account/session invalidation for each mode. The final aggregate loads this
  corrected test before starting its booking suite; application sources are unchanged. `/tmp/studio-browser-20261005-bookings-final.log`,
  exit 0.
- The corrected booking suite passed in the subsequent aggregate, including all five
  independently asserted invalidation modes. Entry/auth/inbox/invitations/bookings/
  reporting/proposals passed; conversations then failed at its five-second client
  selector assertion before the enclosing API-response waits exited. The test now
  checks both real API 200 responses before its UI assertion; no timeout increased.
  `/tmp/studio-browser-20261005-final-aggregate.log`, exit 1. This remains a failed
  local aggregate, not an all-suite pass.
- Remaining six-suite run: `BROWSER_SUITES='conversations.py,studio_contacts.py,public_content.py,enquiry_operations.py,documents.py,account_sessions.py' BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/python web/tests/run_browser.py`; `/tmp/studio-browser-20261005-remaining.log`. **All six passed**, exit 0: conversations, contacts, public content, enquiry operations, documents and account sessions. No API result was fabricated.
- Mobile sources unchanged; mobile checks/exports not rerun. Native credential/device authentication remains unverified. `adb`, `emulator` and `xcrun` were unavailable on PATH.
- Docker executable unavailable locally. Hosted production-image evidence is separate from local Caddy smoke.

## Hosted evidence

At `c48acc5`, PR run [37247089682](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37247089682)
and push run [37247086350](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37247086350)
passed all three jobs. Direct PR web-log readback explicitly confirms all thirteen
browser suites and the inbox journey. At application increment `4c65efe`,
PR run [37248652560](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37248652560)
and push run [37248649128](https://github.com/devcorp-by-techcorp/studio-suite_v2/actions/runs/37248649128)
passed backend, web and production-image/routing jobs. Corrected browser checkpoint
`87d19d5554f0038cd6ab477bb6d20d6208bede59` triggered PR run `37262282274`
and push run `37262279800`; both passed all three jobs. Direct push log readback
confirmed `All 13 browser suites passed`, including booking and conversations.
New resource implementation and final records tips are verified separately in
[resource verification](2026-10-05-resource-configuration-verification.md).

## Requirements and preserved work

The initial repository audit found no scheduling/obligation specification. The
user then supplied `/mnt/chromeos/removable/SKYNET/srudio-suite/`. All three files
were read in full and copied unchanged into `docs/authority/booking-2026-10-05/`;
source hashes and precise supplied requirements are in the
[booking authority checklist](../docs/development/booking-decision-checklist.md).
They specify capacity/resources, interval/buffer/hold rules, Melbourne timezone/DST,
confirmation permission, and contract/payment obligations. All three version 1.0.0
files originally carry `OWNER-APPROVAL CANDIDATE` status. The user explicitly
approved all three as binding implementation requirements; user-authored Empirical
receipt `6ac360d400f9510b562014b0` records the decision. No provider success is
inferred from this approval. The historical ungated
confirmation and deleted-grant descriptions in `goals/DECISIONS.md` have narrow
supersession notices.

Still required: actual resource/package/location configuration,
explicit permission mapping for the current staff model, signed agreement/SOW
source and provider/evidence implementation. Planning-to-confirmed remains 409.
Enquiries, chats, invitations/acceptance and proposal drafts reserve nothing.
Existing confirmed records stay readable. Other remaining dependencies are live
R2/Worker credentials and private-delivery/derivative rules; signature provider,
consent and evidence; payment provider; retention policy; notification sandbox;
non-enumerating client-recovery provider/browser verification; and native
secure-session strategy with actual device/emulator evidence.
Recovery stays unregistered and default-disabled. Manual non-client contact editing
is mentioned as outstanding in `docs/studio-contacts.md` but lacks a canonical
record/editing contract; the implemented canonical client roster is not re-created.

Concurrent unrelated `design-system/` deletions and new assets remain excluded.
Read-only inspection found a separate mobile/design workspace and a sync record
referencing another repository with prototype localStorage/booking/fee promises;
these do not supply authority to alter the operational application or booking gate.
No files from that concurrent work are restored, deleted or staged.

## Empirical receipts

Completed inbox race work: `6ac2eedf00f9510b561ffcea`. Completed booking
authorization, full backend evidence, reload/callback lessons and located source
audit: `6ac322aa00f9510b56200c5a`. Both creation responses verified mass 1,
work-history tags and session/Git metadata; payloads explicitly use authorType agent.
The first invitation-record attempt hit automatic approval-review timeout before
execution; retry revealed no payload file. Its completed work was included in the
subsequent successful consolidated record rather than claimed as a missing receipt.

## Final aggregate verification

After the response-ordering corrections, a fresh aggregate started with
`BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3'
.venv/bin/python web/tests/run_browser.py` and the Node 22 PATH. Log:
`/tmp/studio-browser-20261005-verified-aggregate.log`. Entry/auth passed, then the
MongoDB process disappeared at the inbox stage: real application calls and cleanup
reported connection refused / ReplicaSetNoPrimary. Exit 1; this was not a full pass.
The prior log ended at 04:14 UTC with a normal checkpoint, with no new FTDC fatal
write error or orderly shutdown. Kernel OOM search returned no kill; the user cgroup
reported `oom_kill 0`. Free disk remained about 965 MB. This evidence does not
establish why the process exited or the earlier FTDC root cause.

The same data directory was restarted without repair/deletion, using foreground
`mongod --dbpath /tmp/studio-suite-mongo-data --replSet phase3 --bind_ip 127.0.0.1
--port 27027 --logpath /tmp/studio-suite-mongod-20261005-resource.log --logappend`.
After the user resumed this interrupted session, live `hello` verified writable
primary `phase3`; a temporary isolated readiness database write/read/drop passed.
The later resource report records the final verification after this recovery.

No failed aggregate is represented as a pass. Original application checkpoint
`4c65efe` and corrected browser checkpoint `87d19d5` both have green hosted CI.
