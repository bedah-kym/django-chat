"""
Telegram Bot webhook receiver — accepts updates from Telegram and routes
incoming messages through Mathia's chat pipeline.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

logger = logging.getLogger(__name__)


def _verify_telegram_token(request: HttpRequest) -> bool:
    """Optional: verify the secret token set with setWebhook."""
    expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or ""
    if not expected:
        return True  # no secret configured — accept all
    header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    return hmac.compare_digest(header, expected)


@csrf_exempt
@require_POST
async def telegram_webhook(request: HttpRequest) -> HttpResponse:
    if not _verify_telegram_token(request):
        return HttpResponse("Unauthorized", status=403)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    message = body.get("message") or body.get("edited_message")
    if not message:
        return JsonResponse({"status": "ignored", "reason": "no message field"})

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    text = message.get("text", "").strip()

    if not chat_id or not text:
        return JsonResponse({"status": "ignored"})

    logger.info(f"Telegram inbound: chat_id={chat_id} text={text[:80]}")

    # Fire-and-forget: ack Telegram immediately, process in background.
    # Telegram retries after ~10s of silence; LLM calls can exceed that.
    import asyncio as _asyncio
    _asyncio.ensure_future(_process_and_reply(chat_id, text))

    return JsonResponse({"status": "ok"})


async def _process_and_reply(chat_id: str, text: str) -> None:
    """Background: parse intent → route through connectors → reply."""
    import os
    import httpx
    from django.conf import settings as django_settings
    from orchestration.intent_parser import parse_intent
    from orchestration.mcp_router import route_intent

    token = getattr(django_settings, 'TELEGRAM_BOT_TOKEN', None) or os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not token:
        logger.error("Telegram reply aborted: no TELEGRAM_BOT_TOKEN")
        return

    reply_text: str
    try:
        user_context = {"telegram_chat_id": chat_id, "platform": "telegram"}
        intent = await parse_intent(text, user_context)
        action = intent.get("action", "")

        # Rule-based parser failed → let LLM classify the intent
        if action in ("general_chat", "chat", "none", "", None):
            from orchestration.llm_client import get_llm_client, extract_json
            llm = get_llm_client()
            try:
                llm_intent_raw = await llm.generate_text(
                    system_prompt=(
                        "You are an intent classifier. Given a user message, return JSON with:\n"
                        '- "action": one of get_weather, search_flights, search_hotels, search_buses, '
                        'create_itinerary, send_whatsapp, send_email, set_reminder, get_calendar, '
                        'search_web, currency_convert, general_chat\n'
                        '- "parameters": object with relevant fields (location, destination, origin, '
                        'date, phone_number, message, query, amount, from_currency, to_currency)\n'
                        '- "is_chat": true ONLY if this is pure conversation with no actionable request\n'
                        'Example: "I wonder what the weather is in Nairobi" → '
                        '{"action":"get_weather","parameters":{"location":"Nairobi"},"is_chat":false}'
                    ),
                    user_prompt=text,
                    max_tokens=200,
                )
                llm_intent = extract_json(llm_intent_raw)
                if llm_intent and not llm_intent.get("is_chat") and llm_intent.get("action"):
                    intent = llm_intent
                    action = intent.get("action", "")
                else:
                    # Pure chat — just reply with LLM
                    reply_text = await llm.generate_text(
                        system_prompt="You are Mathia, a helpful AI assistant. Reply concisely in 1-3 sentences.",
                        user_prompt=text,
                        max_tokens=300,
                    )
            except Exception:
                reply_text = await llm.generate_text(
                    system_prompt="You are Mathia, a helpful AI assistant. Reply concisely in 1-3 sentences.",
                    user_prompt=text,
                    max_tokens=300,
                )

        if action not in ("general_chat", "chat", "none", "", None):
            result = await route_intent(intent, user_context)
            if result.get("status") == "success":
                reply_text = result.get("message") or result.get("data", {}).get("summary", "Done!")
            else:
                reply_text = result.get("message") or "Sorry, I couldn't complete that request."
    except Exception as exc:
        logger.error(f"Orchestration failed for '{text[:80]}': {exc}")
        reply_text = "Sorry, I ran into an issue processing that. Try again!"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": reply_text[:4000]},
            )
            resp.raise_for_status()
            logger.info(f"Telegram reply sent to {chat_id}: {reply_text[:80]}")
    except Exception as exc:
        logger.error(f"Telegram sendMessage failed: {exc}")
