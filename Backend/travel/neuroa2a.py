"""neuroA2A adapter endpoint for the Mathia travel agent listing."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import secrets
import time
from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Dict

from asgiref.sync import async_to_sync, sync_to_async
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orchestration.intent_parser import parse_intent
from orchestration.llm_client import get_llm_client

logger = logging.getLogger(__name__)

ALLOWED_ACTIONS = {
    "search_buses",
    "search_hotels",
    "search_flights",
    "search_transfers",
    "search_events",
}
KNOWN_TRAVEL_CITIES = (
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
STATEFUL_ACTIONS = {
    "add_to_itinerary",
    "book_travel_item",
    "create_itinerary",
    "remove_from_itinerary",
    "view_itinerary",
}


class NeuroA2ATravelRunView(APIView):
    """Run the travel agent through neuroA2A's proxy request contract."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        started = time.perf_counter()

        auth_error = self._authenticate(request)
        if auth_error:
            return auth_error

        payload = request.data if isinstance(request.data, dict) else {}
        prompt = str(payload.get("user_prompt") or "").strip()
        if not prompt:
            return Response(
                self._error("user_prompt is required", started),
                status=400,
            )

        context = payload.get("context") or {}
        if not isinstance(context, dict):
            return Response(
                self._error("context must be an object when provided", started),
                status=400,
            )

        try:
            timeout_seconds = min(max(int(payload.get("timeout_seconds") or 30), 1), 30)
        except (TypeError, ValueError):
            timeout_seconds = 30

        try:
            result = async_to_sync(self._run_agent)(prompt, context, timeout_seconds)
        except asyncio.TimeoutError:
            return Response(self._error("travel agent timed out", started), status=504)
        except Exception as exc:
            logger.exception("neuroA2A travel run failed")
            return Response(self._error(str(exc), started), status=500)

        status_code = 200 if result.get("status") == "success" else 400
        return Response(self._format_response(result, prompt, started), status=status_code)

    def _authenticate(self, request):
        expected_token = str(getattr(settings, "NEUROA2A_SHARED_TOKEN", "") or "")
        if not expected_token:
            return Response(
                self._error("neuroA2A endpoint is not configured", time.perf_counter()),
                status=503,
            )

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return Response(self._error("missing bearer token", time.perf_counter()), status=403)

        submitted = auth_header[len("Bearer ") :]
        if not secrets.compare_digest(submitted, expected_token):
            return Response(self._error("invalid bearer token", time.perf_counter()), status=403)
        return None

    async def _run_agent(self, prompt: str, context: Dict[str, Any], timeout_seconds: int) -> Dict[str, Any]:
        return await asyncio.wait_for(
            self._route_prompt(prompt, context),
            timeout=timeout_seconds,
        )

    async def _route_prompt(self, prompt: str, context: Dict[str, Any]) -> Dict[str, Any]:
        service_user_id = await self._service_user_id()
        if not service_user_id:
            return {
                "status": "error",
                "result": "Could not resolve the neuroA2A travel service user.",
            }

        action = context.get("action")
        parameters = context.get("parameters")
        if isinstance(action, str) and isinstance(parameters, dict):
            intent = {
                "action": action,
                "confidence": 1.0,
                "parameters": parameters,
                "missing_slots": [],
                "clarifying_question": "",
                "raw_query": prompt,
            }
        else:
            intent = self._deterministic_intent(prompt)
            if not intent:
                intent = await self._llm_travel_intent(prompt, service_user_id)
            if not intent:
                intent = await parse_intent(prompt, {"user_id": service_user_id})

        action = str(intent.get("action") or "").strip()
        if action not in ALLOWED_ACTIONS:
            if action == "create_itinerary":
                return await self._handle_trip_planning_intent(
                    intent,
                    {
                        "user_id": service_user_id,
                        "room_id": None,
                        "source": "neuroa2a",
                    },
                )
            if action in STATEFUL_ACTIONS:
                return {
                    "status": "success",
                    "result": (
                        "This marketplace version of Mathia is search-only. It can search flights, hotels, "
                        "buses, transfers, and events, but booking and itinerary changes stay inside Mathia. "
                        "Try a prompt like: 'Find hotels in Nairobi from 2026-08-10 to 2026-08-12 for 1 guest.'"
                    ),
                    "action": action,
                }
            return {
                "status": "success",
                "result": (
                    "I can help with travel searches for flights, hotels, buses, transfers, and events. "
                    "Please include the search type, destination, and dates where relevant."
                ),
                "action": action,
            }

        missing_slots = intent.get("missing_slots")
        if isinstance(missing_slots, list) and missing_slots:
            return {
                "status": "success",
                "result": self._missing_slot_result(action, intent),
                "action": action,
            }

        result = await self._execute_search(
            action,
            intent.get("parameters") or {},
            {
                "user_id": service_user_id,
                "room_id": None,
                "source": "neuroa2a",
            },
        )

        metadata = result.get("metadata", {}) if isinstance(result.get("metadata"), dict) else {}
        provider_error = str(metadata.get("error") or "").strip()
        if not provider_error or not self._is_user_input_error(provider_error):
            return {
                "status": "success",
                "result": self._human_result(action, result),
                "action": action,
                "raw": result,
            }

        return {
            "status": "error",
            "result": provider_error or "Travel search could not be completed.",
            "action": action,
            "raw": result,
        }

    def _deterministic_intent(self, prompt: str) -> Dict[str, Any] | None:
        text = " ".join((prompt or "").split())
        lowered = text.lower()
        dates = self._extract_dates(text)

        if any(word in lowered for word in ("flight", "flights", "airfare", "fly", "air ticket")):
            route = self._extract_route(text)
            if route:
                origin, destination = route
                if not dates:
                    return {
                        "action": "search_flights",
                        "confidence": 1.0,
                        "parameters": {
                            "origin": origin,
                            "destination": destination,
                            "passengers": self._extract_guest_count(text),
                            "cabin_class": "economy",
                        },
                        "missing_slots": ["departure_date"],
                        "clarifying_question": (
                            f"I can search flights from {origin} to {destination}. "
                            "What departure date should I use?"
                        ),
                        "raw_query": prompt,
                    }
                return {
                    "action": "search_flights",
                    "confidence": 1.0,
                    "parameters": {
                        "origin": origin,
                        "destination": destination,
                        "departure_date": dates[0],
                        "return_date": dates[1] if len(dates) >= 2 else "",
                        "passengers": self._extract_guest_count(text),
                        "cabin_class": "economy",
                    },
                    "missing_slots": [],
                    "clarifying_question": "",
                    "raw_query": prompt,
                }

        if any(word in lowered for word in ("hotel", "hotels", "stay", "accommodation", "lodging")):
            destination = self._extract_destination(text, stop_words=("from", "for", "between", "next", "this", "weekend", "tomorrow", "today"))
            if destination and len(dates) >= 2:
                return {
                    "action": "search_hotels",
                    "confidence": 1.0,
                    "parameters": {
                        "location": destination,
                        "check_in_date": dates[0],
                        "check_out_date": dates[1],
                        "guests": self._extract_guest_count(text),
                    },
                    "missing_slots": [],
                    "clarifying_question": "",
                    "raw_query": prompt,
                }
            if destination:
                return {
                    "action": "search_hotels",
                    "confidence": 1.0,
                    "parameters": {
                        "location": destination,
                        "guests": self._extract_guest_count(text),
                    },
                    "missing_slots": ["check_in_date", "check_out_date"],
                    "clarifying_question": (
                        f"I can search places to stay in {destination}. "
                        "What check-in and check-out dates should I use?"
                    ),
                    "raw_query": prompt,
                }

        if any(word in lowered for word in ("plan", "trip", "itinerary")):
            destination = self._extract_destination(text, stop_words=("from", "for", "between", "in", "on", "during"))
            if destination:
                params: Dict[str, Any] = {"destination": destination}
                if len(dates) >= 1:
                    params["start_date"] = dates[0]
                if len(dates) >= 2:
                    params["end_date"] = dates[1]
                params["guests"] = self._extract_guest_count(text)
                return {
                    "action": "create_itinerary",
                    "confidence": 1.0,
                    "parameters": params,
                    "missing_slots": [],
                    "clarifying_question": "",
                    "raw_query": prompt,
                }

        if any(phrase in lowered for phrase in ("what can i do", "things to do", "events", "activities", "concerts")):
            destination = self._extract_destination(text, stop_words=("from", "for", "between", "on", "in"))
            if destination:
                params = {"location": destination}
                if len(dates) >= 1:
                    params["start_date"] = dates[0]
                    params["event_date"] = dates[0]
                if len(dates) >= 2:
                    params["end_date"] = dates[1]
                return {
                    "action": "search_events",
                    "confidence": 1.0,
                    "parameters": params,
                    "missing_slots": [],
                    "clarifying_question": "",
                    "raw_query": prompt,
                }

        return None

    def _extract_dates(self, text: str) -> list[str]:
        dates = re.findall(r"\b20\d{2}-\d{2}-\d{2}\b", text)
        lowered = text.lower()
        today = date.today()

        if "next weekend" in lowered:
            days_until_saturday = (5 - today.weekday()) % 7
            if days_until_saturday == 0:
                days_until_saturday = 7
            saturday = today + timedelta(days=days_until_saturday)
            sunday = saturday + timedelta(days=1)
            return [saturday.isoformat(), sunday.isoformat()]

        if "next month" in lowered:
            year = today.year + (1 if today.month == 12 else 0)
            month = 1 if today.month == 12 else today.month + 1
            month_start = date(year, month, 1)
            if month_start.isoformat() not in dates:
                dates.append(month_start.isoformat())

        natural_patterns = [
            r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b",
            r"\b\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b",
        ]
        for pattern in natural_patterns:
            for match in re.findall(pattern, text, flags=re.IGNORECASE):
                try:
                    from dateutil import parser

                    parsed = parser.parse(match, fuzzy=True).date().isoformat()
                except Exception:
                    continue
                if parsed not in dates:
                    dates.append(parsed)
        month_range = re.search(
            r"\b(?P<month>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?P<year>20\d{2})\b",
            text,
            flags=re.IGNORECASE,
        )
        if month_range and not dates:
            try:
                from dateutil import parser

                parsed = parser.parse(f"1 {month_range.group('month')} {month_range.group('year')}")
                year = parsed.year
                month = parsed.month
                last_day = monthrange(year, month)[1]
                dates.extend([date(year, month, 1).isoformat(), date(year, month, last_day).isoformat()])
            except Exception:
                pass
        return dates

    def _extract_route(self, text: str) -> tuple[str, str] | None:
        route_patterns = [
            r"\bfrom\s+(?P<origin>[A-Za-z][A-Za-z\s'-]{1,60}?)\s+to\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60})(?:\s+(?:on|for|from|returning|with|at|in)\b|[,.]|$)",
        ]
        for pattern in route_patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                origin = self._clean_destination(match.group("origin"), stop_words=("on", "for", "from", "returning", "with", "at", "in", "flight", "flights"))
                destination = self._clean_destination(match.group("destination"), stop_words=("on", "for", "from", "returning", "with", "at", "in", "flight", "flights"))
                if origin and destination:
                    return origin, destination

        city_pair = self._extract_known_city_pair(text)
        if city_pair:
            return city_pair

        match = re.search(
            r"\b(?P<origin>[A-Z][A-Za-z'-]{1,40})\s+to\s+(?P<destination>[A-Z][A-Za-z'-]{1,40})(?:\s+(?:flight|flights|airfare|air ticket|on|for|from|returning|with|at|in)\b|[,.]|$)",
            text,
        )
        if match:
            origin = self._clean_destination(match.group("origin"), stop_words=("on", "for", "from", "returning", "with", "at", "in", "flight", "flights"))
            destination = self._clean_destination(match.group("destination"), stop_words=("on", "for", "from", "returning", "with", "at", "in", "flight", "flights"))
            if origin and destination:
                return origin, destination
        return None

    def _extract_known_city_pair(self, text: str) -> tuple[str, str] | None:
        lowered = text.lower()
        matches = []
        for city in KNOWN_TRAVEL_CITIES:
            match = re.search(rf"\b{re.escape(city)}\b", lowered)
            if match:
                matches.append((match.start(), city))
        matches.sort()
        if len(matches) < 2:
            return None
        origin = matches[0][1].title()
        destination = matches[1][1].title()
        if not origin or not destination:
            return None
        return origin, destination

    async def _llm_travel_intent(self, prompt: str, service_user_id: int) -> Dict[str, Any] | None:
        system_prompt = """You are a travel intent extractor for Mathia's NeuroA2A marketplace listing.

Return ONLY JSON. Choose exactly one action from:
- search_flights
- search_hotels
- search_buses
- search_transfers
- search_events
- create_itinerary
- general_chat

Extract useful travel parameters even when the user is casual or incomplete.

Required parameter names:
- search_flights: origin, destination, departure_date, return_date optional, passengers default 1, cabin_class default economy
- search_hotels: location, check_in_date, check_out_date, guests default 1, budget_ksh optional
- search_buses: origin, destination, travel_date, passengers default 1
- search_transfers: origin, destination, travel_date, passengers default 1
- search_events: location, start_date optional, end_date optional, category optional
- create_itinerary: destination, start_date optional, end_date optional, guests default 1

Normalize explicit dates to YYYY-MM-DD. If a required field is missing, keep the action and list missing_slots.
Never choose booking or mutation actions. Booking, saving, and itinerary edits are outside this listing.
Use general_chat only when the prompt is not a travel request."""
        user_prompt = (
            "Extract the travel intent for this NeuroA2A user prompt.\n\n"
            f"Prompt: {prompt}\n\n"
            "Return this shape: "
            "{\"action\":\"search_flights\",\"confidence\":0.95,\"parameters\":{},"
            "\"missing_slots\":[],\"clarifying_question\":\"\",\"raw_query\":\"...\"}"
        )

        try:
            llm = get_llm_client()
            response_text = await llm.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.0,
                max_tokens=500,
                json_mode=True,
                user_id=service_user_id,
                model_role="planner",
            )
            intent = llm.extract_json(response_text)
        except Exception:
            logger.exception("neuroA2A travel LLM intent extraction failed")
            return None

        return self._normalize_travel_intent(intent, prompt)

    def _normalize_travel_intent(self, intent: Dict[str, Any], prompt: str) -> Dict[str, Any] | None:
        if not isinstance(intent, dict):
            return None

        action = str(intent.get("action") or "").strip()
        allowed = ALLOWED_ACTIONS | {"create_itinerary", "general_chat"}
        if action not in allowed:
            return None

        params = intent.get("parameters")
        if not isinstance(params, dict):
            params = {}
        params = dict(params)

        if action == "search_flights":
            if params.get("travel_date") and not params.get("departure_date"):
                params["departure_date"] = params.pop("travel_date")
            params.setdefault("passengers", 1)
            params.setdefault("cabin_class", "economy")
        elif action == "search_buses":
            if params.get("departure_date") and not params.get("travel_date"):
                params["travel_date"] = params.pop("departure_date")
            params.setdefault("passengers", 1)
        elif action == "search_hotels":
            params.setdefault("guests", 1)
        elif action == "search_transfers":
            params.setdefault("passengers", 1)
        elif action == "create_itinerary":
            if params.get("location") and not params.get("destination"):
                params["destination"] = params.pop("location")
            params.setdefault("guests", 1)

        confidence = intent.get("confidence", 0.8)
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = 0.8

        missing_slots = intent.get("missing_slots")
        if not isinstance(missing_slots, list):
            missing_slots = []

        return {
            "action": action,
            "confidence": max(0.0, min(1.0, confidence)),
            "parameters": params,
            "missing_slots": missing_slots,
            "clarifying_question": str(intent.get("clarifying_question") or ""),
            "raw_query": str(intent.get("raw_query") or prompt),
        }

    def _missing_slot_result(self, action: str, intent: Dict[str, Any]) -> str:
        question = str(intent.get("clarifying_question") or "").strip()
        if question:
            return question

        params = intent.get("parameters") if isinstance(intent.get("parameters"), dict) else {}
        missing = intent.get("missing_slots") if isinstance(intent.get("missing_slots"), list) else []
        missing_text = ", ".join(str(slot).replace("_", " ") for slot in missing) or "one more detail"
        if action == "search_flights":
            route = ""
            if params.get("origin") and params.get("destination"):
                route = f" from {params['origin']} to {params['destination']}"
            return f"I can search flights{route}. Please send {missing_text}."
        if action == "search_hotels":
            location = f" in {params['location']}" if params.get("location") else ""
            return f"I can search places to stay{location}. Please send {missing_text}."
        return f"I understood this as {action.replace('_', ' ')}. Please send {missing_text}."

    def _extract_destination(self, text: str, *, stop_words: tuple[str, ...]) -> str:
        patterns = [
            r"\bplan(?:\s+(?:a|an|my))?\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60}?)\s+(?:trip|itinerary|travel)\b",
            r"\b(?:trip|itinerary|travel)\s+(?:to|in|for)\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60})",
            r"\b(?:hotels?|events?|flights?|buses?|transfers?|stay|accommodation|lodging)\s+(?:in|to|for)\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60})",
            r"\b(?:somewhere|place|places)\s+to\s+stay\s+(?:in|near|around)\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60})",
            r"\b(?:what\s+can\s+i\s+do|things\s+to\s+do|activities|events)\s+(?:in|near|around)\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60})",
            r"\b(?:beach|safari|city|weekend)\s+trip\s+(?:to|in|for)\s+(?P<destination>[A-Za-z][A-Za-z\s'-]{1,60})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                destination = match.group("destination")
                return self._clean_destination(destination, stop_words=stop_words)
        return ""

    def _clean_destination(self, value: str, *, stop_words: tuple[str, ...]) -> str:
        cleaned = value.strip(" ,.;")
        stop_pattern = r"\b(?:" + "|".join(re.escape(word) for word in stop_words) + r")\b"
        cleaned = re.split(stop_pattern, cleaned, maxsplit=1, flags=re.IGNORECASE)[0].strip(" ,.;")
        return cleaned

    def _extract_guest_count(self, text: str) -> int:
        match = re.search(r"\b(?:for\s+)?(?P<count>\d{1,2})\s+(?:guest|guests|person|people|traveler|travelers)\b", text, flags=re.IGNORECASE)
        if not match:
            return 1
        try:
            return max(1, int(match.group("count")))
        except (TypeError, ValueError):
            return 1

    async def _handle_trip_planning_intent(self, intent: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = intent.get("parameters") if isinstance(intent.get("parameters"), dict) else {}
        destination = params.get("destination") or params.get("location")
        start_date = params.get("start_date") or params.get("check_in_date")
        end_date = params.get("end_date") or params.get("check_out_date")
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

        searches = []
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
            {
                "location": destination,
                "start_date": start_date,
                "end_date": end_date,
            },
        ))

        sections = []
        raw = {}
        for search_action, search_params in searches:
            result = await self._execute_search(search_action, search_params, context)
            raw[search_action] = result
            sections.append(f"{search_action.replace('search_', '').title()}:\n{self._human_result(search_action, result)}")

        return {
            "status": "success",
            "result": (
                "I can't create or save an itinerary from NeuroA2A, but I ran safe travel searches "
                f"for {destination}.\n\n" + "\n\n".join(sections)
            ),
            "action": "create_itinerary",
            "raw": raw,
        }

    def _is_user_input_error(self, message: str) -> bool:
        lowered = message.lower()
        return lowered.startswith("missing required") or lowered.startswith("invalid ")

    async def _execute_search(self, action: str, parameters: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        connector = self._connector_for_action(action)
        parameters = dict(parameters or {})
        parameters.setdefault("action", action)
        return await connector._fetch(parameters, context)

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

    async def _service_user_id(self) -> int | None:
        raw_user_id = getattr(settings, "NEUROA2A_TRAVEL_USER_ID", "")
        try:
            return int(raw_user_id)
        except (TypeError, ValueError):
            pass

        def _get_or_create_service_user():
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

        return await sync_to_async(_get_or_create_service_user)()

    def _human_result(self, action: str, routed: Dict[str, Any]) -> str:
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

    def _format_response(self, result: Dict[str, Any], prompt: str, started: float) -> Dict[str, Any]:
        output = str(result.get("result") or "")
        return {
            "status": "success" if result.get("status") == "success" else "error",
            "result": output,
            "usage": {
                "tokens_used": self._estimate_tokens(prompt, output),
                "processing_time_ms": int((time.perf_counter() - started) * 1000),
            },
        }

    def _error(self, message: str, started: float) -> Dict[str, Any]:
        return {
            "status": "error",
            "result": message,
            "usage": {
                "tokens_used": self._estimate_tokens(message, ""),
                "processing_time_ms": int((time.perf_counter() - started) * 1000),
            },
        }

    def _estimate_tokens(self, *parts: str) -> int:
        text = " ".join(part or "" for part in parts)
        return max(1, len(text) // 4)
