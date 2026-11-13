---
title: "Illuminate Studios Booking Capacity, Timezone and Buffer Authority"
document_id: "IS-BOOK-AUTH-002"
version: "1.0.0"
status: "OWNER-APPROVAL CANDIDATE"
date: "2026-10-05"
---

# Booking Capacity, Timezone and Buffer Authority

## 1. Resource model

Availability is resource-based, not a single global boolean.

Every confirmable booking must reserve the resources it actually consumes. Supported resource classes are:

- photographer;
- second photographer/assistant where a package requires one;
- configured studio room or physical shoot space;
- specialist equipment resource where the business chooses to make equipment capacity bookable.

A resource instance has an integer `capacity`. The default capacity of any discrete resource is `1`.

No booking may assume unconfigured staff or space exists.

## 2. Initial simultaneous-capacity baseline

For the initial production baseline:

- the default primary/lead-photographer resource has capacity `1`;
- a normal booking consumes one photographer unit;
- a package explicitly sold with a second photographer consumes two photographer units;
- studio-room capacity is `1` per configured room;
- system-wide simultaneous capacity is the sum of distinct available resource units, not a hard-coded global number.

If only one active photographer resource is configured, the effective simultaneous shoot capacity is one.

## 3. Time interval semantics

The client-facing service interval is:

`[start_at, end_at)`

where `end_at = start_at + booked_duration` unless a custom end time is explicitly approved.

The resource-occupied interval is wider:

`[start_at - setup_buffer - inbound_travel_buffer, end_at + reset_buffer + outbound_travel_buffer)`

Conflict detection uses the resource-occupied interval, not merely the client-facing session duration.

## 4. Overlap rule

Two bookings conflict when they require any common resource and their resource-occupied intervals overlap.

Back-to-back client-facing times are permitted only when the buffer/travel calculation leaves no resource overlap.

Temporary holds participate in conflict checking for the resources they reserve until the hold expires or is released.

## 5. Proposed operational buffer baseline

These are build-level operational defaults, not client contract terms. They may be overridden by an approved package/resource configuration, with the effective values snapshotted into the booking.

Default setup buffer: `30 minutes` before the session/event.

Default reset/pack-down buffer: `30 minutes` after the session/event.

Travel between different physical locations:

- use an approved route-time estimate where available;
- add `15 minutes` operational contingency to the route estimate;
- if no route estimate is available, use a minimum travel block of `45 minutes` and require staff review before final confirmation;
- same-location consecutive bookings have `0` travel minutes but still retain setup/reset rules unless an authorised package configuration explicitly reduces them.

The system must allow per-package and per-booking overrides by an authorised staff member and must audit the override.

## 6. Holds

Default availability-hold lifetime: `20 minutes`.

A hold is not a confirmation. Expired holds must release resource capacity automatically.

## 7. Studio timezone

The canonical studio IANA timezone is:

`Australia/Melbourne`

Do not use fixed `UTC+10` or `UTC+11` logic.

## 8. Daylight-saving handling

Timezone conversion must use an IANA timezone database implementation.

Persist at least:

- local date;
- local wall-clock time;
- timezone ID `Australia/Melbourne`;
- resolved UTC instant;
- resolved UTC offset at that instant.

For daylight-saving transitions:

- nonexistent local times during the spring-forward gap must be rejected and the user/staff asked to select a valid time;
- ambiguous repeated local times during the autumn rollback must be resolved explicitly to one offset before confirmation;
- previously confirmed UTC instants must not be silently changed if timezone rules are later updated.

## 9. Availability calculation order

1. resolve local date/time in `Australia/Melbourne`;
2. calculate start/end from package duration;
3. calculate setup/reset buffers;
4. calculate location-based travel blocks;
5. derive occupied interval per resource;
6. test confirmed bookings and active holds for overlap;
7. create hold or return unavailable alternatives;
8. re-run the conflict test immediately before final confirmation.
