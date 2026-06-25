import time
from django.core.cache import cache


RATE_LIMIT_KEY_PREFIX = 'signet:rate:'
REDDIT_RATE_WINDOW = 600  # 10 minutes
REDDIT_RATE_MAX_REQUESTS = 60


def check_reddit_rate_limit() -> bool:
    """Returns True if allowed, False if rate-limited."""
    key = f'{RATE_LIMIT_KEY_PREFIX}reddit'
    now = time.monotonic()
    window = cache.get(key, [])

    window = [t for t in window if now - t < REDDIT_RATE_WINDOW]
    if len(window) >= REDDIT_RATE_MAX_REQUESTS:
        return False

    window.append(now)
    cache.set(key, window, timeout=REDDIT_RATE_WINDOW + 10)
    return True
