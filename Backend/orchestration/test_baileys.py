"""
Tests for the Baileys WhatsApp connector.

Covers:
- Phone formatting helpers
- Action catalog entries
- Config validation
- Execute dispatch with mocked Baileys socket
- Router integrity (auto-discovery)
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Phone formatting
# ---------------------------------------------------------------------------

class PhoneFormattingTests(SimpleTestCase):
    def test_clean_phone_removes_non_digits(self):
        from orchestration.connectors.baileys_whatsapp_connector import _clean_phone
        self.assertEqual(_clean_phone("+254 712 345 678"), "254712345678")

    def test_clean_phone_strips_plus(self):
        from orchestration.connectors.baileys_whatsapp_connector import _clean_phone
        self.assertEqual(_clean_phone("+1234567890"), "1234567890")

    def test_clean_phone_preserves_leading_country_code(self):
        from orchestration.connectors.baileys_whatsapp_connector import _clean_phone
        self.assertEqual(_clean_phone("254712345678"), "254712345678")

    def test_to_jid_formats_correctly(self):
        from orchestration.connectors.baileys_whatsapp_connector import _to_jid
        self.assertEqual(_to_jid("+254712345678"), "254712345678@s.whatsapp.net")

    def test_to_jid_handles_no_prefix(self):
        from orchestration.connectors.baileys_whatsapp_connector import _to_jid
        jid = _to_jid("712345678")
        self.assertTrue(jid.endswith("@s.whatsapp.net"))


# ---------------------------------------------------------------------------
# Catalog entries
# ---------------------------------------------------------------------------

class CatalogEntryTests(SimpleTestCase):
    def setUp(self):
        from orchestration.connectors.baileys_whatsapp_connector import (
            BaileysWhatsAppConnector,
        )
        self.connector = BaileysWhatsAppConnector()

    def test_four_entries_registered(self):
        entries = self.connector.get_action_catalog_entries()
        self.assertEqual(len(entries), 4)

    def test_all_entries_have_required_fields(self):
        entries = self.connector.get_action_catalog_entries()
        for entry in entries:
            self.assertIn("action", entry)
            self.assertIn("service", entry)
            self.assertIn("description", entry)
            self.assertIn("risk_level", entry)
            self.assertIn("capability_gate", entry)
            self.assertEqual(entry["capability_gate"], "allow_baileys_whatsapp")

    def test_send_message_entry_has_phone_and_message_params(self):
        entries = self.connector.get_action_catalog_entries()
        send_entry = next(e for e in entries if e["action"] == "send_baileys_message")
        self.assertIn("phone_number", send_entry["params"])
        self.assertIn("message", send_entry["params"])
        self.assertTrue(send_entry["params"]["phone_number"]["required"])
        self.assertTrue(send_entry["params"]["message"]["required"])


# ---------------------------------------------------------------------------
# Config validation
# ---------------------------------------------------------------------------

class ConfigValidationTests(SimpleTestCase):
    def test_validate_returns_true_when_baileys_installed(self):
        with patch.dict("sys.modules", {"baileys": MagicMock()}):
            from orchestration.connectors.baileys_whatsapp_connector import (
                BaileysWhatsAppConnector,
            )
            connector = BaileysWhatsAppConnector()
            ok, msg = connector.validate_config()
            self.assertTrue(ok, msg)

    def test_validate_returns_false_when_baileys_missing(self):
        # Ensure baileys is NOT in sys.modules for this test
        with patch.dict("sys.modules", {}, clear=True):
            import sys
            sys.modules.pop("baileys", None)
            from orchestration.connectors.baileys_whatsapp_connector import (
                BaileysWhatsAppConnector,
            )
            connector = BaileysWhatsAppConnector()
            ok, msg = connector.validate_config()
            self.assertFalse(ok)
            self.assertIn("not installed", msg)


# ---------------------------------------------------------------------------
# Execute — mocked socket
# ---------------------------------------------------------------------------

class ExecuteMockedTests(SimpleTestCase):
    def setUp(self):
        from orchestration.connectors.baileys_whatsapp_connector import (
            BaileysWhatsAppConnector,
        )
        self.connector = BaileysWhatsAppConnector()
        self.context = {"user_id": 1, "room": "test"}

    def test_send_message_missing_params(self):
        result = _run_async(self.connector.execute(
            {"action": "send_baileys_message", "message": "hello"},
            self.context,
        ))
        self.assertEqual(result["status"], "error")
        self.assertIn("phone_number", result["message"])

        result = _run_async(self.connector.execute(
            {"action": "send_baileys_message", "phone_number": "+254712345678"},
            self.context,
        ))
        self.assertEqual(result["status"], "error")
        self.assertIn("phone_number", result["message"])

    def test_send_media_missing_params(self):
        result = _run_async(self.connector.execute(
            {"action": "send_baileys_media", "media_url": "https://example.com/img.png"},
            self.context,
        ))
        self.assertEqual(result["status"], "error")
        self.assertIn("phone_number", result["message"])

    def test_send_message_not_connected(self):
        """Without a real socket, send fails gracefully (not connected)."""
        result = _run_async(self.connector.execute(
            {"action": "send_baileys_message", "phone_number": "+254712345678", "message": "hi"},
            self.context,
        ))
        self.assertEqual(result["status"], "error")
        self.assertIn("not connected", result["message"].lower())

    def test_health_check_returns_status(self):
        result = _run_async(self.connector.execute(
            {"action": "baileys_health"},
            self.context,
        ))
        self.assertEqual(result["status"], "success")
        self.assertIn("connected", result["data"])
        self.assertEqual(result["data"]["provider"], "baileys")

    def test_get_qr_without_connection(self):
        """QR action triggers connect which fails without baileys, returning an error."""
        result = _run_async(self.connector.execute(
            {"action": "get_baileys_qr"},
            self.context,
        ))
        # Without baileys installed, connect fails → no QR
        self.assertEqual(result["status"], "error")

    def test_unknown_action(self):
        result = _run_async(self.connector.execute(
            {"action": "unknown_action"},
            self.context,
        ))
        self.assertEqual(result["status"], "error")
        self.assertIn("Unsupported", result["message"])

    def test_send_message_with_mocked_socket(self):
        """Happy path: mock the Baileys socket, verify sendMessage is called."""
        mock_sock = MagicMock()
        mock_sock.sendMessage = AsyncMock()
        mock_result = MagicMock()
        mock_result.key.id = "msg-abc-123"
        mock_sock.sendMessage.return_value = mock_result

        self.connector._sock = mock_sock
        self.connector._is_connected = True

        result = _run_async(self.connector.execute(
            {"action": "send_baileys_message", "phone_number": "+254712345678", "message": "Hello from Mathia"},
            self.context,
        ))
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["message_id"], "msg-abc-123")
        self.assertEqual(result["data"]["status"], "sent")
        # Verify sendMessage was called with correct JID + text
        mock_sock.sendMessage.assert_called_once()
        call_args = mock_sock.sendMessage.call_args[0]
        self.assertIn("@s.whatsapp.net", call_args[0])
        self.assertEqual(call_args[1]["text"], "Hello from Mathia")

    def test_send_media_with_mocked_socket(self):
        """Happy path: mock socket + aiohttp, verify media send."""
        mock_sock = MagicMock()
        mock_sock.sendMessage = AsyncMock()
        mock_result = MagicMock()
        mock_result.key.id = "media-xyz"
        mock_sock.sendMessage.return_value = mock_result

        self.connector._sock = mock_sock
        self.connector._is_connected = True

        # Mock aiohttp to return fake bytes
        with patch("aiohttp.ClientSession.get") as mock_get:
            mock_resp = AsyncMock()
            mock_resp.raise_for_status = MagicMock()
            mock_resp.read = AsyncMock(return_value=b"fake-image-bytes")
            mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_resp)
            mock_get.return_value.__aexit__ = AsyncMock()

            result = _run_async(self.connector.execute(
                {
                    "action": "send_baileys_media",
                    "phone_number": "+254712345678",
                    "media_url": "https://example.com/photo.png",
                    "media_type": "image",
                    "caption": "Check this out",
                },
                self.context,
            ))

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["message_id"], "media-xyz")
        mock_sock.sendMessage.assert_called_once()
        call_args = mock_sock.sendMessage.call_args
        self.assertIn("image", call_args[0][1])


# ---------------------------------------------------------------------------
# Router integrity (auto-discovery)
# ---------------------------------------------------------------------------

class RouterIntegrityTests(SimpleTestCase):
    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
    def test_router_boots_with_baileys_connector(self):
        """MCPRouter init validates connector mappings — must not fail."""
        from orchestration.mcp_router import MCPRouter

        with patch("orchestration.connectors.baileys_whatsapp_connector.BaileysWhatsAppConnector.validate_config", return_value=(True, "ok")):
            router = MCPRouter()
            self.assertIn("send_baileys_message", router.connectors)
            self.assertIn("baileys_health", router.connectors)
