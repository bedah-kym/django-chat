import logging

from django.utils import timezone

from signet.models import IngestionRecord, CollectedPost
from signet.payload import normalize_reddit_submission
from orchestration.security_policy import scrub_post_content, safe_log_handle, has_pii
from .base import BaseCollector
from .reddit_auth import build_reddit

logger = logging.getLogger(__name__)


class RedditCollector(BaseCollector):
    platform = 'reddit'

    def __init__(self, session):
        super().__init__(session)
        # App-only auth is fine for collecting public subreddits.
        self.reddit = build_reddit(user_context=False)

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
                logger.error(f'RedditCollector: error on r/{safe_log_handle(sub_name)}: {e}')

        return collected

    def _store_submission(self, submission) -> bool:
        platform_id = str(submission.id)

        if IngestionRecord.objects.filter(platform='reddit', platform_post_id=platform_id).exists():
            return False

        author_handle = str(submission.author) if submission.author else '[deleted]'
        self._log_safe(author_handle, f'Collecting post {platform_id}')

        # PII scrub content before storage
        title = submission.title or ''
        selftext = (getattr(submission, 'selftext', '') or '')
        full_text = f'{title}\n{selftext}'
        scrubbed, had_pii = scrub_post_content(full_text)

        raw_data = {
            'id': submission.id,
            'title': title,
            'selftext': selftext,
            'score': submission.score,
            'num_comments': submission.num_comments,
            'created_utc': submission.created_utc,
            'author': safe_log_handle(author_handle),
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
        payload.content_text = scrubbed
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
