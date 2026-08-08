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

    # Process inline — reply directly via Telegram HTTP API (no asyncio.run woes)
    from orchestration.llm_client import get_llm_client
    import httpx

    llm = get_llm_client()
    try:
        reply_text = await llm.generate_text(
            prompt=f"User says: {text}\n\nRespond helpfully in 1-3 sentences.",
            max_tokens=300,
        )
    except Exception:
        reply_text = "I received your message but had trouble generating a response. Try again!"

    try:
        from django.conf import settings as django_settings
        import os
        token = getattr(django_settings, 'TELEGRAM_BOT_TOKEN', None) or os.environ.get('TELEGRAM_BOT_TOKEN', '')
        if token:
            async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
                await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": chat_id, "text": reply_text},
                )
    except Exception as exc:
        logger.error(f"Telegram reply failed: {exc}")

    return JsonResponse({"status": "ok"})
