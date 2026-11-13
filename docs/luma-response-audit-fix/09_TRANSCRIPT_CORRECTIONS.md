# Transcript Corrections

## Supplied Transcript Issue Summary

The supplied Luma transcript contains two response-policy violations:

1. Prohibited image-processing language.
2. Tentative booking request incorrectly treated as a confirmed booking.

## Correction 1 — Image Retouching Language

### Original

> All images are treated with care and discretion, and only the best, most flattering shots are selected and professionally retouched.

### Problem

The phrase “professionally retouched” is forbidden.

Luma must not mention, imply, or reference editing, retouching, adjustment, enhancement, correction, or alteration of how a person appears in an image.

### Corrected

> All images are treated with care and discretion, and only the best, most flattering shots are selected.

## Correction 2 — Package Deliverable Language

### Original

> 15 professionally retouched images

### Problem

The phrase “professionally retouched images” is forbidden.

### Corrected

> 15 selected images

or:

> 15 professionally captured selected images

Preferred:

> 15 selected images

## Correction 3 — Add-On Language

### Original

> You can also add extra time or premium retouching if you wish.

### Problem

“Premium retouching” is forbidden.

### Corrected

> You can also add extra time if you would like a more relaxed pace or additional variety.

## Correction 4 — Tentative Booking Treated as Confirmed

### Original

> Thank you, Jane. Your session is all set, and the studio will be in touch soon. If you think of anything else or want to make changes later, just reach out. We look forward to working with you.

### Problem

The client requested a tentative booking. Luma must not say the session is “all set” unless the backend state is confirmed.

### Corrected

> Thank you, Jane. Your request to tentatively secure a morning session, with preference for a Saturday date around 12 weeks from today, is now with the lead photographer. They will be in touch soon to confirm the date and any special requirements.
>
> We have the requested date recorded as Saturday, 5 September 2026 at 10:00am.
>
> If you think of anything else or want to make changes later, just reach out. We look forward to working with you.

## Correction 5 — Earlier Booking Confirmation Wording

### Original

> Your session is now booked for Saturday, 5 September 2026 at 10:00am with a female photographer, as requested.

### Problem

This is only valid if the backend booking state is `confirmed`.

If the booking is still tentative or awaiting studio confirmation, this must be changed.

### Corrected for tentative state

> Your request for Saturday, 5 September 2026 at 10:00am has been recorded and passed to the lead photographer for confirmation. The request also notes your preference for a female photographer.

### Corrected for confirmed state only

> Your booking is confirmed for Saturday, 5 September 2026 at 10:00am with a female photographer, as requested.

## Required Transcript Status

Before using this transcript as a valid Luma example, all prohibited language must be removed and every booking-status statement must be aligned with the actual booking state.
