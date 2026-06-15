import logging
from django.conf import settings

logger = logging.getLogger(__name__)

ALLOWED_PLATFORMS = {'reddit'}


class BaseCollector:
    platform: str = ''

    def __init__(self, session):
        self.session = session

    def platform_allowed(self) -> bool:
        if self.platform not in ALLOWED_PLATFORMS:
            logger.warning(f'BaseCollector: platform "{self.platform}" not in allow-list')
            return False
        return True

    def collect(self) -> int:
        raise NotImplementedError
