"""
X/Twitter collector — passive, read-only feed ingestion via Nitter RSS.

Uses public Nitter instances (no API key required) to fetch a user's
timeline as RSS, then normalises into the standard CollectionPayload.

DESIGN NOTES
- Nitter is an open-source, privacy-respecting Twitter frontend. It exposes
  RSS feeds at ``/<handle>/rss`` without authentication.
- Multiple public instances are tried in order for resilience. The first
  instance that returns a 200 with valid RSS wins.
- Rate-limiting: each instance is tried once per collection tick; the
  collector sleeps 2 s between instances to avoid hammering.
- This is STRICTLY read-only. No posting, liking, retweeting, or following.
- The collector is NOT exposed as a general "any user can add their X" feature.
  It is designed for the operator's own handle, configured via Django settings
  or the CollectionSession config dict.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin

import httpx
import feedparser

from django.conf import settings
from django.utils import timezone as dj_timezone

from signet.models import IngestionRecord, CollectedPost
from signet.payload import normalize_x_rss_entry
from orchestration.security_policy import scrub_post_content, safe_log_handle
from .base import BaseCollector

logger = logging.getLogger(__name__)

# ── Nitter instance pool ────────────────────────────────────────────
# Ordered by preference. The collector tries each in turn; first 200 wins.
# These are well-known public instances. Add/remove as needed.
_DEFAULT_NITTER_INSTANCES = [
    'https://nitter.net',
    'https://nitter.poast.org',
    'https://nitter.privacydev.net',
    'https://nitter.1d4.us',
    'https://nitter.kavin.rocks',
    'https://nitter.unixfox.eu',
    'https://nitter.domain.glass',
    'https://nitter.space',
]

NITTER_INSTANCES = getattr(
    settings, 'SIGNET_NITTER_INSTANCES', _DEFAULT_NITTER_INSTANCES
)

# How long to wait between instance attempts (seconds)
NITTER_INSTANCE_DELAY = getattr(settings, 'SIGNET_NITTER_INSTANCE_DELAY', 2.0)

# Request timeout per instance (seconds)
NITTER_REQUEST_TIMEOUT = getattr(settings, 'SIGNET_NITTER_REQUEST_TIMEOUT', 15.0)

# Max posts to collect per tick
NITTER_MAX_POSTS = getattr(settings, 'SIGNET_NITTER_MAX_POSTS', 50)


class XCollector(BaseCollector):
    """Passive X/Twitter collector using Nitter RSS feeds.

    Reads a user's public timeline via Nitter RSS. No X API key needed.
    Never posts, likes, retweets, or follows — strictly passive.
    """

    platform = 'x'

    def collect(self) -> int:
        if not self.platform_allowed():
            return 0

        config = self.session.config or {}
        handle = self._resolve_handle(config)

        if not handle:
            logger.warning('XCollector: no handle configured')
            return 0

        keywords = [
            k.strip().lower() for k in config.get('keywords', [])
            if isinstance(k, str) and k.strip()
        ]
        limit = int(config.get('limit', NITTER_MAX_POSTS))

        entries = self._fetch_rss_entries(handle)

        collected = 0
        for entry in entries:
            if collected >= limit:
                break
            if self._store_entry(entry, handle, keywords):
                collected += 1

        return collected

    # ── helpers ──────────────────────────────────────────────────────

    def _resolve_handle(self, config: dict) -> Optional[str]:
        """Resolve the X handle to collect.

        Priority:
        1. ``config['handle']`` on the CollectionSession
        2. ``SIGNET_X_DEFAULT_HANDLE`` Django setting (hard-coded for operator)
        """
        handle = config.get('handle', '').strip().lstrip('@')
        if handle:
            return handle

        default = getattr(settings, 'SIGNET_X_DEFAULT_HANDLE', '')
        return default.strip().lstrip('@') or None

    def _fetch_rss_entries(self, handle: str) -> list:
        """Try each Nitter instance in order; return parsed RSS entries."""
        self._assert_passive_only('read')

        for instance in NITTER_INSTANCES:
            url = urljoin(instance.rstrip('/') + '/', f'{handle}/rss')
            try:
                resp = httpx.get(
                    url,
                    timeout=NITTER_REQUEST_TIMEOUT,
                    headers={
                        'User-Agent': (
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                            'AppleWebKit/537.36 (KHTML, like Gecko) '
                            'Chrome/125.0.0.0 Safari/537.36'
                        ),
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                    },
                    follow_redirects=True,
                )
                if resp.status_code != 200:
                    logger.debug(
                        f'XCollector: {instance}/{handle}/rss → {resp.status_code}'
                    )
                    continue

                feed = feedparser.parse(resp.text)
                if feed.get('bozo', 0) and not feed.entries:
                    logger.debug(f'XCollector: {instance} returned unparseable feed')
                    continue

                entries = feed.entries
                if entries:
                    logger.info(
                        f'XCollector: {instance} returned {len(entries)} '
                        f'entries for @{safe_log_handle(handle)}'
                    )
                    return entries
                else:
                    logger.debug(f'XCollector: {instance} returned 0 entries')

            except httpx.RequestError as exc:
                logger.debug(f'XCollector: {instance} unreachable: {exc}')
            except Exception as exc:
                logger.warning(f'XCollector: unexpected error from {instance}: {exc}')

            # Pause between instances to be a good netizen
            time.sleep(NITTER_INSTANCE_DELAY)

        logger.warning(
            f'XCollector: all {len(NITTER_INSTANCES)} Nitter instances '
            f'failed for @{safe_log_handle(handle)}'
        )
        return []

    def _store_entry(self, entry, handle: str, keywords: list[str]) -> bool:
        """Normalise and persist a single RSS entry, deduping by platform_post_id."""
        payload = normalize_x_rss_entry(entry, handle)

        if not payload or not payload.platform_post_id:
            return False

        # Keyword filter (post-collection)
        if keywords:
            text_lower = (payload.content_text or '').lower()
            if not any(k in text_lower for k in keywords):
                return False

        # Dedup
        if IngestionRecord.objects.filter(
            platform='x', platform_post_id=payload.platform_post_id
        ).exists():
            return False

        self._log_safe(payload.author_handle, f'Collecting X post {payload.platform_post_id}')

        # PII scrub
        scrubbed, _had_pii = scrub_post_content(payload.content_text)

        # Raw payload for audit trail
        raw_data = {
            'rss_title': getattr(entry, 'title', '') or '',
            'rss_link': getattr(entry, 'link', '') or '',
            'rss_published': getattr(entry, 'published', '') or '',
            'rss_summary': getattr(entry, 'summary', '') or '',
            'author_handle': payload.author_handle,
            'platform_post_id': payload.platform_post_id,
        }

        IngestionRecord.objects.create(
            user=self.session.user,
            session=self.session,
            platform='x',
            platform_post_id=payload.platform_post_id,
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

        return True
