"""neuroA2A adapter endpoint for the Mathia travel agent listing."""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
from typing import Any, Dict

from asgiref.sync import async_to_sync, sync_to_async
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from orchestration.intent_parser import parse_intent

logger = logging.getLogger(__name__)

ALLOWED_ACTIONS = {
    "search_buses",
    "search_hotels",
    "search_flights",
    "search_transfers",
    "search_events",
}
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
