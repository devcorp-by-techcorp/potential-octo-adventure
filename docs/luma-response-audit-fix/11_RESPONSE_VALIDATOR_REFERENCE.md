# Luma Response Validator — Reference Implementation

```python
"""
Reference response validator for Luma.

This file is intended as implementation guidance for Codex.
Adapt names/imports to the actual backend structure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Literal


BookingState = Literal[
    "collecting",
    "tentative_request",
    "availability_hold",
    "awaiting_studio_confirmation",
    "awaiting_client_confirmation",
    "confirmed",
    "needs_human",
    "abandoned",
]


PROHIBITED_IMAGE_TERMS: tuple[str, ...] = (
    "retouch",
    "retouched",
    "retouching",
    "professionally retouched",
    "edited",
    "editing",
    "professionally edited",
    "enhanced",
    "enhancement",
    "adjusted",
    "adjustment",
    "corrected",
    "correction",
    "polished",
    "airbrushed",
    "airbrushing",
    "skin smoothing",
    "smooth skin",
    "body shaping",
    "body reshaping",
    "reshaping",
    "touch-up",
    "touch-ups",
    "touchups",
    "touch ups",
    "final edited gallery",
    "premium retouching",
    "flattering edits",
    "post-production",
    "post production",
    "image manipulation",
    "digital alteration",
    "altered images",
    "remove imperfections",
    "removing imperfections",
    "make you look your best through editing",
    "make you look different",
    "modified after capture",
    "softened",
    "filtered",
)


CONFIRMED_BOOKING_PHRASES: tuple[str, ...] = (
    "your booking is confirmed",
    "your session is confirmed",
    "your session is all set",
    "you are now booked",
    "you are booked in",
    "everything is locked in",
    "your session is secured",
    "no further action is required",
    "the booking is complete",
    "your booking is complete",
    "we’ll see you on",
    "we'll see you on",
)


PENDING_STATUS_PHRASES: tuple[str, ...] = (
    "tentative",
    "request has been received",
    "request is with the studio",
    "request is with the lead photographer",
    "pending confirmation",
    "studio will confirm",
    "lead photographer will be in touch",
    "requested date has been recorded",
    "with the lead photographer",
    "with the studio",
)


@dataclass(frozen=True)
class ValidationIssue:
    reason: str
    matched_terms: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def reason(self) -> str | None:
        if not self.issues:
            return None
        if len(self.issues) > 1:
            return "multiple_policy_violations"
        return self.issues[0].reason


def _find_matches(text: str, terms: Iterable[str]) -> list[str]:
    normalized = text.casefold()
    return [term for term in terms if term.casefold() in normalized]


def validate_luma_response(
    *,
    response_text: str,
    booking_state: BookingState,
    require_pending_phrase_for_tentative: bool = True,
) -> ValidationResult:
    issues: list[ValidationIssue] = []

    image_matches = _find_matches(response_text, PROHIBITED_IMAGE_TERMS)
    if image_matches:
        issues.append(
            ValidationIssue(
                reason="prohibited_image_language",
                matched_terms=image_matches,
            )
        )

    if booking_state != "confirmed":
        state_matches = _find_matches(response_text, CONFIRMED_BOOKING_PHRASES)
        if state_matches:
            issues.append(
                ValidationIssue(
                    reason="invalid_booking_state_language",
                    matched_terms=state_matches,
                )
            )

    if require_pending_phrase_for_tentative and booking_state in {
        "tentative_request",
        "availability_hold",
        "awaiting_studio_confirmation",
    }:
        pending_matches = _find_matches(response_text, PENDING_STATUS_PHRASES)
        if not pending_matches:
            issues.append(
                ValidationIssue(
                    reason="missing_pending_status_language",
                    matched_terms=[],
                )
            )

    return ValidationResult(valid=not issues, issues=issues)


def assert_valid_luma_response(response_text: str, booking_state: BookingState) -> None:
    result = validate_luma_response(
        response_text=response_text,
        booking_state=booking_state,
    )

    if result.valid:
        return

    detail = {
        "reason": result.reason,
        "issues": [
            {"reason": issue.reason, "matched_terms": issue.matched_terms}
            for issue in result.issues
        ],
    }

    raise ValueError(f"Luma response failed validation: {detail}")


if __name__ == "__main__":
    samples = [
        (
            "All images are treated with care and discretion. Only the best, most flattering shots are selected.",
            "collecting",
        ),
        (
            "Thank you, Jane. Your request to tentatively secure a morning session is now with the lead photographer. We have the requested date recorded as Saturday, 5 September 2026 at 10:00am.",
            "tentative_request",
        ),
        (
            "Your session is all set. You’ll receive 15 professionally retouched images.",
            "tentative_request",
        ),
    ]

    for text, state in samples:
        print(validate_luma_response(response_text=text, booking_state=state))
```
