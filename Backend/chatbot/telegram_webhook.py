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
def telegram_webhook(request: HttpRequest) -> HttpResponse:
    if not _verify_telegram_token(request):
        return HttpResponse("Unauthorized", status=403)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    # Telegram sends either "message" or "edited_message" etc.
    message = body.get("message") or body.get("edited_message")
    if not message:
        return JsonResponse({"status": "ignored", "reason": "no message field"})

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    text = message.get("text", "").strip()

    if not chat_id or not text:
        return JsonResponse({"status": "ignored"})

    # Route through the chat pipeline — use the connector for now.
    # Inbound messages are forwarded to the orchestration router which
    # dispatches to the LLM and returns a response.
    logger.info(f"Telegram inbound: chat_id={chat_id} text={text[:80]}")

    # Quick-ack Telegram (required within ~10s to avoid retries)
    # We fire-and-forget the actual processing via Celery if desired.
    # For now, process synchronously with a short timeout.
    import asyncio
    from orchestration.connectors.telegram_bot_connector import TelegramBotConnector
    from orchestration.llm_client import get_llm_client

    async def _process_and_reply():
        llm = get_llm_client()
        try:
            reply_text = await llm.generate_text(
                prompt=f"User says: {text}\n\nRespond helpfully in 1-3 sentences.",
                max_tokens=300,
            )
        except Exception:
            reply_text = "I received your message but had trouble generating a response. Try again!"

        connector = TelegramBotConnector()
        await connector.execute(
            parameters={"action": "send_message", "chat_id": chat_id, "message": reply_text},
            context={},
        )
        await connector.close()

    try:
        asyncio.run(_process_and_reply())
    except Exception as exc:
        logger.error(f"Telegram webhook processing error: {exc}")

    return JsonResponse({"status": "ok"})
