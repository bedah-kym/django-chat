from .base import BaseCollector
from .reddit_collector import RedditCollector
from .telegram_collector import TelegramCollector
from .x_collector import XCollector

# XFeedCollector (twikit) is on standby — X API changes broke twikit parsing.
# When twikit is fixed, swap back: from .x_feed_collector import XFeedCollector

__all__ = ['BaseCollector', 'RedditCollector', 'TelegramCollector', 'XCollector']
