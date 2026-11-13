# Booking authority and remaining decisions

On 2026-10-05 the user supplied `SKYNET/srudio-suite/`. The exact directory is
`/mnt/chromeos/removable/SKYNET/srudio-suite/`. All three files were read in full;
unaltered snapshots are retained under `docs/authority/booking-2026-10-05/`.
Each is version 1.0.0, dated 2026-10-05, status **OWNER-APPROVAL CANDIDATE**.
The user explicitly approved all three versions as binding implementation requirements,
replying **“Approve all three as implementation requirements.”** This session
approval supersedes the original candidate status for implementation. The source
bytes remain unchanged. Empirical user-authored approval receipt:
`6ac360d400f9510b562014b0`. It does not authorize deployment or waive any gate.

| Source | SHA-256 |
| --- | --- |
| [IS-BOOK-AUTH-001 acceptance/authority](../authority/booking-2026-10-05/Booking_Acceptance_Authority.md) | `c69757d2921a86383ff1e6628181e1bd94c2168163c659c5918f4c370fe7f840` |
| [IS-BOOK-AUTH-002 capacity/timezone/buffers](../authority/booking-2026-10-05/Booking_Capacity_Timezone_Buffers.md) | `9fd427d8c903cfd9dcdaaf716d42e2a1e9de9854ef6025b6e04ea50d5123c194` |
| [IS-BOOK-AUTH-003 contract/payment mapping](../authority/booking-2026-10-05/Booking_Contract_Payment_Mapping.md) | `eaa3699833427a12fcaffb8bc1888f1c7594eebc6d313c4c900101b4886fa61b` |

## Approved requirements

The files specify resource instances with integer capacity, default discrete
capacity one, required photographers/rooms and optional equipment; half-open
service and occupied intervals; setup/reset and travel blocks; active hold
conflicts/expiry; Melbourne IANA timezone and explicit DST gap/fold handling.
They distinguish reviewed client-summary submission from signed contract
acceptance, human approval and final backend confirmation. They require a
`bookings.confirm` permission, immutable summary/contract evidence, cleared
required payments, due instalments, unresolved-issue checks, atomic resource
conflict checking, command idempotency and audit events. The contract mapping
supplies category schedules, SOW precedence and separate reschedule/cancellation
review; prototype payment percentages are not a source of commercial authority.
These are approved requirements, not evidence of live provider success.

## Remaining implementation decisions and dependencies

- Owner approval is resolved for these exact three versions; retain the source hashes.
- Staff can now configure actual resource instances through the [resource workflow](../booking-resources.md). Establish package durations/resource needs,
  locations and approved travel estimates. Do not invent an operational inventory.
- Map `bookings.confirm` to the current `staff` identity model explicitly. The
  candidate's admin-only fallback does not establish that every staff account is
  an administrator or entitled to confirm. Keep override permission unassigned.
- Establish signature/consent/evidence and payment provider boundaries with sandbox
  credentials; authenticate human approval and cleared payment evidence. The
  summary does not supply provider credentials or the actual signed category
  agreements/SOWs referenced by the mapping.
- Reconcile current date-only operational bookings and interval proposal records
  with the proposed lifecycle, without converting existing planning/confirmed
  records by inference. Existing confirmed records remain readable.

The next concrete task is approved-policy scheduling preparation: interval/DST
validation and package/resource assignment, followed by transactional
resource fencing with real replica-set simultaneous-confirmation, capacity,
buffer/travel, hold-expiry and reschedule tests. Complete meaningful staff/client
browser coverage and contract/payment evidence before lifting confirmation.
Planning-to-confirmed remains HTTP 409 and disabled in the UI. Enquiries,
conversations, invitations/acceptance and proposal drafts reserve nothing.
