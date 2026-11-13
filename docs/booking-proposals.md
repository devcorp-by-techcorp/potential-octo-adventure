# Booking proposals (provisional)

Staff prepare a proposal from an existing enquiry, then view the chronological
planning list at `/studio/booking-drafts`, edit its dates or cancel the proposal.
Accepted clients with active explicit enquiry access can read its current proposal.
This is booking preparation, not a confirmed booking or available-capacity calendar.
The original enquiry remains `awaiting_studio_confirmation` throughout.

Confirmation is deliberately disabled in the API (409). No sourced requirements
identify resources, capacity, overlap rules, booking confirmation obligations,
deposit requirements or cancellation terms. A proposed date reserves nothing;
cancelling a proposal cancels no contract and sends no notification. The operational
calendar, confirmation and fulfilment stages remain blocked on those decisions.

## Persistence and concurrency

One proposal exists per enquiry, enforced by a unique index. No identity is linked
by email matching. Client reads check an active explicit grant on every request;
withdrawal affects proposal visibility as well as enquiry visibility. Internal
actor/history information is staff-only. Confirmation cannot be triggered by
public enquiry submission, Luma, invitation issue or acceptance.

Creation, mutation and actor/timestamp/history/command receipt commit together in
MongoDB replica-set transactions. Every write includes a UUID command identifier;
the same actor retrying identical input receives the persisted result. Reusing an
identifier with different input fails. Revision checks reject competing changes;
a cancelled proposal is terminal. History is an append-only collection with a
unique proposal/revision index and bounded pages. Commands are retained for retry
recovery; retention remains an explicit policy decision.

Timestamps must include an offset. UTC (+00:00) is accepted as an absolute instant;
nonzero offsets must match the selected IANA timezone at that instant. Dates are
stored in UTC and rendered in the proposal's saved timezone. No server timezone
or inferred studio timezone is used. The explicit-offset form avoids guessing
ambiguous daylight-saving local times. List queries sort by time/id and cap pages
at100 records and offsets at10000; concurrent edits may move records between pages.

## Acceptance and verification

Real replica-set tests cover persistence, duplicate creation, competing revisions,
exact retries and conflicting command reuse, terminal state, disabled confirmation,
CSRF/role denial, timezone rejection, unchanged enquiries and client grant privacy.
Browser checks exercise actual save/reload/edit/cancel/history and client visibility.
Run `TEST_MONGODB_URI=<isolated replica set> pytest -q tests/test_booking_drafts.py`
from backend. See the dated integration report for executed evidence.
