"""neuroA2A channel adapter for the Mathia travel agent marketplace listing.

Architecture (v2 - LLM-first, deterministic normalization):
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Quick safety pre-scan: booking/payment keywords -> early handoff response.
2. LLM-first structured intent extraction with a focused travel-action schema.
3. Deterministic normalization of LLM output (dates, city defaults, param cleanup).
4. Deterministic fallback only if the LLM call fails or times out.
5. Safety filter: block stateful actions; redirect trip-planning to safe searches.
6. Missing-slot clarification: one helpful question when required params are absent.
7. Execute search through the same travel connectors the main Mathia stack uses.

This design treats Neuro as a channel adapter (like WhatsApp or web chat), not
as a separate custom agent brain.  The intelligence lives in the LLM extraction
layer; the deterministic helpers only *normalise*, they never *guess intent*.

Design decisions:
- LLM-first because typos, casual phrasing, and indirect language ("can you get
  me...", "I want a beach trip...") are the normal case for Neuro users.
- Deterministic normalisation keeps the LLM prompt simple and focused - date
  resolution, default origin inference, and param cleanup stay in code.
- We deliberately avoid the shared `parse_intent` / `MCPRouter` path because
  those are Redis-backed and can time out in Railway's free tier.  Neuro stays
  self-contained and stateless.
- Provider errors (no results, missing credentials) are returned as successful
  agent responses when the user's *intent* was understood.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import secrets
import time
from calendar import monthrange
from datetime import date, timedelta
from typing import Any

from asgiref.sync import async_to_sync, sync_to_async
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orchestration.llm_client import get_llm_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_ACTIONS: set[str] = {
    "search_buses",
    "search_hotels",
    "search_flights",
    "search_transfers",
    "search_events",
}

STATE_ACTIONS: set[str] = {
    "add_to_itinerary",
    "book_travel_item",
    "create_itinerary",
    "remove_from_itinerary",
    "view_itinerary",
}

KENYAN_FLIGHT_CITIES: set[str] = {
    "nairobi", "kisumu", "mombasa", "diani", "eldoret", "malindi", "lamu",
}

KNOWN_TRAVEL_CITIES: tuple[str, ...] = (
    "nairobi",
    "kisumu",
    "mombasa",
    "diani",
    "eldoret",
    "malindi",
    "lamu",
    "nakuru",
    "naivasha",
    "dubai",
    "london",
    "paris",
    "kampala",
    "kigali",
    "dar es salaam",
    "addis ababa",
    "johannesburg",
    "cape town",
    "lagos",
    "accra",
)

DEFAULT_FLIGHT_ORIGIN: str = "Nairobi"

# ---------------------------------------------------------------------------
# Module-level helpers (easily testable)
# ---------------------------------------------------------------------------

def _is_booking_or_payment_request(prompt: str) -> bool:
    """Quick pre-scan for booking/payment intent before any LLM call.

    Returns True when the prompt clearly indicates a booking/payment action
    rather than a search.  "book a flight" alone is ambiguous, but "book
    the cheapest flight" or "pay for" are clearly transactional.
    """
    lowered = prompt.lower()

    # Strong financial/transactional signals
    strong = {"pay", "payment", "purchase", "checkout", "refund", "cancel"}
    has_strong = bool(strong & set(lowered.split()))

    # "book the", "reserve the", "book my" etc. -> transactional
    booking_phrases = (
        "book the", "book my", "book this", "book it",
        "reserve the", "reserve my", "reserve this",
        "purchase the", "purchase my",
        "confirm the", "confirm my",
        "save the", "save my",
    )
    has_booking_phrase = any(p in lowered for p in booking_phrases)

    return has_strong or has_booking_phrase


def _parse_relative_dates(text: str) -> list[str]:
    """Extract ISO-format dates including relative expressions.

    Returns YYYY-MM-DD strings resolved against date.today().
    """
    dates: list[str] = []
    iso_matches = re.findall(r"\b20\d{2}-\d{2}-\d{2}\b", text)
    for d in iso_matches:
        if d not in dates:
            dates.append(d)

    lowered = text.lower()
    today = date.today()

    if "tomorrow" in lowered or "tommorow" in lowered:
        d = (today + timedelta(days=1)).isoformat()
        if d not in dates:
            dates.append(d)

    if re.search(r"\btoday\b", lowered):
        d = today.isoformat()
        if d not in dates:
            dates.append(d)

    if "next weekend" in lowered:
        days_until_sat = (5 - today.weekday()) % 7 or 7
        sat = (today + timedelta(days=days_until_sat)).isoformat()
        sun = (today + timedelta(days=days_until_sat + 1)).isoformat()
        if sat not in dates:
            dates.append(sat)
        if sun not in dates:
            dates.append(sun)

    if "next month" in lowered:
        y = today.year + (1 if today.month == 12 else 0)
        m = 1 if today.month == 12 else today.month + 1
        d = date(y, m, 1).isoformat()
        if d not in dates:
            dates.append(d)

    natural = [
        r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
        r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
        r"dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b",
        r"\b\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|"
        r"jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
        r"nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b",
    ]
    for pat in natural:
        for match in re.findall(pat, text, flags=re.IGNORECASE):
            try:
                from dateutil import parser
                parsed = parser.parse(match, fuzzy=True).date().isoformat()
            except Exception:
                continue
            if parsed not in dates:
                dates.append(parsed)

    month_range = re.search(
        r"\b(?P<month>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|"
        r"jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
        r"nov(?:ember)?|dec(?:ember)?)\s+(?P<year>20\d{2})\b",
        text,
        flags=re.IGNORECASE,
    )
    if month_range and not dates:
        try:
            from dateutil import parser
            parsed = parser.parse(
                f"1 {month_range['month']} {month_range['year']}"
            )
            y, m = parsed.year, parsed.month
            last_day = monthrange(y, m)[1]
            start = date(y, m, 1).isoformat()
            end = date(y, m, last_day).isoformat()
            if start not in dates:
                dates.append(start)
            if end not in dates:
                dates.append(end)
        except Exception:
            pass

    return dates


def _extract_destination(text: str) -> str:
    """Heuristic destination extraction from free text."""
    patterns: list[str] = [
        r"\bplan(?:\s+(?:a|an|my))?\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,60}?)\s+(?:trip|itinerary|travel)\b",
        r"\b(?:trip|itinerary|travel)\s+(?:to|in|for)\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,60})",
        r"\b(?:hotels?|events?|flights?|buses?|transfers?|stay|accommodation|lodging)\s+(?:in|to|for)\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,60})",
        r"\b(?:somewhere|place|places)\s+to\s+stay\s+(?:in|near|around)\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,60})",
        r"\b(?:what\s+can\s+i\s+do|things\s+to\s+do|activities|events)\s+(?:in|near|around)\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,60})",
        r"\b(?:beach|safari|city|weekend)\s+trip\s+(?:to|in|for)\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,60})",
        r"\bto\s+(?P<dest>[A-Za-z][A-Za-z\s'-]{1,40})(?:\s+(?:tomorrow|tommorow|today|next|this|on|in)\b|[,.]|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            return _clean_place_name(m.group("dest"))
    return ""


def _clean_place_name(value: Any) -> str:
    """Strip temporal and connector words accidentally captured as a place."""
    cleaned = str(value or "").strip(" ,.;?!")
    if not cleaned:
        return ""

    stop_words = (
        "on",
        "for",
        "from",
        "returning",
        "with",
        "at",
        "in",
        "during",
        "between",
        "next",
        "this",
        "today",
        "tomorrow",
        "tommorow",
        "weekend",
        "month",
        "jan",
        "january",
        "feb",
        "february",
        "mar",
        "march",
        "apr",
        "april",
        "may",
        "jun",
        "june",
        "jul",
        "july",
        "aug",
        "august",
        "sep",
        "sept",
        "september",
        "oct",
        "october",
        "nov",
        "november",
        "dec",
        "december",
    )
    stop_pattern = r"\b(?:" + "|".join(re.escape(word) for word in stop_words) + r")\b"
    cleaned = re.split(stop_pattern, cleaned, maxsplit=1, flags=re.IGNORECASE)[0]
    return cleaned.strip(" ,.;?!")


def _extract_known_city_pair(text: str) -> tuple[str, str] | None:
    lowered = text.lower()
    matches: list[tuple[int, str]] = []
    for city in KNOWN_TRAVEL_CITIES:
        match = re.search(rf"\b{re.escape(city)}\b", lowered)
        if match:
            matches.append((match.start(), city))
    matches.sort()
    if len(matches) < 2:
        return None
    return matches[0][1].title(), matches[1][1].title()


def _extract_guest_count(text: str) -> int:
    m = re.search(
        r"\b(?:for\s+)?(?P<count>\d{1,2})\s+(?:guest|guests|person|people|traveler|travelers)\b",
        text,
        flags=re.IGNORECASE,
    )
    if not m:
        return 1
    try:
        return max(1, int(m.group("count")))
    except (TypeError, ValueError):
        return 1


def _looks_like_travel_request(prompt: str) -> bool:
    lowered = prompt.lower()
    travel_markers = (
        "flight",
        "flights",
        "airfare",
        "air ticket",
        "fly",
        "hotel",
        "hotels",
        "stay",
        "accommodation",
        "trip",
        "itinerary",
        "travel",
        "bus",
        "buses",
        "transfer",
        "events",
        "things to do",
        "what can i do",
    )
    return any(marker in lowered for marker in travel_markers)


# ---------------------------------------------------------------------------
# LLM travel-intent extraction (primary intelligence)
# ---------------------------------------------------------------------------

TRAVEL_INTENT_SYSTEM_PROMPT = """\
You are a travel-intent extractor for Mathia's NeuroA2A marketplace listing.

Your only job: parse the user's travel request into structured JSON.
Choose exactly ONE action from this list:
- search_flights
- search_hotels
- search_buses
- search_transfers
- search_events
- create_itinerary
- general_chat

Parameter schema (use these exact names):
- search_flights: origin, destination, departure_date (required), return_date (optional), passengers (default 1), cabin_class (default "economy")
- search_hotels: location, check_in_date, check_out_date, guests (default 1), budget_ksh (optional)
- search_buses: origin, destination, travel_date (required), passengers (default 1)
- search_transfers: origin, destination, travel_date (required), passengers (default 1)
- search_events: location, start_date (optional), end_date (optional), category (optional)
- create_itinerary: destination, start_date (optional), end_date (optional), guests (default 1)

Rules:
- Extract dates in YYYY-MM-DD format when the user supplies explicit dates.
- For relative dates ("tomorrow", "next weekend", "next month"), include the raw
  expression as the date value AND list the field in missing_slots so the
  normalizer can resolve it.
- If a required field is truly missing, keep the action, list it in missing_slots,
  and provide exactly ONE clarifying question.
- Never choose booking, payment, or mutation actions (book_travel_item,
  add_to_itinerary, remove_from_itinerary, view_itinerary). If the user asks to
  book/pay/cancel, still classify it as the corresponding search action with a
  clarifying_question that explains the handoff.
- Use general_chat ONLY when the prompt is clearly not a travel request.
- Be confident: a casual "get me a flight to X" is search_flights.
- "beach trip", "safari trip", "weekend trip" -> create_itinerary.
- "what can I do in X" -> search_events.

Return ONLY valid JSON, no markdown fences:
{"action":"search_flights","confidence":0.95,"parameters":{...},"missing_slots":[],"clarifying_question":"","raw_query":"..."}\
"""


async def _llm_extract_travel_intent(
    prompt: str, user_id: int
) -> dict[str, Any] | None:
    """LLM-first travel intent extraction.

    Returns a structured intent dict or None if the LLM call fails.
    """
    user_message = (
        f"User prompt: {prompt}\n\n"
        "Extract the travel intent as JSON."
    )
    try:
        llm = get_llm_client()
        response_text = await llm.generate_text(
            system_prompt=TRAVEL_INTENT_SYSTEM_PROMPT,
            user_prompt=user_message,
            temperature=0.0,
            max_tokens=600,
            json_mode=True,
            user_id=user_id,
            model_role="planner",
        )
        raw = llm.extract_json(response_text)
    except Exception:
        logger.exception("neuroA2A LLM intent extraction failed")
        return None

    if not isinstance(raw, dict) or "action" not in raw:
        return None

    action = str(raw.get("action") or "").strip()
    allowed = ALLOWED_ACTIONS | {"create_itinerary", "general_chat"}
    if action not in allowed:
        return None

    params = raw.get("parameters")
    if not isinstance(params, dict):
        params = {}

    try:
        confidence = max(0.0, min(1.0, float(raw.get("confidence", 0.8) or 0.8)))
    except (TypeError, ValueError):
        confidence = 0.8

    missing: list[str] = raw.get("missing_slots") or []
    if not isinstance(missing, list):
        missing = []

    return {
        "action": action,
        "confidence": confidence,
        "parameters": dict(params),
        "missing_slots": missing,
        "clarifying_question": str(raw.get("clarifying_question") or ""),
        "raw_query": str(raw.get("raw_query") or prompt),
    }


# ---------------------------------------------------------------------------
# Deterministic normalisation (post-LLM or fallback)
# ---------------------------------------------------------------------------

def _normalize_travel_intent(
    intent: dict[str, Any], prompt: str
) -> dict[str, Any]:
    """Post-process an intent dict: resolve relative dates, fill defaults,
    clean up parameter aliases, and recompute missing slots.

    This is pure normalisation - it never changes the intent action.
    """
    params: dict[str, Any] = dict(intent.get("parameters") or {})
    action = str(intent.get("action") or "")

    # --- Resolve relative dates into real ISO dates ---
    all_dates = _parse_relative_dates(prompt)
    date_keys: dict[str, list[str]] = {
        "search_flights": ["departure_date", "return_date"],
        "search_hotels": ["check_in_date", "check_out_date"],
        "search_buses": ["travel_date"],
        "search_transfers": ["travel_date"],
        "search_events": ["start_date", "end_date"],
        "create_itinerary": ["start_date", "end_date"],
    }
    for param_key in date_keys.get(action, []):
        current = str(params.get(param_key) or "").strip()
        # If the LLM returned a non-ISO value, try resolving it
        if current and not re.match(r"^\d{4}-\d{2}-\d{2}$", current):
            resolved = _parse_relative_dates(current)
            if resolved:
                params[param_key] = resolved[0]

    # --- Fill missing date slots from global date extraction ---
    date_map: dict[str, int] = {
        "departure_date": 0, "travel_date": 0, "check_in_date": 0, "start_date": 0,
        "return_date": 1, "check_out_date": 1, "end_date": 1,
    }
    for param_key in date_keys.get(action, []):
        if not params.get(param_key) and all_dates:
            idx = date_map.get(param_key, 0)
            if idx < len(all_dates):
                params[param_key] = all_dates[idx]

    # --- Per-action defaults and aliases ---
    if action == "search_flights":
        if params.get("travel_date") and not params.get("departure_date"):
            params["departure_date"] = params.pop("travel_date")
        if params.get("origin"):
            params["origin"] = _clean_place_name(params.get("origin"))
        if params.get("destination"):
            params["destination"] = _clean_place_name(params.get("destination"))
        params.setdefault("passengers", 1)
        params.setdefault("cabin_class", "economy")
        dest = str(params.get("destination") or "").strip().lower()
        if dest in KENYAN_FLIGHT_CITIES and not params.get("origin"):
            default_origin = str(
                getattr(settings, "NEUROA2A_DEFAULT_FLIGHT_ORIGIN", DEFAULT_FLIGHT_ORIGIN)
                or DEFAULT_FLIGHT_ORIGIN
            )
            params["origin"] = default_origin

    elif action == "search_buses":
        if params.get("departure_date") and not params.get("travel_date"):
            params["travel_date"] = params.pop("departure_date")
        if params.get("origin"):
            params["origin"] = _clean_place_name(params.get("origin"))
        if params.get("destination"):
            params["destination"] = _clean_place_name(params.get("destination"))
        params.setdefault("passengers", 1)

    elif action == "search_hotels":
        if params.get("location"):
            params["location"] = _clean_place_name(params.get("location"))
        params.setdefault("guests", 1)

    elif action == "search_transfers":
        if params.get("origin"):
            params["origin"] = _clean_place_name(params.get("origin"))
        if params.get("destination"):
            params["destination"] = _clean_place_name(params.get("destination"))
        params.setdefault("passengers", 1)

    elif action == "create_itinerary":
        if params.get("location") and not params.get("destination"):
            params["destination"] = params.pop("location")
        if params.get("destination"):
            params["destination"] = _clean_place_name(params.get("destination"))
        params.setdefault("guests", 1)

    elif action == "search_events":
        if params.get("location"):
            params["location"] = _clean_place_name(params.get("location"))

    # --- Recompute missing slots ---
    required: dict[str, list[str]] = {
        "search_flights": ["origin", "destination", "departure_date"],
        "search_hotels": ["location", "check_in_date", "check_out_date"],
        "search_buses": ["origin", "destination", "travel_date"],
        "search_transfers": ["origin", "destination", "travel_date"],
        "search_events": ["location"],
        "create_itinerary": ["destination"],
    }
    actual_missing = [
        s for s in required.get(action, []) if not params.get(s)
    ]

    return {
        "action": action,
        "confidence": float(intent.get("confidence", 0.8)),
        "parameters": params,
        "missing_slots": actual_missing,
        "clarifying_question": str(intent.get("clarifying_question") or ""),
        "raw_query": str(intent.get("raw_query") or prompt),
    }


# ---------------------------------------------------------------------------
# Deterministic fallback (used only when LLM is unavailable)
# ---------------------------------------------------------------------------

def _deterministic_fallback(prompt: str) -> dict[str, Any] | None:
    """Rule-based fallback intent parser.

    Only invoked when the LLM call fails.  Deliberately simpler than v1's
    _deterministic_intent - it focuses on the most common patterns and
    returns a best-effort intent with missing_slots.
    """
    text = " ".join((prompt or "").split())
    lowered = text.lower()
    dates = _parse_relative_dates(text)

    # Flight detection
    if any(word in lowered for word in ("flight", "flights", "airfare", "fly", "air ticket")):
        dest = _extract_destination(text)
        origin = ""
        route_m = re.search(
            r"\bfrom\s+(?P<o>[A-Za-z][A-Za-z\s'-]{1,40}?)\s+to\s+(?P<d>[A-Za-z][A-Za-z\s'-]{1,40})(?:\s+(?:on|for|from|returning|with|at|in|next|this)\b|[,.]|$)",
            text, flags=re.IGNORECASE,
        )
        if route_m:
            origin = _clean_place_name(route_m.group("o"))
            dest = _clean_place_name(route_m.group("d"))
        if not origin or not dest:
            city_pair = _extract_known_city_pair(text)
            if city_pair:
                origin, dest = city_pair
        if dest and dest.lower() in KENYAN_FLIGHT_CITIES and not origin:
            origin = str(
                getattr(settings, "NEUROA2A_DEFAULT_FLIGHT_ORIGIN", DEFAULT_FLIGHT_ORIGIN)
                or DEFAULT_FLIGHT_ORIGIN
            )

        params: dict[str, Any] = {
            "destination": dest or "",
            "passengers": _extract_guest_count(text),
            "cabin_class": "economy",
        }
        if origin:
            params["origin"] = origin
        if dates:
            params["departure_date"] = dates[0]
            if len(dates) >= 2:
                params["return_date"] = dates[1]

        missing = [k for k in ["origin", "destination", "departure_date"] if not params.get(k)]
        return {
            "action": "search_flights",
            "confidence": 0.85,
            "parameters": params,
            "missing_slots": missing,
            "clarifying_question": "",
            "raw_query": prompt,
        }

    # Hotel / stay detection
    stay_words = {"hotel", "hotels", "stay", "accommodation", "lodging"}
    if stay_words & set(lowered.split()):
        dest = _extract_destination(text)
        params: dict[str, Any] = {"location": dest or "", "guests": _extract_guest_count(text)}
        if len(dates) >= 2:
            params["check_in_date"] = dates[0]
            params["check_out_date"] = dates[1]
        elif len(dates) == 1:
            params["check_in_date"] = dates[0]
        return {
            "action": "search_hotels",
            "confidence": 0.85,
            "parameters": params,
            "missing_slots": [k for k in ["location", "check_in_date", "check_out_date"] if not params.get(k)],
            "clarifying_question": "",
            "raw_query": prompt,
        }

    # Trip planning
    if any(w in lowered for w in ("plan", "trip", "itinerary")):
        dest = _extract_destination(text)
        params = {"destination": dest or "", "guests": _extract_guest_count(text)}
        if dates:
            params["start_date"] = dates[0]
            if len(dates) >= 2:
                params["end_date"] = dates[1]
        return {
            "action": "create_itinerary",
            "confidence": 0.85,
            "parameters": params,
            "missing_slots": [],
            "clarifying_question": "",
            "raw_query": prompt,
        }

    # Events / things to do
    if any(p in lowered for p in ("what can i do", "things to do", "events", "activities", "concerts")):
        dest = _extract_destination(text)
        params = {"location": dest or ""}
        if dates:
            params["start_date"] = dates[0]
        return {
            "action": "search_events",
            "confidence": 0.85,
            "parameters": params,
            "missing_slots": ["location"] if not dest else [],
            "clarifying_question": "",
            "raw_query": prompt,
        }

    return None


# ---------------------------------------------------------------------------
# Clarification helpers
# ---------------------------------------------------------------------------

def _clarification_for_missing_slots(
    action: str, intent: dict[str, Any]
) -> str:
    """Build a helpful, contextual one-question response.

    Never returns a generic "please include search type" message.
    """
    question = str(intent.get("clarifying_question") or "").strip()
    if question:
        return question

    params = intent.get("parameters") if isinstance(intent.get("parameters"), dict) else {}
    missing = intent.get("missing_slots") if isinstance(intent.get("missing_slots"), list) else []

    if not missing:
        return "Could you provide more details about your travel request?"

    slot = str(missing[0]).replace("_", " ")

    if action == "search_flights":
        route = ""
        if params.get("origin") and params.get("destination"):
            route = f" from {params['origin']} to {params['destination']}"
        elif params.get("destination"):
            route = f" to {params['destination']}"
        if "departure_date" in missing:
            return f"I can search flights{route}. What date would you like to depart?"
        if "origin" in missing:
            return (
                f"I can search flights to {params.get('destination', 'your destination')}. "
                "Where are you flying from?"
            )
        if "destination" in missing:
            return "Where would you like to fly to?"

    if action == "search_hotels":
        loc = params.get("location", "")
        if "check_in_date" in missing or "check_out_date" in missing:
            return (
                f"I can search places to stay{' in ' + loc if loc else ''}. "
                "What are your check-in and check-out dates?"
            )
        if "location" in missing:
            return "Where are you looking to stay?"

    if action == "search_buses":
        if "travel_date" in missing:
            return "What date would you like to travel?"
        if "origin" in missing or "destination" in missing:
            return "Which route are you looking for? Please share the origin and destination."

    label = action.replace("_", " ")
    return f"For {label}, I still need {slot}. Could you share that?"


# ---------------------------------------------------------------------------
# API View
# ---------------------------------------------------------------------------

class NeuroA2ATravelRunView(APIView):
    """Run the travel agent through neuroA2A's proxy request contract."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    # -- HTTP entry point ---------------------------------------------------

    def post(self, request):
        started = time.perf_counter()

        auth_error = self._authenticate(request)
        if auth_error:
            return auth_error

        payload: dict[str, Any] = request.data if isinstance(request.data, dict) else {}
        prompt = str(payload.get("user_prompt") or "").strip()
        if not prompt:
            return Response(
                self._error("user_prompt is required", started), status=400,
            )

        ctx = payload.get("context") or {}
        if not isinstance(ctx, dict):
            return Response(
                self._error("context must be an object when provided", started),
                status=400,
            )

        try:
            timeout = min(max(int(payload.get("timeout_seconds") or 30), 1), 30)
        except (TypeError, ValueError):
            timeout = 30

        try:
            result = async_to_sync(self._run_agent)(prompt, ctx, timeout)
        except asyncio.TimeoutError:
            return Response(self._error("travel agent timed out", started), status=504)
        except Exception as exc:
            logger.exception("neuroA2A travel run failed")
            return Response(self._error(str(exc), started), status=500)

        status_code = 200 if result.get("status") == "success" else 400
        return Response(
            self._format_response(result, prompt, started), status=status_code,
        )

    # -- Auth ---------------------------------------------------------------

    def _authenticate(self, request) -> Response | None:
        expected = str(getattr(settings, "NEUROA2A_SHARED_TOKEN", "") or "")
        if not expected:
            return Response(
                self._error("neuroA2A endpoint is not configured", time.perf_counter()),
                status=503,
            )
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return Response(
                self._error("missing bearer token", time.perf_counter()), status=403,
            )
        submitted = header[len("Bearer "):]
        if not secrets.compare_digest(submitted, expected):
            return Response(
                self._error("invalid bearer token", time.perf_counter()), status=403,
            )
        return None

    async def _run_agent(
        self, prompt: str, context: dict[str, Any], timeout_seconds: int
    ) -> dict[str, Any]:
        return await asyncio.wait_for(
            self._route_prompt(prompt, context), timeout=timeout_seconds,
        )

    # -- Main routing -------------------------------------------------------

    async def _route_prompt(
        self, prompt: str, context: dict[str, Any]
    ) -> dict[str, Any]:
        """LLM-first routing with deterministic fallback.

        Flow:
        1. Structured context passthrough (caller provided action+params).
        2. Quick booking/payment pre-scan -> early handoff.
        3. LLM intent extraction (primary).
        4. Deterministic fallback (only if LLM fails).
        5. Normalize intent (dates, defaults, slot recomputation).
        6. Safety filter: block stateful actions, redirect trip planning.
        7. Missing-slot clarification.
        8. Execute search via connector.
        9. Provider errors -> success when intent was understood.
        """
        user_id = await self._service_user_id()
        if not user_id:
            return {"status": "error", "result": "Could not resolve the neuroA2A travel service user."}

        run_ctx = {"user_id": user_id, "room_id": None, "source": "neuroa2a"}

        # 1. Structured passthrough (caller-supplied action + params)
        ctx_action = context.get("action")
        ctx_params = context.get("parameters")
        if isinstance(ctx_action, str) and isinstance(ctx_params, dict):
            intent: dict[str, Any] = {
                "action": ctx_action,
                "confidence": 1.0,
                "parameters": dict(ctx_params),
                "missing_slots": [],
                "clarifying_question": "",
                "raw_query": prompt,
            }
        else:
            # 2. Quick booking/payment pre-scan
            if _is_booking_or_payment_request(prompt):
                return self._booking_handoff_response(prompt)

            # 3. LLM-first extraction
            intent = await _llm_extract_travel_intent(prompt, user_id)

            # 4. Deterministic fallback
            if (
                not intent
                or (
                    str(intent.get("action") or "") == "general_chat"
                    and _looks_like_travel_request(prompt)
                )
            ):
                intent = _deterministic_fallback(prompt)

            # Still nothing -> graceful message
            if not intent:
                return {
                    "status": "success",
                    "result": (
                        "I can help with travel searches for flights, hotels, buses, "
                        "transfers, and events. Try something like: 'Find flights to "
                        "Kisumu tomorrow' or 'Hotels in Nairobi next weekend'."
                    ),
                }

        # 5. Normalize (dates, defaults, slot recomputation)
        intent = _normalize_travel_intent(intent, prompt)

        action = str(intent.get("action") or "").strip()

        # 6. Safety filter
        if action in STATE_ACTIONS:
            if action == "create_itinerary":
                return await self._handle_trip_planning(intent, run_ctx)
            return self._booking_handoff_response(prompt)

        if action not in ALLOWED_ACTIONS:
            return {
                "status": "success",
                "result": (
                    "I can help with travel searches for flights, hotels, buses, "
                    "transfers, and events. Try including your destination and dates."
                ),
            }

        # 7. Missing-slot clarification
        missing = intent.get("missing_slots")
        if isinstance(missing, list) and missing:
            return {
                "status": "success",
                "result": _clarification_for_missing_slots(action, intent),
                "action": action,
            }

        # 8. Execute search
        result = await self._execute_search(
            action, intent.get("parameters") or {}, run_ctx,
        )

        # 9. Provider error -> success when intent was understood
        metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
        provider_error = str(metadata.get("error") or "").strip()
        if provider_error and _is_user_input_error(provider_error):
            return {
                "status": "error",
                "result": provider_error or "Travel search could not be completed.",
                "action": action,
                "raw": result,
            }

        return {
            "status": "success",
            "result": self._human_result(action, result),
            "action": action,
            "raw": result,
        }

    # -- Booking / payment handoff ------------------------------------------

    def _booking_handoff_response(self, prompt: str) -> dict[str, Any]:
        """Return a safe, helpful handoff when the user asks to book/pay."""
        dest = _extract_destination(prompt) or "your destination"
        lowered = prompt.lower()
        if "flight" in lowered or "fly" in lowered:
            suggestion = f"Find flights to {dest}"
        elif "hotel" in lowered or "stay" in lowered:
            suggestion = f"Find hotels in {dest}"
        else:
            suggestion = f"Search travel options to {dest}"

        return {
            "status": "success",
            "result": (
                "This marketplace version of Mathia is search-only. "
                "I can search flights, hotels, buses, transfers, and events, "
                f"but booking and payments stay inside the full Mathia app. "
                f"Try a prompt like: '{suggestion}'"
            ),
        }

    # -- Trip planning (create_itinerary -> safe searches) -------------------

    async def _handle_trip_planning(
        self, intent: dict[str, Any], context: dict[str, Any]
    ) -> dict[str, Any]:
        """Convert a create_itinerary intent into safe search-only results."""
        params = intent.get("parameters") if isinstance(intent.get("parameters"), dict) else {}
        destination = params.get("destination") or params.get("location") or ""
        start_date = params.get("start_date") or params.get("check_in_date") or ""
        end_date = params.get("end_date") or params.get("check_out_date") or ""
        guests = params.get("guests") or params.get("passengers") or 1

        if not destination:
            return {
                "status": "success",
                "result": (
                    "I can start with safe travel searches, but I need a destination. "
                    "Try: 'Find hotels and events in Nairobi from 2026-08-10 to 2026-08-12.'"
                ),
                "action": "create_itinerary",
            }

        searches: list[tuple[str, dict[str, Any]]] = []
        if start_date and end_date:
            searches.append((
                "search_hotels",
                {
                    "location": destination,
                    "check_in_date": start_date,
                    "check_out_date": end_date,
                    "guests": guests,
                },
            ))
        searches.append((
            "search_events",
            {"location": destination, "start_date": start_date, "end_date": end_date},
        ))

        sections: list[str] = []
        raw: dict[str, Any] = {}
        for s_action, s_params in searches:
            result = await self._execute_search(s_action, s_params, context)
            raw[s_action] = result
            label = s_action.replace("search_", "").title()
            sections.append(f"{label}:\n{self._human_result(s_action, result)}")

        return {
            "status": "success",
            "result": (
                "I can't create or save an itinerary from NeuroA2A, but I ran safe "
                f"travel searches for {destination}.\n\n" + "\n\n".join(sections)
            ),
            "action": "create_itinerary",
            "raw": raw,
        }

    # -- Search execution ---------------------------------------------------

    async def _execute_search(
        self, action: str, parameters: dict[str, Any], context: dict[str, Any]
    ) -> dict[str, Any]:
        connector = self._connector_for_action(action)
        params = dict(parameters or {})
        params.setdefault("action", action)
        return await connector._fetch(params, context)

    def _connector_for_action(self, action: str):
        if action == "search_buses":
            from orchestration.connectors.travel_buses_connector import TravelBusesConnector
            return TravelBusesConnector()
        if action == "search_hotels":
            from orchestration.connectors.travel_hotels_connector import TravelHotelsConnector
            return TravelHotelsConnector()
        if action == "search_flights":
            from orchestration.connectors.travel_flights_connector import TravelFlightsConnector
            return TravelFlightsConnector()
        if action == "search_transfers":
            from orchestration.connectors.travel_transfers_connector import TravelTransfersConnector
            return TravelTransfersConnector()
        if action == "search_events":
            from orchestration.connectors.travel_events_connector import TravelEventsConnector
            return TravelEventsConnector()
        raise ValueError(f"Unsupported travel action: {action}")

    # -- Service user -------------------------------------------------------

    async def _service_user_id(self) -> int | None:
        raw = getattr(settings, "NEUROA2A_TRAVEL_USER_ID", "")
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass

        def _get_or_create():
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user, created = User.objects.get_or_create(
                username="neuroa2a_travel",
                defaults={"email": "neuroa2a-travel@mathia.local"},
            )
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
            return user.id

        return await sync_to_async(_get_or_create)()

    # -- Formatting ---------------------------------------------------------

    def _human_result(self, action: str, routed: dict[str, Any]) -> str:
        data = routed if isinstance(routed, dict) else {}
        results = data.get("results")
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        if metadata.get("error") and not results:
            return str(metadata["error"])
        if isinstance(results, list):
            count = len(results)
            label = action.replace("search_", "")
            summary = f"Found {count} {label} option{'s' if count != 1 else ''}."
            if metadata.get("provider"):
                summary += f" Provider: {metadata['provider']}."
            return summary + "\n\n" + json.dumps(results[:5], default=str, indent=2)
        return json.dumps(data or routed, default=str, indent=2)

    def _format_response(
        self, result: dict[str, Any], prompt: str, started: float
    ) -> dict[str, Any]:
        output = str(result.get("result") or "")
        return {
            "status": "success" if result.get("status") == "success" else "error",
            "result": output,
            "usage": {
                "tokens_used": self._estimate_tokens(prompt, output),
                "processing_time_ms": int((time.perf_counter() - started) * 1000),
            },
        }

    def _error(self, message: str, started: float) -> dict[str, Any]:
        return {
            "status": "error",
            "result": message,
            "usage": {
                "tokens_used": self._estimate_tokens(message, ""),
                "processing_time_ms": int((time.perf_counter() - started) * 1000),
            },
        }

    @staticmethod
    def _estimate_tokens(*parts: str) -> int:
        text = " ".join(p or "" for p in parts)
        return max(1, len(text) // 4)


def _is_user_input_error(message: str) -> bool:
    lowered = message.lower()
    return lowered.startswith("missing required") or lowered.startswith("invalid ")
