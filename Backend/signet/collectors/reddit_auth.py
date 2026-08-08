"""Reddit auth helpers.

App-only auth (client_id/secret) reads public data. Account-scoped reads —
which subreddits the operator is subscribed to / active in — require
user-context auth via the script-app password grant (REDDIT_USERNAME +
REDDIT_PASSWORD, the app owner's account).
"""
import logging
from collections import Counter

import praw
from django.conf import settings

logger = logging.getLogger(__name__)


def build_reddit(user_context: bool = False) -> praw.Reddit:
    """Return a praw.Reddit client.

    user_context=False → app-only (public reads; what the collector uses).
    user_context=True  → authenticate as the app-owner account so account-scoped
    reads work. Raises if REDDIT_USERNAME/REDDIT_PASSWORD are not set.
    """
    kwargs = dict(
        client_id=settings.REDDIT_CLIENT_ID,
        client_secret=settings.REDDIT_CLIENT_SECRET,
        user_agent=settings.REDDIT_USER_AGENT,
    )
    if user_context:
        username = getattr(settings, 'REDDIT_USERNAME', '') or ''
        password = getattr(settings, 'REDDIT_PASSWORD', '') or ''
        if not (username and password):
            raise RuntimeError(
                'Reddit user-context auth needs REDDIT_USERNAME + REDDIT_PASSWORD in .env '
                '(script-app password grant). Only app-only credentials are currently set. '
                'If the account has 2FA, set REDDIT_PASSWORD to "password:123456" (the current code).'
            )
        kwargs.update(username=username, password=password)
    return praw.Reddit(**kwargs)


def discover_user_subreddits(activity_scan: int = 200) -> dict:
    """Discover the authenticated operator's subreddits.

    Returns {'username', 'subscribed': [name, ...], 'active': [(name, count), ...]}.
    'subscribed' = explicit subscriptions; 'active' = derived from the most recent
    comments + submissions (where the operator actually participates).
    """
    reddit = build_reddit(user_context=True)
    me = reddit.user.me()
    if me is None:
        raise RuntimeError(
            'Reddit did not authenticate as a user (reddit.user.me() is None). '
            'Check REDDIT_USERNAME/REDDIT_PASSWORD and that the app is a "script" type owned by that account.'
        )

    subscribed = sorted(
        {s.display_name for s in reddit.user.subreddits(limit=None)},
        key=str.lower,
    )

    active: Counter = Counter()
    for source in (me.comments, me.submissions):
        try:
            for item in source.new(limit=activity_scan):
                sub = getattr(item, 'subreddit', None)
                if sub is not None:
                    active[sub.display_name] += 1
        except Exception as e:  # one bad listing shouldn't sink discovery
            logger.warning(f'discover_user_subreddits: activity scan failed: {e}')

    return {
        'username': str(me),
        'subscribed': subscribed,
        'active': active.most_common(),
    }
