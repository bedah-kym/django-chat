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


def _parse_nitter_tweet_id(link: str) -> str:
    """Extract the tweet ID from a Nitter RSS link.

    Nitter RSS entries have links like:
      https://nitter.net/<handle>/status/<tweet_id>
    or the canonical:
      https://twitter.com/<handle>/status/<tweet_id>
    """
    import re
    m = re.search(r'/status(?:es)?/(\d+)', link)
    return m.group(1) if m else ''


def _nitter_handle_from_link(link: str) -> str:
    """Extract the Twitter handle from a Nitter RSS link."""
    import re
    m = re.search(r'(?:twitter\.com|nitter\.[^/]+)/([A-Za-z0-9_]+)', link)
    return m.group(1) if m else ''


def _parse_nitter_title(title: str) -> tuple[str, bool, bool]:
    """Parse a Nitter RSS title into (clean_text, is_reply, is_repost).

    Nitter title patterns:
    - Plain tweet: "Author: tweet text..."
    - Reply:      "Author: @other_user tweet text..."
    - Retweet:    "RT @other_user: tweet text..."
    """
    is_repost = title.strip().upper().startswith('RT ')
    is_reply = False

    # Strip "Author: " prefix if present (format: "handle: text")
    if ':' in title:
        prefix, rest = title.split(':', 1)
        rest = rest.strip()
        if rest.startswith('@'):
            is_reply = True
        title = rest

    return title.strip(), is_reply, is_repost


def normalize_x_rss_entry(entry, default_handle: str = '') -> 'CollectionPayload':
    """Normalize a Nitter RSS feed entry into a CollectionPayload.

    ``entry`` is a feedparser entry dict-like object from a Nitter RSS feed.
    ``default_handle`` is the Twitter handle being collected (fallback if
    the entry doesn't have explicit author info).
    """
    title = getattr(entry, 'title', '') or ''
    link = getattr(entry, 'link', '') or ''
    summary = getattr(entry, 'summary', '') or ''
    published = getattr(entry, 'published', '') or ''
    author = getattr(entry, 'author', '') or ''

    # Tweet ID from the link
    tweet_id = _parse_nitter_tweet_id(link)
    if not tweet_id:
        return None

    # Author handle
    author_handle = _nitter_handle_from_link(link) or author or default_handle
    author_handle = author_handle.lstrip('@').strip()

    # Parse title for reply/repost flags
    clean_text, is_reply, is_repost = _parse_nitter_title(title)

    # Content: prefer summary (HTML-stripped by feedparser), fallback to title
    content_text = (summary or clean_text or title).strip()

    # Parse published date
    posted_at = datetime.now(timezone.utc).isoformat()
    if published:
        try:
            from feedparser import _parse_date
            parsed = _parse_date(published)
            if parsed:
                posted_at = datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
        except Exception:
            pass

    # Extract entities from content
    hashtags = _extract_hashtags(content_text)
    mentions = _extract_at_mentions(content_text)
    urls = _extract_urls(content_text)

    # For RSS we don't get engagement metrics; set to None
    return CollectionPayload(
        platform='x',
        platform_post_id=tweet_id,
        platform_author_id=author_handle,
        author_handle=f'@{author_handle}',
        content_text=content_text,
        posted_at=posted_at,
        collected_at=datetime.now(timezone.utc).isoformat(),
        likes=None,
        shares=None,
        comments=None,
        views=None,
        reach=None,
        hashtags=hashtags,
        mentions=mentions,
        urls=urls,
        media_type='text',
        language=None,
        is_reply=is_reply,
        is_repost=is_repost,
        parent_post_id=None,
        collector_version='1.0',
    )


def normalize_x_tweet(tweet, feed_type: str = 'for_you') -> 'CollectionPayload':
    """Normalize a twikit Tweet object into a CollectionPayload.

    ``tweet`` is a twikit ``Tweet`` object from ``get_latest_timeline()``
    or ``get_timeline()``. ``feed_type`` is ``"for_you"`` or ``"following"``
    and is stored in the raw_payload for downstream analysis.
    """
    tweet_id = str(getattr(tweet, 'id', ''))
    if not tweet_id:
        return None

    user = getattr(tweet, 'user', None)
    author_handle = str(getattr(user, 'screen_name', '') or 'unknown')

    text = (getattr(tweet, 'text', '') or '').strip()
    full = (getattr(tweet, 'full_text', '') or '').strip()
    content_text = full or text

    posted_at = datetime.now(timezone.utc).isoformat()
    created = getattr(tweet, 'created_at', None)
    if created is not None:
        try:
            if hasattr(created, 'isoformat'):
                posted_at = created.isoformat()
            else:
                posted_at = str(created)
        except Exception:
            pass

    likes = getattr(tweet, 'favorite_count', None)
    shares = getattr(tweet, 'retweet_count', None)
    comments = getattr(tweet, 'reply_count', None)
    views = getattr(tweet, 'view_count', None)

    hashtags = _extract_hashtags(content_text)
    mentions = _extract_at_mentions(content_text)
    urls = _extract_urls(content_text)

    is_reply = bool(getattr(tweet, 'in_reply_to_status_id', None))
    is_repost = bool(getattr(tweet, 'retweeted_status', None)) or (
        content_text.strip().upper().startswith('RT @')
    )
    parent_id = str(getattr(tweet, 'in_reply_to_status_id', '') or '') or None

    media_objs = getattr(tweet, 'media', None)
    media_type = 'text'
    if media_objs:
        if isinstance(media_objs, list) and media_objs:
            media_type = str(getattr(media_objs[0], 'type', 'text') or 'text')
        else:
            media_type = 'media'

    return CollectionPayload(
        platform='x',
        platform_post_id=tweet_id,
        platform_author_id=author_handle,
        author_handle=f'@{author_handle}',
        content_text=content_text,
        posted_at=posted_at,
        collected_at=datetime.now(timezone.utc).isoformat(),
        likes=likes,
        shares=shares,
        comments=comments,
        views=views,
        reach=views,
        hashtags=hashtags,
        mentions=mentions,
        urls=urls,
        media_type=media_type,
        language=None,
        is_reply=is_reply,
        is_repost=is_repost,
        parent_post_id=parent_id,
        collector_version='2.0',
    )
