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
from orchestration.mcp_router import route_intent

logger = logging.getLogger(__name__)

ALLOWED_ACTIONS = {
    "search_buses",
    "search_hotels",
    "search_flights",
    "search_transfers",
    "search_events",
}


class NeuroA2ATravelRunView(APIView):
    """Run the travel agent through neuroA2A's proxy request contract."""

    authentication_classes = []
    permission_classes = [AllowAny]

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
            return {
                "status": "error",
                "result": (
                    "This listing currently supports travel searches only: flights, hotels, "
                    "buses, transfers, and events. Booking and itinerary changes stay inside Mathia."
                ),
                "action": action,
            }

        routed = await route_intent(
            intent,
            {
                "user_id": service_user_id,
                "room_id": None,
                "source": "neuroa2a",
            },
        )

        if routed.get("status") == "success":
            return {
                "status": "success",
                "result": self._human_result(action, routed),
                "action": action,
                "raw": routed,
            }

        message = routed.get("message") or routed.get("clarification_prompt") or routed.get("reason")
        return {
            "status": "error",
            "result": message or "Travel search could not be completed.",
            "action": action,
            "raw": routed,
        }

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
        data = routed.get("data") if isinstance(routed.get("data"), dict) else {}
        results = data.get("results")
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
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
