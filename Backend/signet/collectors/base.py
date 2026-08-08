import logging
from django.conf import settings
from orchestration.security_policy import safe_log_handle

logger = logging.getLogger(__name__)

ALLOWED_PLATFORMS = {'reddit', 'telegram'}
FORBIDDEN_ACTIONS = {'post', 'reply', 'follow', 'upvote', 'downvote', 'comment', 'like', 'share', 'retweet'}


class BaseCollector:
    platform: str = ''

    def __init__(self, session):
        self.session = session

    def platform_allowed(self) -> bool:
        if self.platform not in ALLOWED_PLATFORMS:
            logger.warning(f'BaseCollector: platform "{self.platform}" not in allow-list')
            return False
        return True

    def _assert_passive_only(self, action: str):
        if action.lower() in FORBIDDEN_ACTIONS:
            raise RuntimeError(
                f'BaseCollector: FORBIDDEN action "{action}". '
                f'Collectors are passive-only — reading and collecting data is permitted; '
                f'posting, replying, following, and voting are prohibited.'
            )

    def _log_safe(self, handle: str, message: str):
        logger.info(f'{message} h:{safe_log_handle(handle)}')
