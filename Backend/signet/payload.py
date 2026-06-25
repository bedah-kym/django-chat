import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional


@dataclass
class CollectionPayload:
    """Standard payload schema v1.0 — all platform collectors conform to this."""
    platform: str
    platform_post_id: str
    platform_author_id: str
    author_handle: str
    content_text: str
    posted_at: str
    collected_at: str

    likes: Optional[int] = None
    shares: Optional[int] = None
    comments: Optional[int] = None
    views: Optional[int] = None
    reach: Optional[int] = None

    hashtags: list[str] = field(default_factory=list)
    mentions: list[str] = field(default_factory=list)
    urls: list[str] = field(default_factory=list)
    media_type: Optional[str] = None
    language: Optional[str] = None
    is_reply: bool = False
    is_repost: bool = False
    parent_post_id: Optional[str] = None

    collector_version: str = '1.0'

    def to_dict(self) -> dict:
        return asdict(self)


def _extract_hashtags(text: str) -> list[str]:
    return re.findall(r'#(\w+)', text)


def _extract_mentions(text: str) -> list[str]:
    return re.findall(r'u/(\w+)', text)


_URL_RE = re.compile(r'https?://[^\s)\]}\"\'<>]+')


def _extract_urls(text: str) -> list[str]:
    return _URL_RE.findall(text)


def normalize_reddit_submission(submission) -> CollectionPayload:
    text = (submission.title or '') + '\n' + (submission.selftext or '')

    return CollectionPayload(
        platform='reddit',
        platform_post_id=str(submission.id),
        platform_author_id=str(submission.author_fullname or submission.author or ''),
        author_handle=str(submission.author) if submission.author else '[deleted]',
        content_text=text.strip(),
        posted_at=datetime.fromtimestamp(submission.created_utc, tz=timezone.utc).isoformat(),
        collected_at=datetime.now(timezone.utc).isoformat(),
        likes=submission.score or None,
        shares=None,
        comments=submission.num_comments or None,
        views=None,
        reach=None,
        hashtags=_extract_hashtags(text),
        mentions=_extract_mentions(text),
        urls=_extract_urls(text),
        media_type='image' if getattr(submission, 'is_reddit_media_domain', False) else 'text',
        language=None,
        is_reply=bool(getattr(submission, 'parent_id', None)),
        is_repost=bool(getattr(submission, 'is_self', False) and submission.selftext == submission.title),
        parent_post_id=None,
        collector_version='1.0',
    )
