import asyncio
import logging

from django.conf import settings

from signet.models import IngestionRecord, CollectedPost
from signet.payload import normalize_telegram_message
from orchestration.security_policy import scrub_post_content, safe_log_handle
from .base import BaseCollector

logger = logging.getLogger(__name__)


class TelegramCollector(BaseCollector):
    """Passive Telegram collector using Pyrogram.

    Reads configured channels/chats with an authorized Telegram client. It never
    joins, posts, replies, votes, or marks content as read.
    """
    platform = 'telegram'

    def collect(self) -> int:
        if not self.platform_allowed():
            return 0
        # Pyrogram runs inside an asyncio event loop, and Django's ORM refuses to
        # run from within an async context. So fetch messages in the loop, then
        # persist them here in the surrounding synchronous context.
        messages = asyncio.run(self._collect_async())
        collected = 0
        for message in messages:
            if self._store_message(message):
                collected += 1
        return collected

    def _client(self):
        try:
            from pyrogram import Client
        except ImportError as exc:
            raise RuntimeError(
                'Pyrogram is required for Telegram collection. '
                'Install requirements.txt and rebuild the worker image.'
            ) from exc

        api_id = getattr(settings, 'TELEGRAM_API_ID', '') or ''
        api_hash = getattr(settings, 'TELEGRAM_API_HASH', '') or ''
        if not api_id or not api_hash:
            raise RuntimeError('Telegram collection requires TELEGRAM_API_ID and TELEGRAM_API_HASH.')

        session_string = getattr(settings, 'TELEGRAM_SESSION_STRING', '') or ''
        bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '') or ''
        if not session_string and not bot_token:
            raise RuntimeError(
                'Telegram collection requires TELEGRAM_SESSION_STRING for public-channel '
                'history, or TELEGRAM_BOT_TOKEN for chats the bot can access.'
            )

        kwargs = {
            'api_id': int(api_id),
            'api_hash': api_hash,
            'in_memory': True,
        }
        if session_string:
            kwargs['session_string'] = session_string
        elif bot_token:
            kwargs['bot_token'] = bot_token

        return Client('signet_telegram_collector', **kwargs)

    async def _collect_async(self) -> list:
        config = self.session.config or {}
        configured_channels = config.get('channels', getattr(settings, 'TELEGRAM_DEFAULT_CHANNELS', []))
        channels = [
            c.strip() for c in configured_channels
            if isinstance(c, str) and c.strip()
        ]
        keywords = [k.strip().lower() for k in config.get('keywords', []) if isinstance(k, str) and k.strip()]
        limit = int(config.get('limit', 50))

        if not channels:
            logger.warning('TelegramCollector: no channels configured')
            return []

        # Network-only inside the event loop — no Django ORM here. The caller
        # persists the returned messages from a synchronous context.
        messages = []
        async with self._client() as client:
            for channel in channels:
                self._assert_passive_only('read')
                try:
                    async for message in client.get_chat_history(channel, limit=limit):
                        text = (getattr(message, 'text', None) or getattr(message, 'caption', None) or '').strip()
                        if not text:
                            continue
                        if keywords and not any(k in text.lower() for k in keywords):
                            continue
                        messages.append(message)
                except Exception as exc:
                    logger.error(f'TelegramCollector: error on {safe_log_handle(channel)}: {exc}')

        return messages

    def _store_message(self, message) -> bool:
        payload = normalize_telegram_message(message)
        platform_id = payload.platform_post_id

        if IngestionRecord.objects.filter(platform='telegram', platform_post_id=platform_id).exists():
            return False

        scrubbed, _had_pii = scrub_post_content(payload.content_text)
        chat = getattr(message, 'chat', None)
        forward_chat = getattr(message, 'forward_from_chat', None)
        raw_data = {
            'chat_id': str(getattr(chat, 'id', '') or ''),
            'chat_title': str(getattr(chat, 'title', '') or ''),
            'chat_username': str(getattr(chat, 'username', '') or ''),
            'message_id': str(getattr(message, 'id', '') or getattr(message, 'message_id', '') or ''),
            'date': payload.posted_at,
            'text': scrubbed,
            'views': payload.views,
            'forwards': payload.shares,
            'forward_from_chat': str(
                getattr(forward_chat, 'title', '') or getattr(forward_chat, 'username', '') or ''
            ),
        }

        IngestionRecord.objects.create(
            user=self.session.user,
            session=self.session,
            platform='telegram',
            platform_post_id=platform_id,
            raw_payload=raw_data,
        )

        CollectedPost.objects.create(
            user=self.session.user,
            session=self.session,
            platform=payload.platform,
            platform_post_id=payload.platform_post_id,
            platform_author_id=payload.platform_author_id,
            author_handle=payload.author_handle,
            content_text=scrubbed,
            posted_at=payload.posted_at,
            collected_at=payload.collected_at,
            likes=payload.likes,
            shares=payload.shares,
            comments=payload.comments,
            views=payload.views,
            reach=payload.reach,
            hashtags=payload.hashtags,
            mentions=payload.mentions,
            urls=payload.urls,
            media_type=payload.media_type,
            language=payload.language,
            is_reply=payload.is_reply,
            is_repost=payload.is_repost,
            parent_post_id=payload.parent_post_id,
            collector_version=payload.collector_version,
        )

        self._log_safe(payload.author_handle, f'Collected Telegram message {platform_id}')
        return True
