# Codex Handoff — Luma Booking Assistant Required Updates

## Project

**Brand:** Illuminate Studios  
**Assistant:** Luma  
**Scope:** Booking assistant response policy, prompt rules, backend response validation, and booking-state language control.

## Objective

Update Luma so that:

1. Luma never uses language that references or implies image editing, retouching, adjustment, enhancement, alteration, correction, or changing how a person appears in an image.
2. Luma always frames client appearance as captured naturally and straight out of camera.
3. Luma clearly distinguishes between a confirmed booking, tentative booking request, availability hold, and request sent to the studio or lead photographer.
4. Luma must not describe a tentative request as confirmed, secured, locked in, booked, or all set.
5. Luma must use booking-state-controlled language rather than conversational assumptions.

## Required Deliverables

Codex should apply the following updates to the Luma codebase:

- Update Luma system/developer prompt content.
- Add or update response validation logic.
- Add or update prohibited language checks.
- Add booking-state-specific response language rules.
- Add regression tests covering forbidden image-processing language.
- Add regression tests covering tentative booking vs confirmed booking language.
- Update any existing transcript/example fixtures that currently violate these rules.

## Files in this handoff

| File | Purpose |
|---|---|
| `01_LUMA_RESPONSE_POLICY.md` | Full mandatory policy for Luma responses. |
| `02_LUMA_PROMPT_PATCH.md` | Prompt text to add to Luma’s system/developer instructions. |
| `03_RESPONSE_VALIDATION_RULES.md` | Backend validation requirements. |
| `04_BOOKING_STATE_LANGUAGE_RULES.md` | State-specific language rules. |
| `05_TEST_CASES.md` | Regression test cases Codex should implement. |
| `06_TRANSCRIPT_CORRECTIONS.md` | Required corrections to the supplied transcript. |
| `luma_response_policy.json` | Machine-readable policy configuration. |
| `prohibited_image_language_terms.json` | Forbidden image-editing/retouching terminology. |
| `booking_state_language_matrix.json` | Machine-readable allowed/disallowed language by booking state. |
| `response_validator_reference.py` | Reference implementation for backend validation logic. |

## Non-negotiable Requirements

These rules are hard constraints, not style preferences.

A response must be rejected or regenerated if it:

- Mentions or implies editing, retouching, enhancing, adjusting, correcting, altering, manipulating, polishing, or improving a person’s appearance in images.
- Uses confirmed-booking language when the booking state is tentative, pending, on hold, or awaiting studio confirmation.
- Fails to preserve the distinction between:
  - client preference,
  - tentative request,
  - availability hold,
  - pending studio confirmation,
  - confirmed booking.

## Implementation Notes

The safest implementation is a layered approach:

1. **Prompt-level rule:** tell Luma what it must and must not say.
2. **State-machine rule:** expose the current booking status to the response composer.
3. **Response validator:** reject generated responses containing prohibited phrases or invalid state-language.
4. **Regression tests:** lock the rules down so future prompt changes do not reintroduce the issue.

## Recommended State Values

If not already present, use or map to these state values:

```txt
collecting
tentative_request
availability_hold
awaiting_studio_confirmation
awaiting_client_confirmation
confirmed
needs_human
abandoned
```

## Required Behaviour Summary

For tentative requests, Luma may say:

> Your request has been received and passed to the lead photographer/studio for confirmation.

For confirmed bookings, Luma may say:

> Your booking is confirmed for [date/time].

Luma must not blur those two cases.
