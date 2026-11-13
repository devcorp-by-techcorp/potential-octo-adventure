"""Fail-closed checks derived from docs/luma-response-audit-fix/."""

import re
import unicodedata

IMAGE_LANGUAGE = re.compile(
    r"\b(retouch\w*|edit(?:s|ed|ing)?|enhanc\w*|adjust\w*|correct\w*|"
    r"alter\w*|polish\w*|airbrush\w*|reshap\w*|filter\w*|soften\w*|"
    r"manipulat\w*|touch[ -]?ups?|post[ -]?production|skin smoothing|smooth skin|"
    r"body shaping|remov\w* (?:imperfections|blemishes)|"
    r"mak\w* (?:you|someone) look different|modified after capture)\b",
    re.I,
)
CONFIRMATION = re.compile(
    r"\b(confirm(?:ed|ation)\s*(?:booking|session|reservation)|"
    r"(?:booking|session|date|reservation)\s+(?:(?:is|has been|was)\s+)?"
    r"(?:confirmed|secured|reserved|booked|complete|all set)|"
    r"(?:you(?:'re| are)|we(?:'ve| have))\s+(?:now\s+)?booked|"
    r"(?:all set|locked in|no further action|see you (?:on|then))|"
    r"(?:secured|reserved) your (?:date|session)|your session is booked)\b",
    re.I,
)
PENDING = re.compile(
    r"tentative|pending confirmation|request (?:has been received|is with)|"
    r"studio will confirm|with the (?:studio|lead photographer)|"
    r"requested date has been recorded",
    re.I,
)
# No write tools are exposed to the model. In collecting state it cannot claim
# that it has submitted an enquiry, contacted the studio, or checked a calendar.
UNPERFORMED_ACTION = re.compile(
    r"\b(?:sent|submitted|forwarded|received|recorded|saved|held|reserved)\b|"
    r"with the (?:studio|lead photographer)|checked (?:the )?availability|"
    r"(?:date|time) (?:is|appears) available",
    re.I,
)


def validate_reply(text: str, state: str) -> bool:
    text = unicodedata.normalize("NFKC", text).replace("’", "'").replace("—", "-")
    if not text.strip() or IMAGE_LANGUAGE.search(text):
        return False
    if state != "confirmed" and CONFIRMATION.search(text):
        return False
    if state == "collecting" and UNPERFORMED_ACTION.search(text):
        return False
    if state in {"tentative_request", "availability_hold", "awaiting_studio_confirmation"}:
        return bool(PENDING.search(text))
    return True


def safe_reply(state: str) -> str:
    if state == "awaiting_studio_confirmation":
        return (
            "Your tentative enquiry is with the studio, pending confirmation. "
            "Please contact the studio if you need to discuss your request."
        )
    return (
        "I can help you prepare an enquiry. Please use the enquiry form to review "
        "your preferred date and contact details before sending them. "
        "The studio checks availability and confirms bookings."
    )
