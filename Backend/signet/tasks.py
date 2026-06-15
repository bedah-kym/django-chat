import logging
import asyncio

from celery import shared_task
from django.utils import timezone

from signet.models import (
    CollectionSession, CollectedPost, PostClassification,
    SignetActivity, SignetReviewItem,
)
from signet.collectors import RedditCollector

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=1, ignore_result=True)
def collect_reddit_task(self, session_id: int):
    try:
        session = CollectionSession.objects.get(id=session_id)
    except CollectionSession.DoesNotExist:
        logger.error(f'collect_reddit_task: session {session_id} not found')
        return

    if session.status == 'paused':
        logger.info(f'collect_reddit_task: session {session_id} paused — skipping')
        return

    session.status = 'running'
    session.save(update_fields=['status'])

    collector = RedditCollector(session)
    count = collector.collect()

    # Leave status as 'running' so the heartbeat re-fires this session on the
    # next tick. collection_stop sets 'paused'; the management command is the
    # only one-shot path that returns to 'idle'.
    session.stats = {
        **(session.stats or {}),
        'last_run': str(timezone.now()),
        'posts_collected': count,
    }
    session.save(update_fields=['stats'])

    if count:
        subreddits = session.config.get('subreddits', [])
        for sub in subreddits:
            SignetActivity.objects.create(
                user=session.user,
                text=f'Collected {count} posts from r/{sub}',
                is_alert=False,
            )

        # Chain into tagging in batches of 5
        pending_posts = CollectedPost.objects.filter(
            session=session,
            tagging_status='pending',
        ).order_by('-posted_at')

        batch_size = 5
        for i in range(0, pending_posts.count(), batch_size):
            batch = pending_posts[i:i + batch_size]
            for post in batch:
                tag_post_task.delay(post.id, user_id=session.user_id)


@shared_task(bind=True, max_retries=1, ignore_result=True)
def tag_post_task(self, post_id: int, user_id: int):
    try:
        post = CollectedPost.objects.get(id=post_id)
    except CollectedPost.DoesNotExist:
        logger.error(f'tag_post_task: post {post_id} not found')
        return

    if post.tagging_status == 'tagged':
        return

    from signet.tagging import tag_post

    try:
        result = asyncio.run(tag_post(post, user_id=user_id))
    except Exception as e:
        logger.error(f'tag_post_task: tagging failed for post {post_id}: {e}')
        post.tagging_status = 'failed'
        post.save(update_fields=['tagging_status'])
        return

    # Medium/low (and any non-high) tagging lands in the human-review queue —
    # but only when there is an actual verdict to review. Posts the tagger
    # found no manipulation in (empty tags) are "clean", not review noise.
    # The review item must be created BEFORE the classification so the
    # immutable classification can carry the signet_review FK at insert time.
    review_item = None
    if result['review_status'] == 'pending_review' and result['tags']:
        tier = result['confidence_tier']
        gate = 'GATE 2' if tier == 'low' else 'GATE 1'
        top = result['tags'][0] if result['tags'] else {}
        excerpt = (top.get('excerpt') or post.content_text or '')[:300]
        review_item = SignetReviewItem.objects.create(
            user_id=user_id,
            gate=gate,
            verdict_tag=(top.get('tag') or 'unknown')[:100],
            target=post.author_handle[:100],
            confidence=result['overall_confidence'],
            tier=tier,
            excerpt=excerpt or post.content_text[:300],
            reason=f"Auto-flagged by tagger {result['prompt_version']}",
            model_name=f"deepseek/{result['prompt_version']}",
            decision='pending',
        )

    PostClassification.objects.create(
        post=post,
        tags=result['tags'],
        overall_confidence=result['overall_confidence'],
        prompt_version=result['prompt_version'],
        model_version=result.get('model_version', ''),
        llm_call_id=result['llm_call_id'],
        raw_llm_response=result['raw_llm_response'],
        review_status=result['review_status'],
        user_id=user_id,
        session=post.session,
        signet_review=review_item,
    )

    post.tagging_status = 'tagged'
    post.save(update_fields=['tagging_status'])

    # If this was the last pending post in the session, run projection
    remaining = CollectedPost.objects.filter(
        session=post.session,
        tagging_status='pending',
    ).count()
    if remaining == 0 and post.session:
        project_session_task.delay(post.session_id)


@shared_task(bind=True, max_retries=1, ignore_result=True)
def project_session_task(self, session_id: int):
    try:
        session = CollectionSession.objects.get(id=session_id)
    except CollectionSession.DoesNotExist:
        return

    from signet.projector import project_session
    result = project_session(session)
    logger.info(f'project_session_task: session {session_id} → {result}')


@shared_task(bind=True, max_retries=0, ignore_result=True)
def signet_heartbeat(self):
    """Celery Beat entrypoint — finds running sessions and fires collection."""
    running = CollectionSession.objects.filter(status='running')
    for session in running:
        collect_reddit_task.delay(session.id)
