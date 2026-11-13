# Required Regression Test Cases

## Test Group 1 — Forbidden Image Language

### Test 1.1

Input candidate response:

> All images are treated with care and discretion. Only the best, most flattering shots are selected and professionally retouched.

Expected result:

```json
{
  "valid": false,
  "reason": "prohibited_image_language"
}
```

Matched term:

```txt
professionally retouched
```

---

### Test 1.2

Input candidate response:

> Your package includes 15 professionally edited images.

Expected result:

```json
{
  "valid": false,
  "reason": "prohibited_image_language"
}
```

Matched term:

```txt
professionally edited
```

---

### Test 1.3

Input candidate response:

> We can smooth skin and make small touch-ups if needed.

Expected result:

```json
{
  "valid": false,
  "reason": "prohibited_image_language"
}
```

Matched terms:

```txt
smooth skin
touch-ups
```

---

### Test 1.4

Input candidate response:

> All images are treated with care and discretion. Only the best, most flattering shots are selected.

Expected result:

```json
{
  "valid": true
}
```

---

### Test 1.5

Input candidate response:

> The session is focused on lighting, posing, comfort, expression, and professional capture in camera.

Expected result:

```json
{
  "valid": true
}
```

---

## Test Group 2 — Tentative Booking vs Confirmed Booking

### Test 2.1

Booking state:

```txt
tentative_request
```

Input candidate response:

> Thank you, Jane. Your session is all set, and the studio will be in touch soon.

Expected result:

```json
{
  "valid": false,
  "reason": "invalid_booking_state_language"
}
```

Matched term:

```txt
your session is all set
```

---

### Test 2.2

Booking state:

```txt
tentative_request
```

Input candidate response:

> Thank you, Jane. Your request to tentatively secure a morning session is now with the lead photographer. We have the requested date recorded as Saturday, 5 September 2026 at 10:00am.

Expected result:

```json
{
  "valid": true
}
```

---

### Test 2.3

Booking state:

```txt
availability_hold
```

Input candidate response:

> Saturday, 5 September 2026 at 10:00am is available and your booking is confirmed.

Expected result:

```json
{
  "valid": false,
  "reason": "invalid_booking_state_language"
}
```

Matched term:

```txt
your booking is confirmed
```

---

### Test 2.4

Booking state:

```txt
confirmed
```

Input candidate response:

> Your booking is confirmed for Saturday, 5 September 2026 at 10:00am. The studio will be in touch with next steps.

Expected result:

```json
{
  "valid": true
}
```

---

## Test Group 3 — Combined Violations

### Test 3.1

Booking state:

```txt
tentative_request
```

Input candidate response:

> Your session is all set. You’ll receive 15 professionally retouched images.

Expected result:

```json
{
  "valid": false,
  "reason": "multiple_policy_violations"
}
```

Matched issues:

```txt
invalid_booking_state_language
prohibited_image_language
```

---

## Test Group 4 — Transcript Correction

### Test 4.1

Original text:

> All images are treated with care and discretion, and only the best, most flattering shots are selected and professionally retouched.

Corrected text:

> All images are treated with care and discretion, and only the best, most flattering shots are selected.

Expected result for corrected text:

```json
{
  "valid": true
}
```

---

### Test 4.2

Original text:

> Thank you, Jane. Your session is all set, and the studio will be in touch soon.

Corrected text:

> Thank you, Jane. Your request to tentatively secure a morning session, with preference for a Saturday date around 12 weeks from today, is now with the lead photographer. They will be in touch soon to confirm the date and any special requirements. We have the requested date recorded as Saturday, 5 September 2026 at 10:00am.

Expected result for corrected text when state is `tentative_request`:

```json
{
  "valid": true
}
```
