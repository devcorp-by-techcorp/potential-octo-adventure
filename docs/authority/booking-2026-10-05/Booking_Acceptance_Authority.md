---
title: "Illuminate Studios Booking Acceptance and Confirmation Authority"
document_id: "IS-BOOK-AUTH-001"
version: "1.0.0"
status: "OWNER-APPROVAL CANDIDATE"
date: "2026-10-05"
---

# Booking Acceptance and Confirmation Authority

## 1. Core rule

A client conversation, availability check, temporary hold or submitted request is not a confirmed booking.

The backend is the sole authority for state transition. Luma, the frontend and client text cannot create or infer `confirmed` state.

## 2. Required data before a booking request may be submitted

The backend must have validated:

- client legal/preferred name as required by the workflow;
- email and phone/contact method;
- selected service and package;
- booking date;
- resolved local start time in `HH:MM`;
- package/session duration or explicitly approved custom duration;
- concrete location/address plus suburb/locality for offsite work, or an explicit configured studio location;
- required resource assignment or a valid temporary availability hold;
- a reviewed booking summary shown to the client;
- explicit client confirmation that the reviewed summary is correct.

Vague conversational assent is not sufficient. The client confirmation must be an explicit affirmative response linked to the reviewed summary version.

## 3. Client acceptance is distinct from commercial confirmation

Client confirmation of the reviewed booking summary authorises submission of the booking request. It is not the legal contract acceptance and it does not by itself secure the booking.

The backend should record this as:

- `client_summary_confirmed_at`;
- `client_summary_version`;
- `client_summary_confirmed_by`;
- immutable snapshot of the summary shown.

## 4. Booking lifecycle

The canonical states are:

- `collecting`
- `tentative_request`
- `availability_hold`
- `awaiting_client_confirmation`
- `awaiting_studio_confirmation`
- `approved_pending_contract`
- `approved_pending_payment`
- `confirmed`
- `needs_human`
- `reschedule_pending`
- `cancelled`
- `abandoned`

`create_booking` may create the durable booking/request record, but it must not automatically mean `confirmed`.

## 5. Gates for `confirmed`

A booking may transition to `confirmed` only when all of the following are true:

1. all required booking data is valid;
2. required resources are assigned and pass conflict checking across the full occupied interval;
3. an authorised human has approved the booking request;
4. the client has accepted/signed the applicable Agreement electronically or in writing;
5. the required booking retainer has been received in cleared funds, unless a formally authorised payment exception exists;
6. any additional instalment already due under the selected contract/payment schedule is also satisfied;
7. no unresolved legal, safety, privacy, child-protection, venue/permit or custom-arrangement issue is flagged;
8. the state transition is performed atomically by the backend and logged.

Only after this transition may client-facing copy say the booking is confirmed, secured, locked in or booked.

## 6. Authorised confirmation permission

The authority is the backend permission `bookings.confirm`, not frontend role visibility.

Initial permission mapping:

- owner — allowed;
- admin — allowed;
- studio manager — allowed;
- lead photographer — allowed where explicitly assigned this permission;
- assistant/editor/general staff — not allowed by default;
- client — never allowed to set studio confirmation state;
- Luma/AI — never allowed.

An implementation with only `admin` and `client` roles may initially map `bookings.confirm` to `admin` only. Future role expansion must preserve the permission boundary.

## 7. Manual exceptions

No AI path may waive contract, payment or resource gates.

A manual exception, where business policy permits one, must require:

- a distinct privileged permission such as `bookings.override_confirmation_gate`;
- authenticated human actor;
- reason code and free-text rationale;
- before/after state capture;
- timestamp;
- audit event.

The default implementation should grant no override permission until explicitly configured.

## 8. Idempotency and concurrency

Confirmation must be idempotent. Repeating the same valid confirmation operation must not create duplicate bookings, duplicate invoices or duplicate email messages.

The final resource conflict check and state transition must occur in the same backend transaction or equivalent concurrency-safe critical section.

## 9. Required audit events

At minimum:

- `booking_request.created`
- `booking_summary.confirmed_by_client`
- `booking.approved_by_staff`
- `contract.sent`
- `contract.accepted`
- `payment.retainer_received`
- `booking.confirmed`
- `booking.confirmation_blocked`
- `booking.reschedule_requested`
- `booking.cancelled`

## 10. Language enforcement

When state is anything other than `confirmed`, Luma and the UI must use pending/tentative language. Existing Luma booking-state language rules remain mandatory.
