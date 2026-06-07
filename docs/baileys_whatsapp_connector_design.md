# Baileys WhatsApp Integration Module

## Overview
Replace Twilio-based WhatsApp integration with self-hosted Baileys library for cost-effective, direct WhatsApp API access. This module provides a drop-in replacement for the existing WhatsApp connector while offering better cost control and reliability.

## Architecture

### Core Components

#### 1. Baileys Connector (`Backend/orchestration/connectors/baileys_whatsapp_connector.py`)
```python
import asyncio
import logging
import os
from typing import Dict, Any, Optional
from pathlib import Path

from .base_connector import BaseConnector
from orchestration.contracts import build_orchestration_result

logger = logging.getLogger(__name__)

class BaileysWhatsAppConnector(BaseConnector):
    """
    WhatsApp connector using Baileys library for direct WhatsApp Web API access.
    Replaces Twilio for cost-effective messaging.
    """

    def __init__(self):
        self.sock = None
        self.auth_path = Path("whatsapp_auth")
        self.auth_path.mkdir(exist_ok=True)
        self.is_connected = False
        self.qr_code = None

    async def connect(self) -> bool:
        """Initialize WhatsApp connection using Baileys"""
        try:
            from baileys import makeWASocket, DisconnectReason, useMultiFileAuthState

            # Load or create auth state
            auth_state = await useMultiFileAuthState(str(self.auth_path))

            self.sock = makeWASocket({
                'auth': auth_state.state,
                'printQRInTerminal': True,
                'logger': logger,
                'browser': ['Mathia', 'Chrome', '1.0.0']
            })

            # Handle connection events
            self.sock.ev.on('connection.update', self._handle_connection_update)
            self.sock.ev.on('creds.update', auth_state.saveCreds)
            self.sock.ev.on('messages.upsert', self._handle_incoming_message)

            # Wait for connection
            await self._wait_for_connection()
            return True

        except Exception as e:
            logger.error(f"Failed to connect to WhatsApp: {e}")
            return False

    async def _handle_connection_update(self, update):
        """Handle WhatsApp connection state changes"""
        if update.qr:
            self.qr_code = update.qr
            logger.info("QR Code received - scan with WhatsApp mobile app")
            # TODO: Send QR to user interface for scanning

        if update.connection == 'close':
            self.is_connected = False
            if update.lastDisconnect?.error?.output?.statusCode != DisconnectReason.loggedOut:
                # Reconnect if not logged out
                await self.connect()
        elif update.connection == 'open':
            self.is_connected = True
            logger.info("WhatsApp connected successfully")

    async def _handle_incoming_message(self, m):
        """Handle incoming WhatsApp messages"""
        # TODO: Process incoming messages for engagement queries
        pass

    async def _wait_for_connection(self, timeout: int = 60):
        """Wait for WhatsApp connection to be established"""
        import time
        start_time = time.time()

        while not self.is_connected and (time.time() - start_time) < timeout:
            await asyncio.sleep(1)

        if not self.is_connected:
            raise TimeoutError("WhatsApp connection timeout")

    async def execute(self, parameters: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send WhatsApp message using Baileys
        """
        try:
            action = parameters.get('action', 'send_message')

            if action == 'send_message':
                return await self._send_message(parameters, context)
            elif action == 'send_media':
                return await self._send_media(parameters, context)
            elif action == 'get_qr':
                return await self._get_qr_code()
            else:
                return build_orchestration_result(
                    status="error",
                    action=action,
                    message=f"Unsupported action: {action}"
                )

        except Exception as e:
            logger.error(f"WhatsApp execution error: {e}")
            return build_orchestration_result(
                status="error",
                action=parameters.get('action', 'unknown'),
                message=str(e)
            )

    async def _send_message(self, parameters: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Send text message"""
        phone_number = parameters.get('phone_number')
        message = parameters.get('message')

        if not phone_number or not message:
            return build_orchestration_result(
                status="error",
                action="send_message",
                message="Missing phone_number or message"
            )

        if not self.is_connected:
            return build_orchestration_result(
                status="error",
                action="send_message",
                message="WhatsApp not connected"
            )

        try:
            # Format phone number
            jid = self._format_phone_number(phone_number)

            # Send message
            result = await self.sock.sendMessage(jid, {
                'text': message
            })

            return build_orchestration_result(
                status="success",
                action="send_message",
                data={
                    "message_id": result.key.id,
                    "phone_number": phone_number,
                    "status": "sent"
                }
            )

        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return build_orchestration_result(
                status="error",
                action="send_message",
                message=f"Send failed: {str(e)}"
            )

    async def _send_media(self, parameters: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Send media message (image, document, etc.)"""
        phone_number = parameters.get('phone_number')
        media_url = parameters.get('media_url')
        media_type = parameters.get('media_type', 'image')
        caption = parameters.get('caption', '')

        if not phone_number or not media_url:
            return build_orchestration_result(
                status="error",
                action="send_media",
                message="Missing phone_number or media_url"
            )

        try:
            # Download media
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(media_url) as response:
                    media_data = await response.read()

            # Format phone number
            jid = self._format_phone_number(phone_number)

            # Prepare media message
            media_message = {
                'caption': caption
            }

            if media_type == 'image':
                media_message['image'] = media_data
            elif media_type == 'document':
                media_message['document'] = media_data
                media_message['fileName'] = parameters.get('filename', 'document')
            elif media_type == 'video':
                media_message['video'] = media_data
            else:
                return build_orchestration_result(
                    status="error",
                    action="send_media",
                    message=f"Unsupported media type: {media_type}"
                )

            # Send media
            result = await self.sock.sendMessage(jid, media_message)

            return build_orchestration_result(
                status="success",
                action="send_media",
                data={
                    "message_id": result.key.id,
                    "phone_number": phone_number,
                    "media_type": media_type,
                    "status": "sent"
                }
            )

        except Exception as e:
            logger.error(f"Failed to send media: {e}")
            return build_orchestration_result(
                status="error",
                action="send_media",
                message=f"Media send failed: {str(e)}"
            )

    async def _get_qr_code(self) -> Dict[str, Any]:
        """Get current QR code for authentication"""
        if self.qr_code:
            return build_orchestration_result(
                status="success",
                action="get_qr",
                data={"qr_code": self.qr_code}
            )
        else:
            return build_orchestration_result(
                status="error",
                action="get_qr",
                message="No QR code available"
            )

    def _format_phone_number(self, phone_number: str) -> str:
        """Format phone number to WhatsApp JID format"""
        # Remove any non-numeric characters
        clean_number = ''.join(filter(str.isdigit, phone_number))

        # Add country code if missing (assume US for now)
        if not clean_number.startswith(('1', '2', '3', '4', '5', '6', '7', '8', '9')):
            clean_number = '1' + clean_number

        return f"{clean_number}@s.whatsapp.net"

    async def disconnect(self):
        """Disconnect from WhatsApp"""
        if self.sock:
            await self.sock.logout()
            self.is_connected = False
```

#### 2. Requirements (`requirements.txt` additions)
```
baileys==1.0.0  # Or appropriate version
aiohttp==3.8.4
qrcode==7.3.1  # For QR code generation
```

#### 3. Action Catalog Entry
```python
{
    "action": "send_baileys_message",
    "aliases": ["baileys_whatsapp", "whatsapp_baileys"],
    "service": "baileys_whatsapp",
    "description": "Send WhatsApp message using Baileys direct API (cost-effective alternative to Twilio)",
    "params": {
        "phone_number": {"type": "string", "required": True, "description": "Recipient phone number in international format"},
        "message": {"type": "string", "required": True, "description": "Text content of the message"},
        "media_url": {"type": "string", "required": False, "description": "URL of media to attach"},
        "media_type": {"type": "string", "required": False, "description": "Type of media: image, video, document"},
        "caption": {"type": "string", "required": False, "description": "Caption for media messages"}
    },
    "return_description": "Returns message ID and delivery status",
    "risk_level": "high",
    "confirmation_policy": "always",
    "capability_gate": "allow_baileys_whatsapp",
}
```

#### 4. MCP Router Registration
```python
# In mcp_router.py
from .connectors.baileys_whatsapp_connector import BaileysWhatsAppConnector

# Add to connectors dict
"send_baileys_message": BaileysWhatsAppConnector(),
```

## Setup Instructions

### 1. Installation
```bash
pip install baileys aiohttp qrcode
```

### 2. Authentication Setup
```python
# First-time setup script
connector = BaileysWhatsAppConnector()
await connector.connect()

# This will print QR code - scan with WhatsApp mobile app
# Auth state will be saved to whatsapp_auth/ directory
```

### 3. Docker Configuration
```dockerfile
# Add to Kali agent Dockerfile
RUN apt-get update && apt-get install -y \
    nodejs \
    npm

RUN npm install -g @whiskeysockets/baileys

# For Python wrapper
RUN pip install baileys
```

## Cost Comparison

| Provider | Cost per Message | Setup Cost | Monthly Limit |
|----------|------------------|------------|---------------|
| Twilio | $0.005-0.05 | $10/month | Pay-as-you-go |
| Baileys | $0 (self-hosted) | $5/month VPS | Unlimited |
| 360Dialog | $0.005-0.03 | $15/month | Volume-based |

## Migration Strategy

### Phase 1: Parallel Operation
- Keep Twilio as primary for enterprise users
- Add Baileys as secondary option
- Test reliability and user experience

### Phase 2: Gradual Migration
- Migrate individual users to Baileys
- Maintain Twilio for high-volume enterprise accounts
- Monitor success rates and user feedback

### Phase 3: Full Replacement
- Deprecate Twilio connector
- Baileys becomes default WhatsApp method
- Enterprise users can opt for Twilio premium

## Security Considerations

### Authentication
- QR code authentication (one-time setup)
- Auth state stored securely on server
- Automatic reconnection handling

### Message Encryption
- End-to-end encryption maintained by WhatsApp
- No message content stored on our servers
- Secure auth state management

### Rate Limiting
- WhatsApp's built-in rate limits respected
- Queue system for bulk messaging
- Automatic backoff on rate limit hits

## Monitoring & Maintenance

### Health Checks
```python
# In monitoring system
async def check_whatsapp_health():
    connector = BaileysWhatsAppConnector()
    is_connected = await connector.connect()
    return {
        "service": "baileys_whatsapp",
        "status": "healthy" if is_connected else "unhealthy",
        "last_check": datetime.now()
    }
```

### Error Handling
- Automatic reconnection on disconnect
- Fallback to Twilio for critical messages
- Alert system for connection failures

### Backup Authentication
- Multiple auth state backups
- Recovery procedures for lost sessions
- Admin interface for re-authentication

## Future Enhancements

### Advanced Features
- Group messaging support
- Message reactions and replies
- Voice message support
- Location sharing
- Contact sharing

### Integration Features
- WhatsApp Business API compliance
- Multi-device support
- Webhook integration for incoming messages
- Message templates for business use

### Analytics
- Message delivery rates
- User engagement metrics
- Cost savings tracking
- Performance monitoring</content>
<parameter name="filePath">c:\Users\user\Desktop\Dev2\MATHIA-PROJECT\Backend\orchestration\connectors\baileys_whatsapp_connector.py