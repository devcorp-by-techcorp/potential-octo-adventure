# Illuminate Studios — LLM Markdown Handoff Bundle

This bundle contains all substantive documents produced in this chat, rendered as standalone Markdown files for LLMs, Codex, Claude, internal documentation systems, and copywriter handoff.

## Contents

| File | Purpose |
|---|---|
| `01_FORMATTED_BOOKING_TRANSCRIPT.md` | Share-ready transcript record and key caveats. |
| `02_LUMA_RESPONSE_POLICY.md` | Mandatory Luma assistant response policy. |
| `03_COPYWRITER_IMAGE_REPRESENTATION_POLICY.md` | Copywriter policy with no references to Luma. |
| `04_CODEX_IMPLEMENTATION_HANDOFF.md` | Engineering handoff. |
| `05_LUMA_PROMPT_PATCH.md` | Prompt patch for Luma. |
| `06_RESPONSE_VALIDATION_RULES.md` | Backend validation requirements. |
| `07_BOOKING_STATE_LANGUAGE_RULES.md` | Booking-state language matrix. |
| `08_REGRESSION_TEST_CASES.md` | Required regression tests. |
| `09_TRANSCRIPT_CORRECTIONS.md` | Required corrections to the supplied transcript. |
| `10_MACHINE_READABLE_POLICY_AS_MARKDOWN.md` | JSON configuration included in Markdown fences. |
| `11_RESPONSE_VALIDATOR_REFERENCE.md` | Python validator reference included in Markdown fences. |

## Non-Negotiable Rules

1. Never refer to or imply image editing, retouching, adjustment, enhancement, alteration, correction, manipulation, or post-production changes to appearance.
2. Present appearance as natural and straight out of camera.
3. Never call a tentative request, availability hold, or pending request a confirmed booking.
4. Enforce these rules in prompts, application logic, validators, and tests.
