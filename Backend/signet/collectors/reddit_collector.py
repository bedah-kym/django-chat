import logging

import praw
from django.conf import settings
from django.utils import timezone

from signet.models import IngestionRecord, CollectedPost
from signet.payload import normalize_reddit_submission
from .base import BaseCollector

logger = logging.getLogger(__name__)


class RedditCollector(BaseCollector):
    platform = 'reddit'

    def __init__(self, session):
        super().__init__(session)
        self.reddit = praw.Reddit(
            client_id=settings.REDDIT_CLIENT_ID,
            client_secret=settings.REDDIT_CLIENT_SECRET,
            user_agent=settings.REDDIT_USER_AGENT,
        )

    def collect(self) -> int:
        if not self.platform_allowed():
            return 0

        config = self.session.config or {}
        subreddits = config.get('subreddits', ['Kenya'])
        keywords = [k.strip() for k in config.get('keywords', []) if k.strip()]
        limit = int(config.get('limit', 25))
        # When keywords are set, target them via Reddit search (sharper signal);
        # otherwise pull the newest posts from each subreddit.
        query = ' OR '.join(keywords) if keywords else None

        collected = 0
        for sub_name in subreddits:
            try:
                sub = self.reddit.subreddit(sub_name.strip())
                if query:
                    submissions = sub.search(query, sort='new', time_filter='month', limit=limit)
                else:
                    submissions = sub.new(limit=limit)
                for submission in submissions:
                    if self._store_submission(submission):
                        collected += 1
            except Exception as e:
                logger.error(f'RedditCollector: error on r/{sub_name}: {e}')

        return collected

    def _store_submission(self, submission) -> bool:
        platform_id = str(submission.id)

        if IngestionRecord.objects.filter(platform='reddit', platform_post_id=platform_id).exists():
            return False

        raw_data = {
            'id': submission.id,
            'title': submission.title,
            'selftext': submission.selftext,
            'score': submission.score,
            'num_comments': submission.num_comments,
            'created_utc': submission.created_utc,
            'author': str(submission.author) if submission.author else '[deleted]',
            'author_fullname': str(getattr(submission, 'author_fullname', '') or ''),
            'url': submission.url,
            'permalink': submission.permalink,
            'subreddit': str(submission.subreddit),
        }

        IngestionRecord.objects.create(
            user=self.session.user,
            session=self.session,
            platform='reddit',
            platform_post_id=platform_id,
            raw_payload=raw_data,
        )

        payload = normalize_reddit_submission(submission)
        CollectedPost.objects.create(
            user=self.session.user,
            session=self.session,
            platform=payload.platform,
            platform_post_id=payload.platform_post_id,
            platform_author_id=payload.platform_author_id,
            author_handle=payload.author_handle,
            content_text=payload.content_text,
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
