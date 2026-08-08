"""
Telegram Bot Connector — two-way chat via Telegram Bot API.

Set TELEGRAM_BOT_TOKEN in .env (get one from @BotFather on Telegram).
Then set the webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_DOMAIN>/api/telegram/webhook/

Zero per-message cost, simple HTTP webhooks, no phone number needed.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from ..base_connector import BaseConnector
from orchestration.contracts import build_orchestration_result

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"


class TelegramBotConnector(BaseConnector):
    """Send and receive messages via Telegram Bot API."""

    def __init__(self):
        self.token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    def _ensure_client(self) -> bool:
        """Lazy-init the HTTP client. Returns False if no token configured."""
        import os
        from django.conf import settings as django_settings

        if self._client is not None:
            return True

        self.token = (
            getattr(django_settings, 'TELEGRAM_BOT_TOKEN', None)
            or os.environ.get('TELEGRAM_BOT_TOKEN', '')
        )
        if not self.token:
            logger.warning("TelegramBotConnector: TELEGRAM_BOT_TOKEN not set — cannot send messages")
            return False

        self._client = httpx.AsyncClient(timeout=httpx.Timeout(15.0))
        return True

    async def execute(self, parameters: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        if not self._ensure_client():
            return build_orchestration_result(
                status="error",
                action="send_telegram_message",
                message="TELEGRAM_BOT_TOKEN not configured",
            )

        action = parameters.get("action", "send_message")
        if action == "send_message":
            return await self._send_message(parameters)
        return build_orchestration_result(
            status="error", action=action, message=f"Unsupported action: {action}"
        )

    async def _send_message(self, params: Dict[str, Any]) -> Dict[str, Any]:
        chat_id = params.get("chat_id")
        text = params.get("message") or params.get("text", "")

        if not chat_id or not text:
            return build_orchestration_result(
                status="error", action="send_message", message="Missing chat_id or message"
            )

        try:
            url = f"{TELEGRAM_API}/bot{self.token}/sendMessage"
            resp = await self._client.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            })
            resp.raise_for_status()
            data = resp.json()

            if not data.get("ok"):
                return build_orchestration_result(
                    status="error", action="send_message",
                    message=data.get("description", "Unknown Telegram error"),
                )

            msg = data["result"]
            return build_orchestration_result(
                status="success",
                action="send_message",
                data={
                    "message_id": msg["message_id"],
                    "chat_id": chat_id,
                    "status": "sent",
                },
            )
        except httpx.HTTPError as exc:
            logger.error(f"Telegram send failed: {exc}")
            return build_orchestration_result(
                status="error", action="send_message", message=str(exc)
            )

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
