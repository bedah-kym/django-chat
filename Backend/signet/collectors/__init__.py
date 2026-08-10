from .base import BaseCollector
from .reddit_collector import RedditCollector
from .telegram_collector import TelegramCollector
from .x_feed_collector import XFeedCollector

# XCollector (Nitter RSS) is kept as a fallback — uncomment to use instead of XFeedCollector:
# from .x_collector import XCollector

__all__ = ['BaseCollector', 'RedditCollector', 'TelegramCollector', 'XFeedCollector']
