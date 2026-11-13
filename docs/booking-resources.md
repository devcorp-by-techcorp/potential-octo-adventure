# Booking resource configuration

Source: user-approved IS-BOOK-AUTH-002 version 1.0.0, sections 1–2, retained at
[approved source snapshots](authority/booking-2026-10-05/README.md).

Staff configure actual named photographers, second photographers/assistants,
studio rooms/spaces and specialist equipment at `/studio/booking-resources`.
The catalog starts empty; no photographer, room or equipment inventory is invented.
Every definition has a stable UUID, a type, a name, integer capacity, enabled
flag, expected revision and UTC creation/update timestamps. Discrete capacity
defaults to the approved value of one. Capacity must be a positive exact JSON
integer, at most `2**53 - 1` for browser/BSON transport; this is a technical bound,
not a studio-wide business capacity. Disabled definitions remain visible to staff.
There is no deletion or retention rule.

- `GET /api/studio/booking-resources` returns at most 50 definitions by default,
  with an opaque UUID continuation cursor (`after`); maximum page size is 100.
- `POST /api/studio/booking-resources` accepts `id`, `kind`, `name`, optional
  `capacity`. The caller retains the UUID for uncertain-response retries. Repeating
  the same creation returns its original receipt even after a later edit;
  reusing the UUID with different creation input returns 409.
- `PATCH /api/studio/booking-resources/{id}` requires `expected_revision` and
  changed `name`, `capacity` and/or `enabled`. Type/ID are immutable. Concurrent
  edits have one winner; stale writes return 409. Staff refresh and explicitly
  select the latest definition before retrying. An uncertain edit is reconciled
  against persisted data rather than silently repeated.

Creation/updates fence staff identity and the authorizing cookie session in the
same replica-set transaction as resource data, creation receipt and audit history.
Origin/CSRF checks, enable/role/version/expiry/revocation checks and conflict-retry
revalidation remain required. Failures abort both authorization and resource
writes. Audit records retain actor, time and before/after values; no audit/receipt
internals are emitted by the bounded resource API. Reads are no-store. Clients
cannot read or configure these definitions, regardless of grants or email matching.

The browser retains a creation UUID and original payload after uncertain delivery;
inputs stay read-only until an exact retry resolves it. Definitive 422/409 input
failures allow correction. Successful writes refresh actual persisted definitions.
Validation uses literal text; names never become HTML. Resource writes do not
create bookings, enquiries, grants, availability holds or provider calls.

Configuration is a prerequisite, not a reservation. It grants no
`bookings.confirm` or override permission and does not supply working hours,
package assignments, route-time estimates, calendar intervals or evidence of
received money/contract acceptance. Scheduling must use explicit configured
resources and implement the approved interval, DST, capacity, buffer/travel,
hold-expiry and transaction rules before confirmation can be enabled. Future
occupancy transactions must coordinate with resource configuration writes;
disabling/changing a definition cannot become a shortcut around confirmed
resource obligations.
