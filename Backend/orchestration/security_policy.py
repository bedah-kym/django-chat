"""Low-cost security policy helpers for prompt injection and tool abuse."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from asgiref.sync import sync_to_async
from django.core.cache import cache

from chatbot.models import Chatroom

ROOM_ACCESS_TTL_SECONDS = 300

SENSITIVE_ACTIONS = {
    "send_email",
    "send_message",
    "send_whatsapp",
    "set_reminder",
    "create_invoice",
    "create_payment_link",
    "withdraw",
    "schedule_meeting",
    "check_availability",
    "book_travel_item",
    "add_to_itinerary",
    "remove_from_itinerary",
    "create_itinerary",
    "create_workflow",
}

RESTRICTED_PARAM_KEYS = {
    "user_id",
    "room_id",
    "member_id",
    "is_admin",
    "is_superuser",
    "permissions",
    "auth",
    "token",
    "api_key",
    "secret",
    "password",
}

_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|previous\s+|system\s+|developer\s+)*instructions",
    r"(system|developer)\s+prompt",
    r"jailbreak",
    r"bypass\s+(safety|filters|policy|guard)",
    r"override\s+(safety|policy|guard)",
    r"reveal\s+(api\s*key|token|secret|password)",
    r"(api\s*key|access\s*token|secret|password)\b",
    r"\b(database|sql|drop\s+table|select\s+.+\s+from)\b",
    r"\b(admin\s+panel|superuser|root|sudo)\b",
    r"\b(localhost|127\.0\.0\.1|file://|/etc/passwd)\b",
]

_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)

_HIGH_RISK_VERBS = re.compile(
    r"\b(send|email|whatsapp|withdraw|transfer|pay|invoice|book|purchase|"
    r"schedule|invite|create|delete|reset)\b",
    re.IGNORECASE,
)


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, default=str)
    except Exception:
        return str(value)


def is_prompt_injection(message: Optional[str]) -> bool:
    if not message:
        return False
    return bool(_INJECTION_RE.search(_to_text(message)))


def is_high_risk_message(message: Optional[str]) -> bool:
    if not message:
        return False
    return bool(_HIGH_RISK_VERBS.search(message))


def should_block_message(message: Optional[str]) -> bool:
    return is_prompt_injection(message) and is_high_risk_message(message)


def should_block_action(message: Optional[str], action: Optional[str]) -> bool:
    if not action:
        return False
    if not is_prompt_injection(message):
        return False
    return action in SENSITIVE_ACTIONS


def sanitize_parameters(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    def _sanitize(value: Any) -> Any:
        if isinstance(value, dict):
            cleaned: Dict[str, Any] = {}
            for key, nested in value.items():
                if key in RESTRICTED_PARAM_KEYS:
                    continue
                cleaned[key] = _sanitize(nested)
            return cleaned
        if isinstance(value, list):
            return [_sanitize(item) for item in value]
        return value

    if not isinstance(params, dict):
        return {}
    return _sanitize(params)


async def user_has_room_access(user_id: Optional[int], room_id: Optional[int]) -> bool:
    if not user_id or not room_id:
        return True
    cache_key = f"room_access:{user_id}:{room_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return bool(cached)

    def _check():
        return Chatroom.objects.filter(id=room_id, participants__User_id=user_id).exists()

    allowed = await sync_to_async(_check)()
    cache.set(cache_key, 1 if allowed else 0, ROOM_ACCESS_TTL_SECONDS)
    return bool(allowed)


def sanitize_steps(steps: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cleaned_steps: List[Dict[str, Any]] = []
    for step in steps or []:
        if not isinstance(step, dict):
            continue
        cleaned = dict(step)
        cleaned["params"] = sanitize_parameters(cleaned.get("params") or {})
        cleaned_steps.append(cleaned)
    return cleaned_steps


def should_refuse_sensitive_request(message: Optional[str]) -> bool:
    if not message:
        return False
    lowered = _to_text(message).lower()
    # Deterministic refusal for system prompt / admin / data exfiltration requests.
    refusal_patterns = [
        r"\bsystem\s+prompt\b",
        r"\bdeveloper\s+prompt\b",
        r"\badmin\s+access\b",
        r"\bsuperuser\b",
        r"\broot\s+access\b",
        r"\bdatabase\s+dump\b",
        r"\bdump\s+the\s+database\b",
        r"\bexfiltrate\b",
        r"\bapi\s*key\b",
        r"\baccess\s*token\b",
        r"\bsecret\b",
        r"\bpassword\b",
    ]
    pattern = re.compile("|".join(refusal_patterns), re.IGNORECASE)
    return bool(pattern.search(lowered))


def sensitive_refusal_message() -> str:
    return (
        "Sorry, I can't help with that request. "
        "If you need account or data access changes, please use the official admin tools."
    )


# ── SIGNET: PII detection + handle hashing ─────────────────────────

import hashlib

PII_EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+', re.IGNORECASE)
# Phone numbers only — anchored on a phone-plausible prefix (+country, a 0 trunk,
# or a parenthesised area code) so we do NOT eat year ranges ("2024-2025"), vote
# counts ("22120000"), budgets, or URL hashes, which saturate intel content.
# The (?<!\d)/(?!\d) guards stop us grabbing a slice out of a longer number.
PII_PHONE_RE = re.compile(
    r'(?<!\d)('
    r'\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{2,4}'   # +254 712 345 678
    r'|0\d{2,3}[-.\s]?\d{3}[-.\s]?\d{3,4}'                    # 0712 345 678 / 0712-345-678
    r'|\(\d{2,4}\)\s?\d{3}[-.\s]?\d{3,4}'                     # (020) 123 4567
    r')(?!\d)'
)
PII_ADDRESS_RE = re.compile(r'(PO\s*Box\s+\d+|P\.?O\.?\s*Box\s+\d+|Box\s+\d+\s*[-,\s]+\d{5})', re.IGNORECASE)


def has_pii(text: str) -> bool:
    if not text:
        return False
    return bool(PII_EMAIL_RE.search(text) or PII_PHONE_RE.search(text) or PII_ADDRESS_RE.search(text))


def strip_pii(text: str) -> str:
    if not text:
        return text
    text = PII_EMAIL_RE.sub('[REDACTED EMAIL]', text)
    text = PII_PHONE_RE.sub('[REDACTED PHONE]', text)
    text = PII_ADDRESS_RE.sub('[REDACTED ADDRESS]', text)
    return text


def hash_handle(handle: str) -> str:
    if not handle:
        return ''
    return hashlib.sha256(handle.encode()).hexdigest()[:12]


def safe_log_handle(handle: str) -> str:
    return f'h:{hash_handle(handle)}' if handle else '<none>'


def scrub_post_content(content: str) -> str:
    """Remove PII from post content before storage. Returns (scrubbed, had_pii)."""
    if not content:
        return content, False
    had = has_pii(content)
    return strip_pii(content), had


ALLOWED_COLLECTOR_ACTIONS = {'collect', 'read'}

PASSIVE_ONLY_MSG = (
    'Passive-only policy: collectors may only read/collect.'
    ' Posting, replying, following, and voting are prohibited.'
)
