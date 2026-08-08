"""
Telegram Bot webhook receiver — full chatroom experience.

Capabilities: natural-language intent parsing, multi-turn conversations,
confirmation gates, workflow planning, context memory, typing indicators.
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

TG_API = "https://api.telegram.org"
CONTEXT_TTL = 60 * 60 * 6  # 6-hour conversation memory per chat


def _verify_telegram_token(request: HttpRequest) -> bool:
    expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or ""
    if not expected:
        return True
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

    import asyncio as _asyncio
    _asyncio.ensure_future(_process_and_reply(chat_id, text))

    return JsonResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_token() -> str:
    import os
    return getattr(settings, 'TELEGRAM_BOT_TOKEN', None) or os.environ.get('TELEGRAM_BOT_TOKEN', '')


def _redis():
    from django_redis import get_redis_connection
    return get_redis_connection("default")


async def _tg_call(method: str, data: dict) -> dict:
    import httpx
    token = _get_token()
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        r = await client.post(f"{TG_API}/bot{token}/{method}", json=data)
        r.raise_for_status()
        return r.json()


async def _send_typing(chat_id: str):
    try:
        await _tg_call("sendChatAction", {"chat_id": chat_id, "action": "typing"})
    except Exception:
        pass


async def _send_message(chat_id: str, text: str):
    await _tg_call("sendMessage", {"chat_id": chat_id, "text": text[:4000]})


async def _get_context(chat_id: str) -> list[dict]:
    """Get recent conversation context from Redis."""
    try:
        raw = _redis().get(f"tg:ctx:{chat_id}")
        if raw:
            return json.loads(raw if isinstance(raw, str) else raw.decode())
    except Exception:
        pass
    return []


async def _save_context(chat_id: str, user_msg: str, reply: str):
    """Store last 10 messages in Redis for conversation memory."""
    ctx = await _get_context(chat_id)
    ctx.append({"role": "user", "text": user_msg[:500]})
    ctx.append({"role": "assistant", "text": reply[:500]})
    if len(ctx) > 20:
        ctx = ctx[-20:]
    try:
        _redis().setex(f"tg:ctx:{chat_id}", CONTEXT_TTL, json.dumps(ctx))
    except Exception:
        pass


async def _get_pending(chat_id: str) -> dict | None:
    """Check for a pending confirmation action."""
    try:
        raw = _redis().get(f"tg:pending:{chat_id}")
        if raw:
            return json.loads(raw if isinstance(raw, str) else raw.decode())
    except Exception:
        pass
    return None


async def _set_pending(chat_id: str, data: dict):
    _redis().setex(f"tg:pending:{chat_id}", 600, json.dumps(data))  # 10-min TTL


async def _clear_pending(chat_id: str):
    _redis().delete(f"tg:pending:{chat_id}")


# ---------------------------------------------------------------------------
# Core processing
# ---------------------------------------------------------------------------

async def _process_and_reply(chat_id: str, text: str) -> None:
    token = _get_token()
    if not token:
        return

    await _send_typing(chat_id)

    # ── 1. Check for pending confirmation ──────────────────────────
    pending = await _get_pending(chat_id)
    if pending and text.lower() in ("yes", "confirm", "ok", "y", "proceed", "go ahead", "accept"):
        await _clear_pending(chat_id)
        from orchestration.mcp_router import route_intent
        pending["confirmed"] = True
        try:
            result = await route_intent(pending, {"telegram_chat_id": chat_id, "platform": "telegram"})
            reply = result.get("message") or "Done!"
        except Exception as exc:
            logger.error(f"Confirmed action failed: {exc}")
            reply = "Sorry, that action failed. Try again?"
        await _save_context(chat_id, text, reply)
        await _send_message(chat_id, reply)
        return

    if pending and text.lower() in ("no", "cancel", "n", "stop", "never mind"):
        await _clear_pending(chat_id)
        reply = "Cancelled. What else can I help with?"
        await _save_context(chat_id, text, reply)
        await _send_message(chat_id, reply)
        return

    # ── 2. Build conversation context ──────────────────────────────
    ctx = await _get_context(chat_id)
    context_prompt = ""
    if ctx:
        recent = ctx[-6:]  # last 3 exchanges
        lines = []
        for m in recent:
            prefix = "User" if m["role"] == "user" else "Mathia"
            lines.append(f"{prefix}: {m['text']}")
        context_prompt = "Recent conversation:\n" + "\n".join(lines) + "\n\n"

    # ── 3. Parse intent (rule-based → LLM fallback) ────────────────
    from orchestration.intent_parser import parse_intent
    from orchestration.mcp_router import route_intent
    from orchestration.llm_client import get_llm_client, extract_json

    user_context = {"telegram_chat_id": chat_id, "platform": "telegram"}
    intent = await parse_intent(text, user_context)
    action = intent.get("action", "")
    reply: str = ""

    if action in ("general_chat", "chat", "none", "", None):
        llm = get_llm_client()
        # Try LLM-based intent extraction with context
        try:
            llm_intent_raw = await llm.generate_text(
                system_prompt=(
                    "You are an intent classifier for Mathia, an AI assistant with these capabilities:\n"
                    "- get_weather: weather for a location\n"
                    "- search_flights, search_hotels, search_buses: travel search\n"
                    "- create_itinerary, view_itinerary: trip planning\n"
                    "- send_whatsapp, send_email: messaging\n"
                    "- set_reminder, get_calendar: scheduling\n"
                    "- search_web: web search\n"
                    "- currency_convert: currency exchange\n"
                    "- general_chat: pure conversation, no action needed\n\n"
                    "Given the user message, return valid JSON ONLY:\n"
                    '{"action":"<action>","parameters":{...},"is_chat":true/false}\n'
                    '"is_chat":true means this is just conversation, no tool needed.\n\n'
                    "Example: 'hmm what's the weather like in Nairobi today?' →\n"
                    '{"action":"get_weather","parameters":{"location":"Nairobi"},"is_chat":false}'
                ),
                user_prompt=context_prompt + "User: " + text,
                max_tokens=200,
            )
            llm_intent = extract_json(llm_intent_raw)
            if llm_intent and not llm_intent.get("is_chat") and llm_intent.get("action"):
                intent = llm_intent
                action = intent.get("action", "")
        except Exception:
            pass

    # ── 4. Execute or chat ─────────────────────────────────────────
    if action not in ("general_chat", "chat", "none", "", None):
        try:
            result = await route_intent(intent, user_context)
            if result.get("status") == "needs_confirmation":
                # Store pending intent, ask user to confirm
                await _set_pending(chat_id, intent)
                reply = result.get("message") or "Confirm this action? Reply yes/no."
            elif result.get("status") == "success":
                reply = result.get("message") or result.get("data", {}).get("summary", "Done!")
            else:
                reply = result.get("message") or "That didn't work. Try rephrasing?"
        except Exception as exc:
            logger.error(f"Route intent failed: {exc}")
            reply = "Sorry, I couldn't complete that. Try again?"
    else:
        # Pure chat — LLM with context
        llm = get_llm_client()
        reply = await llm.generate_text(
            system_prompt=(
                "You are Mathia, a helpful AI assistant. You can manage travel, "
                "weather, payments, reminders, messaging, and more. Keep replies "
                "concise (1-3 sentences). If the user needs a tool capability, "
                "let them know you can help with that."
            ),
            user_prompt=context_prompt + "User: " + text,
            max_tokens=300,
        )

    if not reply:
        reply = "I'm not sure how to help with that. Try asking about weather, travel, or reminders!"

    # ── 5. Reply & remember ────────────────────────────────────────
    await _save_context(chat_id, text, reply)
    await _send_message(chat_id, reply)
