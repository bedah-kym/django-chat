from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_trial_summary_task():
    """Placeholder: management command not yet implemented."""
    logger.info("send_trial_summary_task: skipped (command not implemented)")
