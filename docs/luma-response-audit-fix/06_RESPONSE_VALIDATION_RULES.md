# Response Validation Rules

## Purpose

Add backend response validation so Luma cannot produce prohibited language even if the model attempts to.

Validation should occur after Luma generates a candidate response and before the response is sent to the client.

## Required Checks

### 1. Prohibited Image Language Check

Reject or regenerate any response containing forbidden image-processing terms or phrases.

The validator should check case-insensitively and support substring or regex matching.

Forbidden examples include:

- retouch
- retouched
- retouching
- edited
- editing
- professionally edited
- professionally retouched
- enhanced
- enhancement
- adjusted
- adjustment
- corrected
- correction
- polished
- polish
- airbrushed
- airbrushing
- skin smoothing
- smooth skin
- body shaping
- reshaping
- touch-up
- touchups
- touch ups
- final edited gallery
- premium retouching
- flattering edits
- post-production
- image manipulation
- remove imperfections
- removing imperfections
- digital alteration
- altered images

Important: terms such as “selected images” and “final selected images” are allowed.

### 2. State-Language Validation

The validator must inspect both:

- current booking state,
- candidate response text.

If the booking state is not `confirmed`, reject responses containing confirmed-booking language.

Confirmed-booking language includes:

- your session is all set
- your booking is confirmed
- your session is confirmed
- you are now booked
- you are booked in
- everything is locked in
- your session is secured
- no further action is required
- the booking is complete
- your booking is complete
- we’ll see you on
- see you on [date]

### 3. Tentative Booking Required Language

If booking state is:

- `tentative_request`
- `availability_hold`
- `awaiting_studio_confirmation`

then Luma should include at least one pending-status phrase, such as:

- request has been received
- request is with the studio
- request is with the lead photographer
- pending confirmation
- studio will confirm
- lead photographer will be in touch
- requested date has been recorded
- tentative

### 4. Confirmed Booking Language

If booking state is `confirmed`, Luma may use confirmed-booking language.

However, it still must not use any prohibited image-processing language.

## Validation Result Structure

Recommended return shape:

```json
{
  "valid": false,
  "reason": "prohibited_image_language",
  "matched_terms": ["professionally retouched"],
  "recommended_action": "regenerate_response"
}
```

or:

```json
{
  "valid": false,
  "reason": "invalid_booking_state_language",
  "booking_state": "tentative_request",
  "matched_terms": ["your session is all set"],
  "recommended_action": "regenerate_response"
}
```

## Regeneration Instruction

If validation fails, regenerate with a system-level correction:

> The previous response violated Luma response policy. Regenerate without any image editing, retouching, adjustment, enhancement, or alteration language. Also ensure booking-state language matches the current booking state exactly.
