"""
Telegram Bot webhook receiver — full chatroom experience.

Capabilities: natural-language intent parsing, multi-turn conversations,
confirmation gates (inline keyboards), workflow planning, context memory
(hybrid: DB facts + rolling LLM summary + recent raw turns via MemoryManager),
typing indicators, command handling (/start, /help, /link), deep linking,
rich result formatting.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time as _time_module
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .memory_manager import MemoryManager
from .date_utils import format_for_system_prompt, validate_timezone

logger = logging.getLogger(__name__)

TG_API = "https://api.telegram.org"

# ---------------------------------------------------------------------------
# System prompt used for the Mathia AI in Telegram
# ---------------------------------------------------------------------------

_MATHIA_TG_SYSTEM_PROMPT = (
    "You are Mathia, a helpful AI assistant on Telegram. "
    "You can manage travel, weather, payments, reminders, messaging, and more. "
    "Keep replies concise (1-3 sentences). "
    "If the user needs a tool capability, let them know you can help with that. "
    "Be warm, professional, and direct."
)

# ---------------------------------------------------------------------------
# Confirmation keyboard — sent when an action needs explicit user approval
# ---------------------------------------------------------------------------

_CONFIRM_KEYBOARD: Dict[str, Any] = {
    "inline_keyboard": [
        [
            {"text": "✅ Confirm", "callback_data": "confirm"},
            {"text": "❌ Cancel", "callback_data": "cancel"},
        ],
    ],
}

# ---------------------------------------------------------------------------
# Help / welcome keyboard
# ---------------------------------------------------------------------------

_WELCOME_KEYBOARD: Dict[str, Any] = {
    "inline_keyboard": [
        [
            {"text": "🌤️ Weather", "callback_data": "cmd:weather"},
            {"text": "✈️ Travel", "callback_data": "cmd:travel"},
        ],
        [
            {"text": "💰 Payments", "callback_data": "cmd:payments"},
            {"text": "🔗 Link Account", "callback_data": "cmd:link"},
        ],
        [
            {"text": "📱 Open Dashboard", "web_app": {"url": ""}},  # filled at send time
        ],
        [
            {"text": "❓ Help", "callback_data": "cmd:help"},
        ],
    ],
}

# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------


def _verify_telegram_token(request: HttpRequest) -> bool:
    expected = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "") or ""
    if not expected:
        return True
    header = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    return hmac.compare_digest(header, expected)


# ---------------------------------------------------------------------------
# Main webhook entry point
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

_RATE_LIMIT_WINDOW = 10     # seconds
_RATE_LIMIT_MAX = 30        # max requests per window per chat_id

def _check_rate_limit(chat_id: str) -> bool:
    """Simple sliding-window rate limiter. Returns True if allowed."""
    try:
        r = _redis()
        key = f"tg:ratelimit:{chat_id}"
        now = _time_module.time()
        now_str = f"{now:.6f}"
        window_start = now - _RATE_LIMIT_WINDOW

        # Remove old entries and count recent ones
        r.zremrangebyscore(key, 0, window_start)
        count = r.zcard(key)

        if count >= _RATE_LIMIT_MAX:
            return False

        r.zadd(key, {now_str: now})
        r.expire(key, _RATE_LIMIT_WINDOW + 5)
        return True
    except Exception:
        return True  # fail open if Redis is down


# ---------------------------------------------------------------------------
# Main webhook entry point
# ---------------------------------------------------------------------------


@csrf_exempt
@require_POST
async def telegram_webhook(request: HttpRequest) -> HttpResponse:
    if not _verify_telegram_token(request):
        return HttpResponse("Unauthorized", status=403)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    # ── Callback queries (inline keyboard button presses) ──────────
    callback = body.get("callback_query")
    if callback:
        await _handle_callback(callback)
        return JsonResponse({"status": "ok"})

    # ── Inline queries (@MathiaBot query from any chat) ────────────
    inline_query = body.get("inline_query")
    if inline_query:
        import asyncio as _asyncio
        _asyncio.ensure_future(_handle_inline_query(inline_query))
        return JsonResponse({"status": "ok"})

    # ── Regular messages ───────────────────────────────────────────
    message = body.get("message") or body.get("edited_message")
    if not message:
        return JsonResponse({"status": "ignored", "reason": "no message field"})

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))

    # ── Rate limit check ────────────────────────────────────────────
    if not _check_rate_limit(chat_id):
        logger.warning("TG rate limit hit: chat_id=%s", chat_id)
        return JsonResponse({"status": "rate_limited"})

    # ── Mini App data (sent via WebApp.sendData) ────────────────────
    web_app_data = message.get("web_app_data", {}).get("data", "")
    if web_app_data:
        import asyncio as _asyncio
        _asyncio.ensure_future(_handle_web_app_data(chat_id, web_app_data))
        return JsonResponse({"status": "ok"})

    text = message.get("text", "").strip()

    # Extract sender info for auto-registration
    from_user = message.get("from", {})
    telegram_id = str(from_user.get("id", ""))
    tg_username = from_user.get("username", "")
    first_name = from_user.get("first_name", "")
    last_name = from_user.get("last_name", "")

    # Check for bot commands (entities with type "bot_command")
    entities = message.get("entities", [])
    is_command = any(
        e.get("type") == "bot_command" for e in entities
        if isinstance(e, dict)
    )

    if not chat_id:
        return JsonResponse({"status": "ignored"})

    if not text and not is_command:
        return JsonResponse({"status": "ignored"})

    logger.info(f"Telegram inbound: chat_id={chat_id} text={text[:80]} cmd={is_command}")

    # Pre-fetch durable facts / summary + timezone
    try:
        facts_block = await MemoryManager._build_facts_block(chat_id)
        rolling_summary = await MemoryManager._get_rolling_summary(chat_id)
        timezone_str = await _get_user_timezone(chat_id)
    except Exception:
        facts_block = ""
        rolling_summary = ""
        timezone_str = "Africa/Nairobi"

    date_block = format_for_system_prompt(timezone_str)
    system_prompt = _MATHIA_TG_SYSTEM_PROMPT + "\n\n" + date_block
    if facts_block:
        system_prompt += "\n" + facts_block
    if rolling_summary:
        system_prompt += f"\n\nCONVERSATION SUMMARY:\n{rolling_summary}"

    # Auto-register the user (fire-and-forget is fine — no DB access in failure path)
    import asyncio as _asyncio
    _asyncio.ensure_future(_ensure_telegram_user(
        chat_id, telegram_id, tg_username, first_name, last_name,
    ))

    # Process synchronously — await to keep DB executor alive
    if is_command:
        await _handle_command(chat_id, text, entities)
    else:
        await _process_and_reply(chat_id, text, system_prompt)

    return JsonResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Callback query handler (inline keyboard button presses)
# ---------------------------------------------------------------------------


async def _handle_callback(callback: dict) -> None:
    """Handle inline keyboard button presses."""
    data = callback.get("data", "")
    cb_id = callback.get("id", "")
    message = callback.get("message", {})
    chat_id = str(message.get("chat", {}).get("id", ""))

    if not chat_id or not data:
        return

    logger.info(f"TG callback: chat={chat_id} data={data}")

    # Acknowledge the callback (removes loading state on the button)
    await _tg_call("answerCallbackQuery", {"callback_query_id": cb_id})

    # ── Confirmation callbacks ─────────────────────────────────────
    if data == "confirm":
        await _handle_confirmation(chat_id, confirmed=True)
        return

    if data == "cancel":
        await _clear_pending(chat_id)
        await _send_message(chat_id, "❌ Cancelled. What else can I help with?")
        return

    # ── Command shortcuts from welcome keyboard ────────────────────
    if data.startswith("cmd:"):
        cmd = data[4:]
        await _route_quick_command(chat_id, cmd)
        return

    # ── Unknown callback ───────────────────────────────────────────
    logger.warning(f"TG: unhandled callback data={data}")


# ---------------------------------------------------------------------------
# Inline query handler (@MathiaBot query from any chat)
# ---------------------------------------------------------------------------


async def _handle_inline_query(query: dict) -> None:
    """Handle inline queries — lets users type @MathiaBot <query> in any chat."""
    query_id = query.get("id", "")
    query_text = (query.get("query", "") or "").strip()

    if not query_text:
        # Empty query — show help suggestions
        results = [
            _inline_article(
                "help_weather",
                "🌤️ Weather: <city name>",
                "Type: @MathiaBot weather Nairobi",
            ),
            _inline_article(
                "help_travel",
                "✈️ Travel: flights/hotels",
                "Type: @MathiaBot flights Nairobi to Mombasa",
            ),
            _inline_article(
                "help_reminder",
                "📅 Reminder: remind me",
                "Type: @MathiaBot remind me at 3pm",
            ),
        ]
    else:
        # Quick inline suggestions based on query
        results = _build_inline_results(query_text)

    await _tg_call("answerInlineQuery", {
        "inline_query_id": query_id,
        "results": results,
        "cache_time": 30,
    })


def _inline_article(id_suffix: str, title: str, description: str) -> dict:
    """Build a single inline query result article."""
    return {
        "type": "article",
        "id": id_suffix,
        "title": title,
        "description": description,
        "input_message_content": {
            "message_text": f"/{id_suffix.split('_', 1)[1] if '_' in id_suffix else title}",
        },
    }


def _build_inline_results(query: str) -> list:
    """Build inline query results based on the query text."""
    q = query.lower()
    results = []

    if any(w in q for w in ("weather", "rain", "sun", "temp", "hot", "cold")):
        results.append(_inline_article(
            "weather_query",
            f"🌤️ Check weather for: {query}",
            "Tap to get current weather conditions",
        ))

    if any(w in q for w in ("flight", "hotel", "travel", "bus", "trip")):
        results.append(_inline_article(
            "travel_query",
            f"✈️ Search travel: {query}",
            "Tap to search flights, hotels, or buses",
        ))

    if any(w in q for w in ("remind", "reminder", "schedule", "calendar")):
        results.append(_inline_article(
            "reminder_query",
            f"📅 Set reminder: {query}",
            "Tap to create a reminder",
        ))

    # Always add a general chat option
    if not results:
        results.append(_inline_article(
            "chat_query",
            f"💬 Ask Mathia: {query[:50]}",
            "Send this to Mathia as a chat message",
        ))

    return results


async def _handle_confirmation(chat_id: str, confirmed: bool) -> None:
    """Process a confirmed/cancelled pending action."""
    pending = await _get_pending(chat_id)
    if not pending:
        await _send_message(chat_id, "⚠️ No pending action to confirm. It may have expired.")
        return

    await _clear_pending(chat_id)

    if not confirmed:
        await _send_message(chat_id, "❌ Cancelled.")
        return

    from orchestration.mcp_router import route_intent
    pending["confirmed"] = True
    try:
        user_ctx = await _build_user_context(chat_id)
        result = await route_intent(pending, user_ctx)
        reply = _format_result(result)
    except Exception as exc:
        logger.error(f"Confirmed action failed: {exc}")
        reply = "❌ Sorry, that action failed. Try again?"

    await _record_and_forget(chat_id, "[confirmed action]", reply)
    await _send_message(chat_id, reply)


# ---------------------------------------------------------------------------
# Command handler
# ---------------------------------------------------------------------------

# Known commands that bypass intent parsing
_COMMAND_MAP = {
    "start": "_cmd_start",
    "help": "_cmd_help",
    "link": "_cmd_link",
    "timezone": "_cmd_timezone",
}


async def _handle_command(
    chat_id: str,
    text: str,
    entities: list,
) -> None:
    """Route a bot command to the appropriate handler."""
    # Extract the command text from the entities
    for entity in entities or []:
        if not isinstance(entity, dict):
            continue
        if entity.get("type") != "bot_command":
            continue

        offset = entity.get("offset", 0)
        length = entity.get("length", 0)
        raw_cmd = text[offset:offset + length]

        # Split: "/start payload" → cmd="/start", payload="payload"
        parts = raw_cmd.split(maxsplit=1)
        cmd = (parts[0] if parts else raw_cmd).lstrip("/").split("@")[0].lower()
        payload = parts[1] if len(parts) > 1 else ""

        logger.info(f"TG command: chat={chat_id} cmd={cmd} payload={payload[:50] if payload else ''}")

        handler_name = _COMMAND_MAP.get(cmd)
        if handler_name:
            handler = globals().get(handler_name)
            if handler:
                await handler(chat_id, payload)
                return

    # Fallback: unrecognized command → process as regular message
    await _process_and_reply(chat_id, text)


async def _cmd_start(chat_id: str, payload: str):
    """Handle /start — welcome message with keyboard, parse deep link payload."""
    # Deep link: /start auth_TOKEN or /start action_weather_nairobi
    if payload:
        if payload.startswith("link_"):
            # /start link_CODE → direct account linking
            code = payload.replace("link_", "", 1).strip().upper()
            await _verify_and_link(chat_id, code)
            return
        if payload.startswith("auth_"):
            await _handle_deep_link_auth(chat_id, payload)
            return
        if payload.startswith("action_"):
            await _handle_deep_link_action(chat_id, payload)
            return

    # Build the Mini App URL — try env var first, fall back to known working URL
    import os
    from django.conf import settings as django_settings

    base_url = (
        getattr(django_settings, "TELEGRAM_MINI_APP_URL", "")
        or os.environ.get("TELEGRAM_MINI_APP_URL", "")
    )
    if not base_url:
        # Ultimate fallback for Railway
        domain = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "")
        if domain:
            base_url = f"https://{domain}"
        else:
            base_url = "https://mathiaos-chat254.up.railway.app"

    # Build the Mini App URL
    if "/chatbot/tg/app" in base_url:
        mini_app_url = f"{base_url.rstrip('/')}/?chat_id={chat_id}"
    else:
        mini_app_url = f"{base_url.rstrip('/')}/chatbot/tg/app/?chat_id={chat_id}"
    logger.info("TG Mini App URL for chat=%s: %s", chat_id, mini_app_url)

    # Build keyboard with dynamic web_app URL
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "🌤️ Weather", "callback_data": "cmd:weather"},
                {"text": "✈️ Travel", "callback_data": "cmd:travel"},
            ],
            [
                {"text": "💰 Payments", "callback_data": "cmd:payments"},
                {"text": "🔗 Link Account", "callback_data": "cmd:link"},
            ],
            [
                {"text": "📱 Open Dashboard", "web_app": {"url": mini_app_url}},
            ],
            [
                {"text": "❓ Help", "callback_data": "cmd:help"},
            ],
        ],
    }

    greeting = (
        "👋 *Welcome to Mathia\\!*\n\n"
        "I'm your AI assistant for weather, travel, payments, reminders, and more\\.\n\n"
        "Type anything or tap a button below to get started\\.\n\n"
        f"🌐 [Open Web Dashboard]({mini_app_url})"
    )
    await _tg_call("sendMessage", {
        "chat_id": chat_id,
        "text": greeting,
        "parse_mode": "MarkdownV2",
        "reply_markup": keyboard,
    })


async def _cmd_help(chat_id: str, _payload: str = ""):
    """Handle /help."""
    help_text = (
        "🛰️ *Mathia Help*\n\n"
        "*Commands:*\n"
        "/start — Welcome message\n"
        "/help — This help text\n"
        "/link — Link your Telegram to your Mathia account\n"
        "/timezone — Set your timezone for accurate dates\n\n"
        "*Things I can do:*\n"
        "🌤️ Weather: _\"weather in Nairobi\"_\n"
        "✈️ Travel: _\"flights to Mombasa\"_\n"
        "💰 Payments: _\"invoice status\"_\n"
        "📅 Reminders: _\"remind me at 3pm\"_\n"
        "🕐 Timezone: _/timezone Nairobi_\n"
        "🔍 Web search: _\"search for...\"_\n\n"
        "_Just type naturally — I'll figure it out\\._"
    )
    await _tg_call("sendMessage", {
        "chat_id": chat_id,
        "text": help_text,
        "parse_mode": "MarkdownV2",
    })


async def _cmd_link(chat_id: str, payload: str = ""):
    """Handle /link [code] — link Telegram account to Mathia."""
    if payload and len(payload.strip()) >= 4:
        code = payload.strip().upper()
        await _verify_and_link(chat_id, code)
        return

    # No code — show instructions with linking page URL (no DB required)
    link_text = (
        "🔗 *Link Your Account*\n\n"
        "Visit the linking page to connect your Telegram:\n"
        "🌐 [mathiaos\\-chat254\\.up\\.railway\\.app/chatbot/tg/link/]"
        "(https://mathiaos\\-chat254\\.up\\.railway\\.app/chatbot/tg/link/)\n\n"
        "1\\. Log in and scan the QR code, or\n"
        "2\\. Copy the code and send `/link CODE` here\n\n"
        "_Linking enables personalized responses\\._"
    )
    await _tg_call("sendMessage", {
        "chat_id": chat_id,
        "text": link_text,
        "parse_mode": "MarkdownV2",
    })


async def _cmd_timezone(chat_id: str, payload: str = ""):
    """Handle /timezone [zone] — set or view timezone."""
    from asgiref.sync import sync_to_async
    from .models import TelegramUser as TGUser

    @sync_to_async
    def _get_timezone():
        tg = TGUser.objects.filter(chat_id=int(chat_id)).first()
        return tg.timezone if tg else "Africa/Nairobi"

    @sync_to_async
    def _set_timezone(tz: str):
        tg, _ = TGUser.objects.get_or_create(
            telegram_id=int(chat_id),
            defaults={"chat_id": int(chat_id), "timezone": tz},
        )
        tg.timezone = tz
        tg.save(update_fields=["timezone"])
        return tg.timezone

    if payload and payload.strip():
        tz_input = payload.strip()
        valid, canonical = validate_timezone(tz_input)
        if valid:
            await _set_timezone(canonical)
            now_str = format_for_system_prompt(canonical).split("\n")[0]
            await _send_message(
                chat_id,
                f"🕐 Timezone set to *{canonical}*\\.\n{now_str}",
            )
        else:
            await _send_message(
                chat_id,
                f"❌ {canonical}\\.\n\n"
                "Examples: `/timezone Nairobi`, `/timezone London`, `/timezone New_York`",
            )
        return

    current = await _get_timezone()
    now_str = format_for_system_prompt(current)
    await _send_message(
        chat_id,
        f"🕐 *Your timezone:* {current}\n\n{now_str}\n\n"
        "Change with `/timezone City_Name`\n"
        "Examples: `/timezone Nairobi`, `/timezone London`",
    )


async def _verify_and_link(chat_id: str, code: str):
    """Verify a linking code against the API and create the TelegramUser link."""
    import httpx

    # Build the verification URL (internal API call)
    # Use the Django test client or direct model access in production
    from django.conf import settings as django_settings
    from asgiref.sync import sync_to_async

    @sync_to_async
    def _verify_in_db():
        """Verify the code directly against Redis (same Redis instance)."""
        import json as _json
        r = _redis()
        raw = r.get(f"tg:link:code:{code}")
        if not raw:
            return None
        try:
            data = _json.loads(raw if isinstance(raw, str) else raw.decode())
            return data
        except Exception:
            return None

    @sync_to_async
    def _link_user(user_id: int, telegram_id: int, username: str,
                   first_name: str = "", last_name: str = ""):
        """Link the TelegramUser to the Django user."""
        from django.contrib.auth import get_user_model
        from .models import TelegramUser as TGUser

        User = get_user_model()
        try:
            django_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None, "User not found"

        tg_user, created = TGUser.objects.update_or_create(
            telegram_id=telegram_id,
            defaults={
                "user": django_user,
                "chat_id": int(chat_id),
                "telegram_username": username,
                "first_name": first_name,
                "last_name": last_name,
                "is_authenticated": True,
            },
        )
        r = _redis()
        r.delete(f"tg:link:code:{code}")
        return django_user.username, created

    # Verify code
    data = await _verify_in_db()
    if not data:
        await _send_message(chat_id, "❌ Invalid or expired code\\. Please generate a new one from Settings → Linked Accounts\\.")
        return

    user_id = data.get("user_id")
    if not user_id:
        await _send_message(chat_id, "❌ Invalid code data\\. Please try again\\.")
        return

    # Get TG user info from Redis (stored at first contact)
    from .models import TelegramUser as TGUser

    @sync_to_async
    def _get_tg_user():
        return TGUser.objects.filter(chat_id=int(chat_id)).first()

    @sync_to_async
    def _check_already_linked():
        """Check if this chat is already linked to a different Django user."""
        existing = TGUser.objects.filter(
            chat_id=int(chat_id), is_authenticated=True
        ).first()
        if existing and existing.user:
            return existing.user.username
        return None

    tg_user = await _get_tg_user()
    tg_id = tg_user.telegram_id if tg_user else int(chat_id)
    tg_username = tg_user.telegram_username if tg_user else ""

    # Check if already linked to a different account
    already_linked_to = await _check_already_linked()
    if already_linked_to and already_linked_to != data.get("username"):
        await _send_message(
            chat_id,
            f"⚠️ This Telegram account is already linked to *{already_linked_to}*\\.\n"
            "Linking again will switch it to the new account\\.",
        )

    # Link
    username, created = await _link_user(user_id, tg_id, tg_username)

    if username:
        emoji = "🆕" if created else "🔁"
        await _send_message(
            chat_id,
            f"{emoji} Account linked\\! Welcome, *{username}*\\.\n\n"
            "I now have access to your preferences and data\\. "
            "Your conversations will be personalized from now on\\.",
        )
    else:
        await _send_message(chat_id, "❌ Linking failed\\. Please try again or contact support\\.")


async def _handle_web_app_data(chat_id: str, raw_data: str):
    """Handle data sent from the Mini App via WebApp.sendData()."""
    import json as _json

    try:
        data = _json.loads(raw_data)
    except (_json.JSONDecodeError, TypeError):
        logger.warning("TG Mini App: invalid JSON data from chat=%s", chat_id)
        return

    action = data.get("action", "")
    source = data.get("source", "")

    logger.info("TG Mini App data: chat=%s action=%s source=%s", chat_id, action, source)

    if action == "weather":
        await _send_message(chat_id, "🌤️ Tell me a location — for example: _\"Nairobi\"_ or _\"Mombasa, Kenya\"_")
    elif action == "travel":
        await _send_message(chat_id, "✈️ Where would you like to go? Try: _\"flights from Nairobi to Mombasa tomorrow\"_")
    elif action == "link":
        await _cmd_link(chat_id, "")
    elif action == "help":
        await _cmd_help(chat_id)
    else:
        await _send_message(chat_id, f"📱 Received from dashboard: _{action}_\\. Type your request and I'll help\\!")


async def _ensure_telegram_user(
    chat_id: str,
    telegram_id: str,
    username: str,
    first_name: str,
    last_name: str,
):
    """Auto-register a TelegramUser on first contact (no Django link)."""
    from asgiref.sync import sync_to_async

    @sync_to_async
    def _upsert():
        from .models import TelegramUser
        tg_id = int(telegram_id) if telegram_id else int(chat_id)
        obj, created = TelegramUser.objects.get_or_create(
            telegram_id=tg_id,
            defaults={
                "chat_id": int(chat_id),
                "telegram_username": username,
                "first_name": first_name,
                "last_name": last_name,
                "is_authenticated": False,
            },
        )
        if not created:
            # Update metadata on every contact
            updated = False
            if username and obj.telegram_username != username:
                obj.telegram_username = username
                updated = True
            if first_name and obj.first_name != first_name:
                obj.first_name = first_name
                updated = True
            if updated:
                obj.save(update_fields=["telegram_username", "first_name"])
        return created

    try:
        created = await _upsert()
        if created:
            logger.info("TG user auto-registered: tg_id=%s username=%s", telegram_id, username)
    except Exception as exc:
        logger.error("TG user auto-registration failed: %s", exc)


async def _route_quick_command(chat_id: str, cmd: str):
    """Handle quick commands from the welcome keyboard."""
    if cmd == "weather":
        await _send_message(chat_id, "🌤️ Tell me a location — for example: _\"Nairobi\"_ or _\"Mombasa, Kenya\"_")
    elif cmd == "travel":
        await _send_message(chat_id, "✈️ Where would you like to go? Try: _\"flights from Nairobi to Mombasa tomorrow\"_")
    elif cmd == "payments":
        await _send_message(chat_id, "💰 What would you like to know about payments? Try: _\"my invoice status\"_ or _\"recent transactions\"_")
    elif cmd == "link":
        await _cmd_link(chat_id)
    elif cmd == "help":
        await _cmd_help(chat_id)


async def _handle_deep_link_auth(chat_id: str, payload: str):
    """Process an auth deep link: /start auth_TOKEN."""
    token = payload.replace("auth_", "", 1).strip()
    if len(token) < 4:
        await _send_message(chat_id, "❌ Invalid auth token\\.")
        return

    # Treat auth tokens same as link codes — verify via the same mechanism
    await _verify_and_link(chat_id, token.upper())


async def _handle_deep_link_action(chat_id: str, payload: str):
    """Process an action deep link: /start action_weather_nairobi."""
    action_text = payload.replace("action_", "", 1).strip().replace("_", " ")
    logger.info(f"TG deep link action: chat={chat_id} action={action_text}")
    await _process_and_reply(chat_id, action_text)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_token() -> str:
    import os
    return (
        getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        or os.environ.get('TELEGRAM_BOT_TOKEN', '')
    )


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
    """Send a message. Tries MarkdownV2 first, falls back to plain text on failure."""
    try:
        await _tg_call("sendMessage", {
            "chat_id": chat_id,
            "text": text[:4000],
            "parse_mode": "MarkdownV2",
        })
    except Exception:
        # MarkdownV2 parsing failed (unescaped chars from LLM) — retry plain text
        try:
            await _tg_call("sendMessage", {
                "chat_id": chat_id,
                "text": text[:4000],
            })
        except Exception:
            logger.error("TG sendMessage failed twice for chat=%s", chat_id)


async def _send_message_with_keyboard(
    chat_id: str,
    text: str,
    keyboard: Dict[str, Any],
):
    """Send a message with an inline keyboard attached."""
    await _tg_call("sendMessage", {
        "chat_id": chat_id,
        "text": text[:4000],
        "parse_mode": "MarkdownV2",
        "reply_markup": keyboard,
    })


async def _edit_message_with_keyboard(
    chat_id: str,
    message_id: int,
    text: str,
    keyboard: Optional[Dict[str, Any]] = None,
):
    """Edit an existing message, optionally updating its keyboard."""
    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text[:4000],
        "parse_mode": "MarkdownV2",
    }
    if keyboard:
        payload["reply_markup"] = keyboard
    await _tg_call("editMessageText", payload)


def _format_result(result: dict) -> str:
    """Format a connector result into readable Telegram text with rich formatting."""
    msg = result.get("message", "")
    data = result.get("data", {})

    # Already has a detailed message from the connector
    if msg and len(msg) > 30:
        return msg

    # ── Weather ──────────────────────────────────────────────────────
    if result.get("temperature") is not None:
        return (
            f"🌡️ *{result.get('city', '?')}*, {result.get('country', '')}\n"
            f"🌤️ {result['temperature']}°C, {result.get('description', '?')}\n"
            f"💧 Humidity: {result.get('humidity', '?')}%\n"
            f"💨 Wind: {result.get('wind_speed', '?')} km/h"
        )

    # ── Wallet / Balance ─────────────────────────────────────────────
    balance = data.get("balance") or result.get("balance")
    if balance is not None:
        currency = data.get("currency", result.get("currency", "USD"))
        return (
            f"💰 *Wallet Balance*\n"
            f"{balance:,.2f} {currency}"
        )

    # ── Currency Conversion ──────────────────────────────────────────
    converted = data.get("converted_amount") or result.get("converted_amount")
    if converted is not None:
        frm = data.get("from", result.get("from", "?"))
        to = data.get("to", result.get("to", "?"))
        rate = data.get("rate", result.get("rate", "?"))
        return (
            f"💱 *Currency Conversion*\n"
            f"{frm} → {to}: *{converted:,.2f}*\n"
            f"Rate: {rate}"
        )

    # ── Reminders ────────────────────────────────────────────────────
    if result.get("action") == "set_reminder" and result.get("status") == "success":
        reminder_data = data or result
        when = reminder_data.get("scheduled_time", reminder_data.get("when", "soon"))
        what = reminder_data.get("content", reminder_data.get("text", "your reminder"))
        return f"⏰ *Reminder set\\!*\n_{what}_ — {when}"

    # ── Invoices ─────────────────────────────────────────────────────
    invoices = data.get("invoices") or result.get("invoices")
    if invoices and isinstance(invoices, list):
        status = data.get("status_filter", "recent")
        lines = [f"🧾 *Invoices — {status}*"]
        for inv in invoices[:5]:
            if isinstance(inv, dict):
                inv_id = inv.get("id", inv.get("invoice_id", "?"))
                amount = inv.get("amount", "?")
                state = inv.get("state", inv.get("status", "?"))
                lines.append(f"• \\#{inv_id}: {amount} _{state}_")
            else:
                lines.append(f"• {str(inv)[:80]}")
        return "\n".join(lines)

    # ── Travel Search ────────────────────────────────────────────────
    results = result.get("results") or data.get("results", [])
    if results and isinstance(results, list) and len(results) > 0:
        lines = [f"📋 *Found {len(results)} results:*"]
        for i, item in enumerate(results[:5]):
            if isinstance(item, dict):
                if "airline" in item or "flight_number" in item:
                    lines.append(
                        f"{i+1}\\. {item.get('airline','?')} {item.get('flight_number','')} "
                        f"{item.get('departure','')} → {item.get('arrival','')} "
                        f"${item.get('price','?')}"
                    )
                elif "hotel_name" in item or "name" in item:
                    lines.append(
                        f"{i+1}\\. *{item.get('hotel_name') or item.get('name','?')}* — "
                        f"${item.get('price','?')}/night, ⭐{item.get('rating','?')}"
                    )
                else:
                    lines.append(f"{i+1}\\. {str(item)[:100]}")
            else:
                lines.append(f"{i+1}\\. {str(item)[:100]}")
        return "\n".join(lines)

    # ── Generic data ─────────────────────────────────────────────────
    if isinstance(data, dict) and data:
        # Try common keys
        for key in ("summary", "status", "result"):
            val = data.get(key)
            if val and isinstance(val, str) and len(val) > 5:
                return f"📌 {val[:2000]}"
        # Truncated dump
        return str(data)[:1500]

    # ── Final fallback ───────────────────────────────────────────────
    if msg:
        return msg
    return "✅ Done\\!"


# ---------------------------------------------------------------------------
# User context builder — injects Django user_id for linked TG accounts
# ---------------------------------------------------------------------------

async def _build_user_context(chat_id: str) -> Dict[str, Any]:
    """Build user context dict with linked Django user_id if available."""
    ctx: Dict[str, Any] = {"telegram_chat_id": chat_id, "platform": "telegram"}
    try:
        from asgiref.sync import sync_to_async
        from .models import TelegramUser as TGUser

        @sync_to_async
        def _get_linked():
            tg = TGUser.objects.filter(
                chat_id=int(chat_id), is_authenticated=True, user__isnull=False
            ).select_related("user").first()
            return tg.user_id if tg else None

        uid = await _get_linked()
        if uid:
            ctx["user_id"] = uid
    except Exception:
        pass
    return ctx


# ---------------------------------------------------------------------------
# Context helpers — delegate to MemoryManager
# ---------------------------------------------------------------------------

async def _build_context_for_llm(chat_id: str) -> str:
    raw_turns = await MemoryManager.get_recent_turns(chat_id, max_items=6)
    if not raw_turns:
        return ""
    lines = []
    for turn in raw_turns:
        prefix = "User" if turn["role"] == "user" else "Mathia"
        lines.append(f"{prefix}: {turn['content']}")
    return "Recent conversation:\n" + "\n".join(lines) + "\n\n"


async def _build_system_prompt(chat_id: str) -> str:
    """Build full system prompt: base + date awareness + facts + summary."""
    # Get user's timezone
    timezone_str = await _get_user_timezone(chat_id)
    date_block = format_for_system_prompt(timezone_str)

    base = _MATHIA_TG_SYSTEM_PROMPT
    facts_block = await MemoryManager._build_facts_block(chat_id)
    summary = await MemoryManager._get_rolling_summary(chat_id)
    parts = [base, "\n\n" + date_block]
    if facts_block:
        parts.append("\n" + facts_block)
    if summary:
        parts.append(f"\n\nCONVERSATION SUMMARY:\n{summary}")
    return "\n".join(parts)


async def _get_user_timezone(chat_id: str) -> str:
    """Get the timezone for a Telegram chat, defaulting to Africa/Nairobi."""
    try:
        from asgiref.sync import sync_to_async
        from .models import TelegramUser as TGUser

        @sync_to_async
        def _get():
            tg = TGUser.objects.filter(chat_id=int(chat_id)).first()
            return tg.timezone if tg and tg.timezone else "Africa/Nairobi"

        return await _get()
    except Exception:
        return "Africa/Nairobi"


async def _record_and_forget(chat_id: str, user_msg: str, reply: str):
    try:
        await MemoryManager.record_turn(chat_id, user_msg, reply)
    except Exception as exc:
        logger.error(f"MemoryManager.record_turn failed for chat={chat_id}: {exc}")


async def _get_pending(chat_id: str) -> dict | None:
    try:
        raw = _redis().get(f"tg:pending:{chat_id}")
        if raw:
            return json.loads(raw if isinstance(raw, str) else raw.decode())
    except Exception:
        pass
    return None


async def _set_pending(chat_id: str, data: dict):
    _redis().setex(f"tg:pending:{chat_id}", 600, json.dumps(data))


async def _clear_pending(chat_id: str):
    _redis().delete(f"tg:pending:{chat_id}")


# ---------------------------------------------------------------------------
# Core processing
# ---------------------------------------------------------------------------

async def _process_and_reply(chat_id: str, text: str, system_prompt: str = "") -> None:
    token = _get_token()
    if not token:
        return

    await _send_typing(chat_id)

    # ── 1. Check for pending confirmation (text-based, backward compat) ──
    pending = await _get_pending(chat_id)
    if pending and text.lower() in (
        "yes", "confirm", "ok", "y", "proceed", "go ahead", "accept",
    ):
        await _handle_confirmation(chat_id, confirmed=True)
        return

    if pending and text.lower() in ("no", "cancel", "n", "stop", "never mind"):
        await _clear_pending(chat_id)
        reply = "❌ Cancelled\\. What else can I help with?"
        await _record_and_forget(chat_id, text, reply)
        await _send_message(chat_id, reply)
        return

    # ── 2. Build conversation context ──────────────────────────────
    context_prompt = await _build_context_for_llm(chat_id)
    if not system_prompt:
        system_prompt = _MATHIA_TG_SYSTEM_PROMPT

    # ── 3. Parse intent (rule-based → LLM fallback) ────────────────
    from orchestration.intent_parser import parse_intent
    from orchestration.mcp_router import route_intent
    from orchestration.llm_client import get_llm_client, extract_json

    user_context = await _build_user_context(chat_id)
    intent = await parse_intent(text, user_context)
    action = intent.get("action", "")
    missing = intent.get("missing_slots") or []

    if action not in ("general_chat", "chat", "none", "", None) and missing:
        llm = get_llm_client()
        try:
            fill_raw = await llm.generate_text(
                system_prompt=(
                    "Extract the missing parameters from the user's message. "
                    "Return ONLY valid JSON: {\"parameters\": {...}}\n"
                    f"Action: {action}\nMissing: {missing}\n"
                    "Example: \"flights from Nairobi to Mombasa tomorrow\" → "
                    '{"parameters":{"origin":"NBO","destination":"MBA","departure_date":"2026-08-09"}}'
                ),
                user_prompt=text,
                max_tokens=200,
            )
            filled = extract_json(fill_raw)
            if filled and filled.get("parameters"):
                intent["parameters"] = {**intent.get("parameters", {}), **filled["parameters"]}
                intent["missing_slots"] = [
                    s for s in missing
                    if s not in filled.get("parameters", {})
                ]
        except Exception:
            pass

    reply: str = ""

    if action in ("general_chat", "chat", "none", "", None):
        llm = get_llm_client()
        try:
            llm_intent_raw = await llm.generate_text(
                system_prompt=(
                    "You are an intent classifier for Mathia, an AI assistant with these capabilities:\n"
                    "- get_weather: weather for a location\n"
                    "- search_flights, search_hotels, search_buses: travel search\n"
                    "- create_itinerary, view_itinerary: trip planning\n"
                    "- send_whatsapp, send_email, send_telegram_message: messaging\n"
                    "- set_reminder, get_calendar: scheduling\n"
                    "- search_web: web search\n"
                    "- currency_convert: currency exchange\n"
                    "- general_chat: pure conversation, no action needed\n\n"
                    "Given the user message, return valid JSON ONLY:\n"
                    '{"action":"<action>","parameters":{...},"is_chat":true/false}\n'
                    '"is_chat":true means this is just conversation, no tool needed.\n\n'
                    "Example: 'what's the weather in Nairobi today?' →\n"
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
                await _set_pending(chat_id, intent)
                confirm_text = (
                    result.get("message")
                    or "⚠️ This action needs your confirmation\\."
                )
                await _send_message_with_keyboard(
                    chat_id,
                    f"{confirm_text}\n\n_Tap a button below:_",
                    _CONFIRM_KEYBOARD,
                )
                return
            elif result.get("status") == "success":
                reply = _format_result(result)
            else:
                reply = (
                    result.get("message")
                    or _format_result(result)
                    or "That didn't work\\. Try rephrasing?"
                )
        except Exception as exc:
            logger.error(f"Route intent failed: {exc}")
            reply = "❌ Sorry, I couldn't complete that\\. Try again?"
    else:
        llm = get_llm_client()
        reply = await llm.generate_text(
            system_prompt=system_prompt,
            user_prompt=context_prompt + "User: " + text,
            max_tokens=300,
        )

    if not reply:
        reply = (
            "I'm not sure how to help with that\\. "
            "Try asking about weather, travel, or reminders\\!"
        )

    # ── 5. Reply & remember ────────────────────────────────────────
    await _record_and_forget(chat_id, text, reply)
    await _send_message(chat_id, reply)
