# Booking and shoot operations

`booking_requests` remains the immutable public enquiry receipt. Staff explicitly create a separate `bookings` record with `POST /api/studio/enquiries/{id}/booking`; its unique `source_enquiry_id` makes retries and concurrent conversion idempotent. Creation begins in planning and does not reserve studio capacity.

Staff list and inspect bounded booking records under `/api/studio/bookings`, then write with an expected revision. A stale revision returns HTTP 409. New planning records can be cancelled and reopened. Confirmation is gated pending implementation of the approved scheduling and obligation checks. Existing confirmed records can continue through preparation → shoot → selected-gallery preparation → delivered. Cancellation is allowed before delivery and reopening returns to planning. Every stage transition stores previous/new state, UTC time, and staff actor. Melbourne calendar dates remain date strings and are not converted through UTC.

Planned dates must be real calendar dates in `YYYY-MM-DD` format, including valid leap days. Staff may enter past dates for operational corrections. Omit the date when creating a booking to use the original enquiry date. On updates, omit unchanged fields; explicit null values are rejected with HTTP 422 before any write. Empty strings clear the optional location and private note. Rescheduling changes only the booking, preserving the original enquiry receipt. History timestamps include their UTC timezone on every read.

The booking editor retains drafts when a save fails or conflicts with another staff member. **Review latest saved version** shows the saved date, location, stage, note and revision. Staff must explicitly choose **Keep my draft against this revision** or **Use saved booking details** before resolving a conflict. Keeping a draft does not save it; a subsequent save still checks that revision. Save or discard unsaved details before changing, cancelling or reopening a booking. A lost save response can be reviewed against the persisted version without repeating the change. Unavailable list/detail requests provide retry controls, and authorization failures clear private booking content.

Confirmation is currently disabled in the interface and rejected by the API with HTTP 409. The three version 1.0.0 booking authority files supplied from SKYNET were explicitly approved by the user on 2026-10-05; see [approved source snapshots](authority/booking-2026-10-05/README.md). Resource configuration is implemented separately, but occupied intervals, holds, transactional capacity conflicts, confirmation permissions and required agreement/payment evidence are not yet implemented. A planning record cannot become confirmed or reserve availability. Existing confirmed records remain readable. The legacy date-edit path is not the approved reschedule workflow; replace direct changes to confirmed schedules with separate requests and atomic occupancy changes before treating that workflow as policy-complete.

An explicit accepted enquiry grant authorises only the client-safe booking projection linked to that enquiry. It never exposes staff notes or audit history. Staff can list current and revoked grants for an enquiry and revoke one with `POST /api/studio/enquiries/{enquiry_id}/client-access/{grant_id}/revoke`; the operation is idempotent, records the actor and time, and subsequent enquiry/booking reads no longer include the grant. Regranting requires a new invitation.

Indexes are created repeatably and no destructive migration is required. Existing enquiry and invitation records remain valid.

Verification follows the root build/lint/design gates and backend Ruff/pytest gates. Use `TEST_MONGODB_URI` with an isolated MongoDB replica set for the full backend suite. `BROWSER_MONGODB_URI` selects the disposable browser database for `python web/tests/run_browser.py`, which includes the public-enquiry-to-booking journey, two-staff edit recovery, failed/lost saves, cancellation/reopening and delivery, keyboard focus, both themes, and five viewport widths. Test fixtures disable live provider notifications.

## Transactional staff authorization — 2026-10-05

Creation, metadata edits and stage changes now revalidate and write-fence the
staff identity and current browser session inside the same replica-set transaction
as the booking. Disable, role change, password-version reset, session withdrawal
or expiry after the initial request check denies the write. A snapshot conflict
retries authorization against the new snapshot; it cannot reuse stale approval.
Database failure rolls back booking content/history and authorization fences.
Origin/CSRF validation remains required before this transactional check.

Enquiry conversion retains its unique-source retry contract. Concurrent creates
return the one saved planning booking; metadata/stage writes retain their expected
revision and lost-response reconciliation behavior. Planning-to-confirmed remains
HTTP 409, and no enquiry, grant, scheduling resource or external provider is written
by booking operations. Transaction-capable MongoDB is required for these writes.
