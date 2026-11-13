---
title: "Illuminate Studios Contract, Payment, Cancellation and Reschedule Mapping"
document_id: "IS-BOOK-AUTH-003"
version: "1.0.0"
status: "OWNER-APPROVAL CANDIDATE"
date: "2026-10-05"
---

# Contract, Payment, Cancellation and Reschedule Mapping

## 1. Confirmation contract gate

Current Illuminate agreements state that a signed Agreement and booking retainer are required before the booking is secured and before services are performed.

Unless the Statement of Work states otherwise, the booking retainer is `10%` of the total package fee and is credited toward the total.

The application must therefore not use the prototype/admin-derived `30% deposit` as an authority value.

## 2. Contract acceptance

Accepted forms:

- wet signature recorded by staff; or
- electronic acceptance/signature linked to the exact immutable contract version rendered to the client.

The system must preserve:

- template/version ID;
- rendered contract snapshot;
- Statement of Work values;
- signer name/email;
- acceptance timestamp;
- audit events;
- signed PDF/object reference where generated.

## 3. Payment schedules from current category agreements

### Family portrait

- retainer: 10% unless otherwise agreed in writing;
- balance due: 3 calendar days before the session;
- one fee-free reschedule if requested at least 7 calendar days before the session, subject to availability;
- cancellation: retainer may be retained; cancellation within 72 hours may attract reasonable incurred costs and up to 50% of package fee, less avoidable costs, to the extent permitted by law.

### Anniversary / couples

- retainer: 10% unless otherwise agreed in writing;
- balance due: 3 calendar days before the session;
- one fee-free reschedule if requested at least 7 calendar days before the session, subject to availability;
- cancellation: retainer may be retained; cancellation within 72 hours may attract reasonable incurred costs and up to 50% of package fee, less avoidable costs, to the extent permitted by law.

### Kids birthday

- retainer: 10% unless otherwise agreed in writing;
- balance due: 7 calendar days before the event;
- one fee-free reschedule if requested at least 14 calendar days before the event, subject to availability;
- rescheduling within 14 days may require a new retainer or reasonable rescheduling fee if the original date cannot be reallocated;
- cancellation: retainer may be retained; cancellation within 7 calendar days may attract reasonable incurred costs and up to 50% of package fee, less avoidable costs, to the extent permitted by law.

### General event

- retainer: 10% unless otherwise agreed in writing;
- balance due: 7 calendar days before the event;
- one fee-free reschedule if requested at least 14 calendar days before the event, subject to availability;
- rescheduling within 14 days may require a new retainer or reasonable rescheduling fee if the original date cannot be reallocated;
- cancellation: retainer may be retained; cancellation within 7 calendar days may attract reasonable incurred costs and up to 50% of package fee, less avoidable costs, to the extent permitted by law.

### Wedding

- 10% booking retainer due on signing;
- 50% of package fee due 60 calendar days before the wedding;
- final balance due 14 calendar days before the wedding;
- one fee-free reschedule if requested at least 90 calendar days before the wedding, subject to availability;
- rescheduling within 90 days may require a revised payment schedule and reasonable rescheduling fee if the original date cannot be reallocated;
- cancellation 60–89 days before wedding: up to 50% of package fee;
- cancellation 14–59 days before wedding: up to 75% of package fee;
- cancellation within 14 days: up to 100% of package fee, less avoidable costs, to the extent permitted by law.

## 4. Payment-due-at-confirmation rule

If a booking is made inside a contractual payment deadline, every payment stage whose due date has already arrived must be treated as due immediately for confirmation purposes.

Examples:

- family portrait booked two days before the session: the 10% retainer and the balance due three days prior are already due;
- wedding booked 45 days before the date: the 10% retainer and 50% instalment are already due;
- wedding booked 10 days before the date: all scheduled amounts are already due.

The backend must calculate this from the selected contract/SOW, not from UI phase numbers.

## 5. Reschedule workflow

A reschedule request must never directly mutate the existing confirmed date/time.

Required flow:

1. retain original booking and contract history;
2. create `reschedule_pending` request;
3. evaluate applicable notice period and commercial consequence;
4. check new resource availability including buffers/travel;
5. obtain required client/studio acceptance for the change;
6. issue contract/SOW variation where required;
7. atomically release old resource block and acquire the new block;
8. log all changes.

## 6. Cancellation workflow

Cancellation requests must be timestamped and evaluated against the contract actually signed by the client.

The system may calculate a recommended contractual charge, but a human-authorised workflow must approve any discretionary amount before invoicing.

## 7. Statement of Work precedence

The Statement of Work may expressly vary package price, retainer, payment dates, travel, inclusions or other terms. Where the signed Statement of Work validly conflicts with template defaults, the signed booking-specific Statement of Work governs that booking.

## 8. Consumer-law safeguard

No automated rule may represent a contractual charge or remedy as overriding rights that cannot be excluded under applicable Australian law. Disputed, unusual or legally sensitive cases must route to human review.
