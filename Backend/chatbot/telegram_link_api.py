"""
Telegram account linking API — generates verification codes and links
Telegram chat IDs to Django user accounts.

Flow:
  1. Authenticated user hits GET /api/telegram/link/ → receives a 6-digit code
  2. User sends "/link ABC123" to the Mathia bot on Telegram
  3. Bot verifies the code, creates/link TelegramUser record
  4. All subsequent TG messages carry the user's identity
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import TelegramUser

logger = logging.getLogger(__name__)

User = get_user_model()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verify_api_auth(request: HttpRequest) -> bool:
    """Verify the request is from an authenticated user (DRF token or session)."""
    if request.user and request.user.is_authenticated:
        return True
    # Also support token auth
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Token "):
        from rest_framework.authtoken.models import Token
        key = auth_header[6:]
        try:
            token = Token.objects.select_related("user").get(key=key)
            request.user = token.user
            return True
        except Token.DoesNotExist:
            pass
    return False


def _generate_code() -> str:
    """Generate a 6-character alphanumeric code."""
    return secrets.token_hex(3).upper()[:6]


def _code_key(code: str) -> str:
    """Redis key for a link code."""
    return f"tg:link:code:{code}"


def _redis():
    from django_redis import get_redis_connection
    return get_redis_connection("default")


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(["GET", "POST"])
def telegram_link_api(request: HttpRequest) -> JsonResponse:
    """
    GET  — generate a new linking code (requires auth)
    POST — verify a code and link the TG account (internal, called by webhook)
    """
    if request.method == "GET":
        return _handle_generate_code(request)
    return _handle_verify_code(request)


def _handle_generate_code(request: HttpRequest) -> JsonResponse:
    """Generate a new linking code for the authenticated user."""
    if not _verify_api_auth(request):
        return JsonResponse({"error": "Authentication required"}, status=401)

    user = request.user
    code = _generate_code()
    r = _redis()

    # Store: code → user_id with 10-minute TTL
    payload = {
        "user_id": user.id,
        "username": user.username,
        "created_at": time.time(),
    }
    r.setex(_code_key(code), 600, __import__("json").dumps(payload))

    logger.info(
        "TG link code generated: user=%s code=%s",
        user.username, code,
    )

    return JsonResponse({
        "code": code,
        "expires_in": 600,
        "instructions": (
            f"Send this code to the Mathia bot on Telegram: /link {code}\n"
            f"Or use the deep link: https://t.me/{_bot_username()}?start=link_{code}"
        ),
    })


def _handle_verify_code(request: HttpRequest) -> JsonResponse:
    """Verify a linking code and create the TelegramUser record."""
    try:
        body = __import__("json").loads(request.body)
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    code = (body.get("code") or "").strip().upper()
    chat_id = body.get("chat_id")
    telegram_id = body.get("telegram_id")
    username = body.get("username", "")
    first_name = body.get("first_name", "")
    last_name = body.get("last_name", "")

    if not code or not chat_id:
        return JsonResponse({"error": "code and chat_id are required"}, status=400)

    # Verify the code
    r = _redis()
    raw = r.get(_code_key(code))
    if not raw:
        return JsonResponse({"error": "Invalid or expired code"}, status=400)

    try:
        payload = __import__("json").loads(
            raw if isinstance(raw, str) else raw.decode()
        )
    except Exception:
        return JsonResponse({"error": "Invalid code data"}, status=400)

    user_id = payload.get("user_id")
    if not user_id:
        return JsonResponse({"error": "Invalid code payload"}, status=400)

    # Link the TelegramUser
    try:
        django_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    tg_user, created = TelegramUser.objects.update_or_create(
        telegram_id=telegram_id or int(chat_id),
        defaults={
            "user": django_user,
            "chat_id": int(chat_id),
            "telegram_username": username,
            "first_name": first_name,
            "last_name": last_name,
            "is_authenticated": True,
        },
    )

    # Consume the code (one-time use)
    r.delete(_code_key(code))

    logger.info(
        "TG account linked: django_user=%s tg_id=%s chat_id=%s created=%s",
        django_user.username, telegram_id, chat_id, created,
    )

    return JsonResponse({
        "status": "linked",
        "username": django_user.username,
        "was_new_link": created,
    })


def _bot_username() -> str:
    """Get the bot's username from settings."""
    import os
    return (
        getattr(settings, "TELEGRAM_BOT_USERNAME", "")
        or os.environ.get("TELEGRAM_BOT_USERNAME", "MathiaBot")
    )
