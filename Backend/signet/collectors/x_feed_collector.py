"""
X Feed collector — passive, read-only timeline ingestion via twikit.

Uses twikit (Twitter Internal API scraper) to fetch the authenticated
user's "For You" and "Following" timelines — exactly what they see when
scrolling X. Cookies are loaded from a file or Redis; login happens once
via the ``x_login`` management command.

DESIGN NOTES
- twikit sends the same HTTP requests the X web app sends — no browser needed.
- Rate limits: 500 req/15min per timeline endpoint (documented by twikit).
- Cookies persist across restarts; never call login() from the collector.
- Read-only: no posting, liking, retweeting, or following.
- Single-operator: driven by SIGNET_X_COOKIES_PATH / SIGNET_X_COOKIES_JSON.
"""

import json
import logging
import time
import base64
from datetime import datetime, timezone
from typing import Optional

from django.conf import settings
from django.core.cache import cache

from signet.models import IngestionRecord, CollectedPost
from signet.payload import normalize_x_tweet
from orchestration.security_policy import scrub_post_content, safe_log_handle
from .base import BaseCollector

logger = logging.getLogger(__name__)

# ── Rate-limit / backoff constants ──────────────────────────────────
# twikit docs: get_latest_timeline = 500/15min, get_timeline = 500/15min.
# We're well within limits at ~50 tweets per tick. Backoff is defensive.
_MAX_RETRIES = 3
_BACKOFF_BASE = 60  # seconds: 60 → 120 → 240


class XFeedCollector(BaseCollector):
    """Passive X/Twitter timeline collector using twikit (internal API).

    Fetches both "For You" (algorithmic) and "Following" (chronological)
    timelines, deduplicates, and normalises into CollectionPayload.

    Emits pipeline steps to session.stats for real-time UI tracking.
    """

    platform = 'x'

    # ── pipeline helpers ─────────────────────────────────────────────

    def _pipeline(self, name: str, status: str, detail: str = ''):
        """Record a pipeline step in session stats for the UI."""
        steps = list(self.session.stats.get('pipeline', []) or [])
        steps.append({
            'name': name,
            'status': status,
            'detail': str(detail)[:200],
            'ts': datetime.now(timezone.utc).isoformat(),
        })
        self.session.stats = {**(self.session.stats or {}), 'pipeline': steps}
        try:
            self.session.save(update_fields=['stats'])
        except Exception:
            pass

    # ── main ─────────────────────────────────────────────────────────

    def collect(self) -> int:
        if not self.platform_allowed():
            return 0

        self._pipeline('start', 'running')

        config = self.session.config or {}
        limit = int(config.get('limit', 50))
        feed_types = config.get('feed_types', ['for_you', 'following'])

        self._pipeline('cookies', 'running')
        cookies = self._load_cookies()
        if not cookies:
            self._pipeline('cookies', 'fail', 'No cookies configured')
            return 0
        self._pipeline('cookies', 'ok', f'{len(cookies)} cookies loaded')

        self._pipeline('auth', 'running')
        try:
            client = self._build_client(cookies)
            # Quick connectivity check
            import asyncio
            async def _ping():
                return await client.get_latest_timeline(count=1)
            test = asyncio.run(_ping())
            self._pipeline('auth', 'ok', f'Auth OK, timeline reachable ({len(test)} test tweets)')
        except Exception as e:
            self._pipeline('auth', 'fail', str(e)[:200])
            return 0

        tweets = self._fetch_timelines(client, feed_types, limit)
        collected = self._store_tweets(tweets, feed_types)
        self._pipeline('done', 'ok', f'{collected} posts stored')
        return collected

    # ── cookie management ────────────────────────────────────────────

    def _load_cookies(self) -> Optional[dict]:
        """Load cookies from file, env var, or Redis."""
        self._assert_passive_only('read')

        # 1) File on disk
        path = getattr(settings, 'SIGNET_X_COOKIES_PATH', 'x_cookies.json')
        try:
            import os
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as exc:
            logger.warning(f'XFeedCollector: failed to read {path}: {exc}')

        # 2) Base64-encoded env var
        b64 = getattr(settings, 'SIGNET_X_COOKIES_JSON', '')
        if b64:
            try:
                return json.loads(base64.b64decode(b64).decode('utf-8'))
            except Exception as exc:
                logger.warning(f'XFeedCollector: bad SIGNET_X_COOKIES_JSON: {exc}')

        # 3) Redis
        try:
            from django_redis import get_redis_connection
            r = get_redis_connection('default')
            raw = r.get('signet:x:cookies')
            if raw:
                return json.loads(raw.decode('utf-8') if isinstance(raw, bytes) else raw)
        except Exception:
            pass

        return None

    # ── client ───────────────────────────────────────────────────────

    def _build_client(self, cookies):
        """Build a twikit Client with pre-loaded cookies.

        Cookies come as a list of {name, value, ...} dicts from the
        browser export. twikit 2.3.3 needs (name, value) tuples.
        """
        from twikit import Client
        client = Client('en-US')
        # Handle both dict and list-of-dicts formats
        if isinstance(cookies, list):
            cookie_tuples = [(c['name'], c['value']) for c in cookies]
        else:
            cookie_tuples = [(k, v) for k, v in cookies.items()]
        client.set_cookies(cookie_tuples)
        return client

    # ── timeline fetching ────────────────────────────────────────────

    def _fetch_timelines(self, client, feed_types: list, limit: int) -> list:
        """Fetch tweets from configured feed types, deduplicate, return list."""
        seen: set[str] = set()
        all_tweets: list[dict] = []

        for feed_type in feed_types:
            self._pipeline(feed_type, 'running')
            try:
                tweets = self._fetch_one_timeline(client, feed_type, limit)
                self._pipeline(feed_type, 'ok', f'{len(tweets)} tweets')
                for t in tweets:
                    tid = str(getattr(t, 'id', ''))
                    if tid and tid not in seen:
                        seen.add(tid)
                        all_tweets.append({
                            'tweet': t,
                            'feed_type': feed_type,
                        })
            except Exception as exc:
                self._pipeline(feed_type, 'fail', str(exc)[:200])
                logger.error(
                    f'XFeedCollector: failed to fetch "{feed_type}" '
                    f'timeline: {exc}'
                )
                continue

        return all_tweets

    def _fetch_one_timeline(self, client, feed_type: str, limit: int) -> list:
        """Fetch one timeline with exponential backoff."""
        import asyncio
        self._assert_passive_only('read')

        for attempt in range(_MAX_RETRIES):
            try:
                if feed_type == 'for_you':
                    return asyncio.run(client.get_latest_timeline(count=limit))
                elif feed_type == 'following':
                    return asyncio.run(client.get_timeline(count=limit))
                else:
                    logger.warning(f'XFeedCollector: unknown feed_type "{feed_type}"')
                    return []
            except Exception as exc:
                msg = str(exc).lower()
                # Auth failures — don't retry
                if any(k in msg for k in ('401', '403', 'unauthorized', 'forbidden', 'locked')):
                    logger.error(
                        f'XFeedCollector: auth failure on "{feed_type}" — '
                        f'cookies may be expired. Run x_login to refresh.'
                    )
                    raise
                # Rate limits — backoff
                wait = _BACKOFF_BASE * (2 ** attempt)
                logger.warning(
                    f'XFeedCollector: "{feed_type}" attempt {attempt + 1} '
                    f'failed ({exc}). Backing off {wait}s.'
                )
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(wait)
                else:
                    raise

        return []

    # ── storage ──────────────────────────────────────────────────────

    def _store_tweets(self, tweets: list[dict], feed_types: list[str]) -> int:
        """Normalise and persist tweets, deduping by platform_post_id."""
        collected = 0

        for entry in tweets:
            tweet = entry['tweet']
            feed_type = entry['feed_type']

            payload = normalize_x_tweet(tweet, feed_type)
            if not payload or not payload.platform_post_id:
                continue

            # Dedup (same tweet can appear in both For You and Following)
            if IngestionRecord.objects.filter(
                platform='x', platform_post_id=payload.platform_post_id
            ).exists():
                continue

            self._log_safe(
                payload.author_handle,
                f'Collecting X [{feed_type}] post {payload.platform_post_id}'
            )

            scrubbed, _had_pii = scrub_post_content(payload.content_text)

            # Rich raw payload — everything twikit gives us
            raw_data = {
                'feed_type': feed_type,
                'tweet_id': payload.platform_post_id,
                'author_handle': payload.author_handle,
                'author_name': getattr(tweet.user, 'name', '') if hasattr(tweet, 'user') else '',
                'is_verified': getattr(tweet.user, 'verified', False) if hasattr(tweet, 'user') else False,
                'is_followed': getattr(tweet.user, 'following', False) if hasattr(tweet, 'user') else False,
                'text': payload.content_text,
                'likes': getattr(tweet, 'favorite_count', None),
                'retweets': getattr(tweet, 'retweet_count', None),
                'replies': getattr(tweet, 'reply_count', None),
                'views': getattr(tweet, 'view_count', None),
                'bookmarks': getattr(tweet, 'bookmark_count', None),
                'created_at': str(getattr(tweet, 'created_at', '')),
                'is_quote': bool(getattr(tweet, 'is_quote_status', False)),
                'has_media': bool(getattr(tweet, 'media', None)),
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

            collected += 1

        return collected
