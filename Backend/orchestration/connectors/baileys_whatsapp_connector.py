"""
Baileys WhatsApp Connector — self-hosted WhatsApp Web API.

Drop-in replacement for the Twilio-based WhatsAppConnector using the
Baileys library (WhatsApp Web multi-device protocol). Zero per-message
cost, QR-based one-time auth, persistent session state.

IMPORTANT: Baileys is a Node.js library (@whiskeysockets/baileys), not
a Python package. This connector needs a companion Node.js Baileys service
running alongside. Until that bridge is built, the connector gracefully
skips registration with a descriptive log message.

Activation: set WHATSAPP_PROVIDER=baileys in .env
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

from ..base_connector import BaseConnector
from orchestration.connectors.connector_error import ConnectorError
from orchestration.contracts import build_orchestration_result

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_phone(number: str) -> str:
    """Strip non-digits, ensure leading country code."""
    digits = "".join(ch for ch in number if ch.isdigit())
    # Heuristic: most numbers without leading + are Kenya (254)
    if digits and digits[0] not in ("1", "2", "3", "4", "5", "6", "7", "8", "9"):
        digits = "254" + digits
    return digits


def _to_jid(phone: str) -> str:
    return f"{_clean_phone(phone)}@s.whatsapp.net"


# ---------------------------------------------------------------------------
# Connector
# ---------------------------------------------------------------------------

class BaileysWhatsAppConnector(BaseConnector):
    """
    WhatsApp connector via Baileys (WhatsApp Web multi-device).

    Requires ``baileys`` Python package. Auth state is persisted under
    ``whatsapp_auth/`` in the project root. First run prints a QR code;
    scan with WhatsApp mobile app (Linked Devices).
    """

    name = "baileys_whatsapp"
    version = "1.0.0"
    actions = [
        "send_baileys_message",
        "send_baileys_media",
        "get_baileys_qr",
        "baileys_health",
    ]
    required_credentials: list[str] = []  # no API keys — QR auth

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def __init__(self):
        super().__init__()
        self._sock: Any = None
        self._is_connected = False
        self._qr_code: Optional[str] = None
        self._auth_path = Path(
            os.environ.get("BAILEYS_AUTH_DIR", "whatsapp_auth")
        )
        self._auth_path.mkdir(exist_ok=True)

    # ------------------------------------------------------------------
    # Catalog entries (auto-registered by connector_registry)
    # ------------------------------------------------------------------

    def get_action_catalog_entries(self) -> list[dict]:
        return [
            {
                "action": "send_baileys_message",
                "aliases": ["baileys_whatsapp", "whatsapp_baileys"],
                "service": "whatsapp",
                "description": (
                    "Send a WhatsApp text message via the self-hosted Baileys "
                    "connector (zero per-message cost, QR-auth)."
                ),
                "params": {
                    "phone_number": {
                        "type": "string",
                        "required": True,
                        "description": "Recipient phone in international format (e.g. +254712345678)",
                    },
                    "message": {
                        "type": "string",
                        "required": True,
                        "description": "Text content of the message",
                    },
                },
                "return_description": "Returns message ID and delivery status",
                "risk_level": "high",
                "confirmation_policy": "always",
                "capability_gate": "allow_baileys_whatsapp",
            },
            {
                "action": "send_baileys_media",
                "aliases": [],
                "service": "whatsapp",
                "description": (
                    "Send a WhatsApp media message (image, video, document) "
                    "via the Baileys connector."
                ),
                "params": {
                    "phone_number": {
                        "type": "string",
                        "required": True,
                        "description": "Recipient phone in international format",
                    },
                    "media_url": {
                        "type": "string",
                        "required": True,
                        "description": "Public URL of the media file to attach",
                    },
                    "media_type": {
                        "type": "string",
                        "required": False,
                        "description": "image, video, or document (default image)",
                    },
                    "caption": {
                        "type": "string",
                        "required": False,
                        "description": "Optional caption for the media",
                    },
                },
                "return_description": "Returns message ID and delivery status",
                "risk_level": "high",
                "confirmation_policy": "always",
                "capability_gate": "allow_baileys_whatsapp",
            },
            {
                "action": "get_baileys_qr",
                "aliases": [],
                "service": "whatsapp",
                "description": "Retrieve the current WhatsApp Web QR code for scanning (auth setup).",
                "params": {},
                "return_description": "Returns the QR code string for display",
                "risk_level": "low",
                "confirmation_policy": "never",
                "capability_gate": "allow_baileys_whatsapp",
            },
            {
                "action": "baileys_health",
                "aliases": [],
                "service": "whatsapp",
                "description": "Check whether the Baileys WhatsApp connector is connected and healthy.",
                "params": {},
                "return_description": "Returns connection state",
                "risk_level": "low",
                "confirmation_policy": "never",
                "capability_gate": "allow_baileys_whatsapp",
            },
        ]

    # ------------------------------------------------------------------
    # Config validation
    # ------------------------------------------------------------------

    def validate_config(self) -> tuple[bool, str]:
        """Check that baileys is installed."""
        try:
            import baileys  # noqa: F401
        except ImportError:
            return False, (
                "baileys package not installed. "
                "Run: pip install baileys aiohttp qrcode"
            )
        return True, "ok"

    # ------------------------------------------------------------------
    # Execute
    # ------------------------------------------------------------------

    async def execute(
        self, parameters: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        action = parameters.get("action", "send_baileys_message")

        try:
            if action == "send_baileys_message":
                return await self._send_message(parameters)
            elif action == "send_baileys_media":
                return await self._send_media(parameters)
            elif action == "get_baileys_qr":
                return await self._get_qr()
            elif action == "baileys_health":
                return await self._health_check()
            else:
                return build_orchestration_result(
                    status="error",
                    action=action,
                    message=f"Unsupported Baileys action: {action}",
                )
        except ConnectorError:
            raise
        except Exception as exc:
            logger.error("Baileys execute failed: %s", exc, exc_info=True)
            return build_orchestration_result(
                status="error",
                action=action,
                message=str(exc),
            )

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    async def _send_message(self, params: Dict[str, Any]) -> Dict[str, Any]:
        phone = params.get("phone_number")
        message = params.get("message")

        if not phone or not message:
            return build_orchestration_result(
                status="error",
                action="send_baileys_message",
                message="phone_number and message are required",
            )

        if not self._is_connected:
            connected = await self._connect()
            if not connected:
                return build_orchestration_result(
                    status="error",
                    action="send_baileys_message",
                    message="WhatsApp not connected. Scan QR code first via get_baileys_qr.",
                )

        try:
            jid = _to_jid(phone)
            result = await self._sock.sendMessage(jid, {"text": message})

            return build_orchestration_result(
                status="success",
                action="send_baileys_message",
                data={
                    "message_id": getattr(result.key, "id", None),
                    "phone_number": phone,
                    "status": "sent",
                },
            )
        except Exception as exc:
            logger.error("Baileys send failed: %s", exc)
            return build_orchestration_result(
                status="error",
                action="send_baileys_message",
                message=f"Send failed: {exc}",
            )

    async def _send_media(self, params: Dict[str, Any]) -> Dict[str, Any]:
        phone = params.get("phone_number")
        media_url = params.get("media_url")
        media_type = params.get("media_type", "image")
        caption = params.get("caption", "")

        if not phone or not media_url:
            return build_orchestration_result(
                status="error",
                action="send_baileys_media",
                message="phone_number and media_url are required",
            )

        if not self._is_connected:
            connected = await self._connect()
            if not connected:
                return build_orchestration_result(
                    status="error",
                    action="send_baileys_media",
                    message="WhatsApp not connected.",
                )

        try:
            import aiohttp

            async with aiohttp.ClientSession() as session:
                async with session.get(media_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    resp.raise_for_status()
                    media_data = await resp.read()

            jid = _to_jid(phone)
            media_msg: Dict[str, Any] = {"caption": caption}

            if media_type == "image":
                media_msg["image"] = media_data
            elif media_type == "video":
                media_msg["video"] = media_data
            elif media_type == "document":
                media_msg["document"] = media_data
                media_msg["fileName"] = params.get("filename", "document")
            else:
                return build_orchestration_result(
                    status="error",
                    action="send_baileys_media",
                    message=f"Unsupported media type: {media_type}",
                )

            result = await self._sock.sendMessage(jid, media_msg)

            return build_orchestration_result(
                status="success",
                action="send_baileys_media",
                data={
                    "message_id": getattr(result.key, "id", None),
                    "phone_number": phone,
                    "media_type": media_type,
                    "status": "sent",
                },
            )
        except Exception as exc:
            logger.error("Baileys media send failed: %s", exc)
            return build_orchestration_result(
                status="error",
                action="send_baileys_media",
                message=f"Media send failed: {exc}",
            )

    async def _get_qr(self) -> Dict[str, Any]:
        if self._is_connected:
            return build_orchestration_result(
                status="success",
                action="get_baileys_qr",
                data={"qr_code": None, "status": "already_connected"},
            )

        # Trigger connect to generate QR
        await self._connect()

        if self._qr_code:
            return build_orchestration_result(
                status="success",
                action="get_baileys_qr",
                data={"qr_code": self._qr_code, "status": "awaiting_scan"},
            )
        return build_orchestration_result(
            status="error",
            action="get_baileys_qr",
            message="No QR code available. Is the baileys package installed?",
        )

    async def _health_check(self) -> Dict[str, Any]:
        return build_orchestration_result(
            status="success",
            action="baileys_health",
            data={
                "connected": self._is_connected,
                "provider": "baileys",
            },
        )

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    async def _connect(self) -> bool:
        """Initialize WhatsApp connection. Returns True when connected."""
        if self._is_connected:
            return True

        try:
            # Lazy import so the module is importable without baileys
            from baileys import (  # type: ignore[import-untyped]
                makeWASocket,
                DisconnectReason,
                useMultiFileAuthState,
            )

            auth_state = await useMultiFileAuthState(str(self._auth_path))

            self._sock = makeWASocket({
                "auth": auth_state.state,
                "printQRInTerminal": True,
                "logger": logger,
                "browser": ["Mathia", "Chrome", "1.0.0"],
            })

            # Wire events
            self._sock.ev.on("connection.update", self._on_connection_update)
            self._sock.ev.on("creds.update", auth_state.saveCreds)

            # Wait for connection (timeboxed)
            await self._wait_for_connection(timeout=60)
            return self._is_connected

        except ImportError:
            logger.warning("Baileys package not installed — cannot connect")
            return False
        except Exception as exc:
            logger.error("Baileys connection error: %s", exc)
            return False

    def _on_connection_update(self, update: Any) -> None:
        """Handle WhatsApp connection state changes."""
        qr = getattr(update, "qr", None)
        if qr:
            self._qr_code = qr
            logger.info("Baileys QR code ready — scan with WhatsApp mobile app")

        status = getattr(update, "connection", None)
        if status == "open":
            self._is_connected = True
            self._qr_code = None
            logger.info("Baileys WhatsApp connected")
        elif status == "close":
            self._is_connected = False
            # Only reconnect if not an intentional logout
            try:
                last_dc = getattr(update, "lastDisconnect", None)
                if last_dc is not None:
                    error = getattr(last_dc, "error", None)
                    if error is not None:
                        output = getattr(error, "output", None)
                        if output is not None:
                            code = getattr(output, "statusCode", None)
                            from baileys import DisconnectReason  # type: ignore
                            if code == DisconnectReason.loggedOut:
                                logger.info("Baileys logged out — re-auth needed")
                                return
            except Exception:
                pass
            logger.info("Baileys disconnected — will reconnect on next use")
            # Schedule reconnect via asyncio (non-blocking)
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return

    async def _wait_for_connection(self, timeout: int = 60) -> None:
        deadline = time.monotonic() + timeout
        while not self._is_connected and time.monotonic() < deadline:
            await asyncio.sleep(1)

    async def disconnect(self) -> None:
        """Disconnect and clear session."""
        if self._sock is not None:
            try:
                await self._sock.logout()
            except Exception:
                pass
            self._is_connected = False
            self._qr_code = None
