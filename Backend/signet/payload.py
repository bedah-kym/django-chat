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


def _extract_at_mentions(text: str) -> list[str]:
    return re.findall(r'@([A-Za-z0-9_]{3,})', text)


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


def _dt_to_iso(value) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _chat_label(chat) -> str:
    username = getattr(chat, 'username', None)
    if username:
        return f'@{username}'
    title = getattr(chat, 'title', None) or getattr(chat, 'first_name', None)
    return str(title or getattr(chat, 'id', '') or 'unknown')


def normalize_telegram_message(message) -> CollectionPayload:
    text = (getattr(message, 'text', None) or getattr(message, 'caption', None) or '').strip()
    chat = getattr(message, 'chat', None)
    sender = getattr(message, 'from_user', None) or getattr(message, 'sender_chat', None) or chat
    chat_id = str(getattr(chat, 'id', '') or '')
    message_id = str(getattr(message, 'id', '') or getattr(message, 'message_id', '') or '')
    sender_id = str(getattr(sender, 'id', '') or chat_id)
    sender_label = _chat_label(sender)
    replies = getattr(message, 'replies', None)

    return CollectionPayload(
        platform='telegram',
        platform_post_id=f'{chat_id}:{message_id}',
        platform_author_id=sender_id,
        author_handle=f'tg:{sender_label}',
        content_text=text,
        posted_at=_dt_to_iso(getattr(message, 'date', None)),
        collected_at=datetime.now(timezone.utc).isoformat(),
        likes=None,
        shares=getattr(message, 'forwards', None),
        comments=getattr(replies, 'replies', None) if replies else None,
        views=getattr(message, 'views', None),
        reach=getattr(message, 'views', None),
        hashtags=_extract_hashtags(text),
        mentions=_extract_at_mentions(text),
        urls=_extract_urls(text),
        media_type='text' if text else 'media',
        language=None,
        is_reply=bool(getattr(message, 'reply_to_message_id', None)),
        is_repost=bool(getattr(message, 'forward_from_chat', None) or getattr(message, 'forward_from', None)),
        parent_post_id=str(getattr(message, 'reply_to_message_id', '') or '') or None,
        collector_version='1.0',
    )
