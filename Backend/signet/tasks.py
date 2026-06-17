import logging
import asyncio

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings

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

    # Idempotency lock. A heartbeat that lags past one tick re-queues posts that
    # are still 'pending', so two workers can pick up the same post; both would
    # call the (paid) LLM and insert duplicate immutable PostClassification rows.
    # cache.add is atomic on Redis (sets only if absent) and the timeout
    # auto-recovers the lock if a worker dies mid-tag.
    lock_key = f'signet:tagging:{post_id}'
    if not cache.add(lock_key, '1', timeout=300):
        logger.info(f'tag_post_task: post {post_id} already being tagged — skipping')
        return

    try:
        # Re-read under the lock: a prior holder may have finished (and a fresh
        # heartbeat re-queued us) between our initial check and acquiring it.
        post.refresh_from_db(fields=['tagging_status'])
        if post.tagging_status == 'tagged':
            return

        _tag_post_locked(post, user_id)
    finally:
        cache.delete(lock_key)


def _tag_post_locked(post, user_id: int):
    post_id = post.id
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
    # Safety-excluded posts do NOT generate review items — they are people, not threats.
    review_item = None
    if not result.get('safety_excluded') and result['review_status'] == 'pending_review' and result['tags']:
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
        themes=result.get('themes', []),
        entities=result.get('entities', []),
        summary=result.get('summary', ''),
        novelty_flag=result.get('novelty_flag', False),
        novelty_note=result.get('novelty_note', ''),
        safety_category=result.get('safety_category', 'none'),
        safety_excluded=result.get('safety_excluded', False),
    )

    post.tagging_status = 'tagged'
    post.save(update_fields=['tagging_status'])

    # If this was the last pending post in the session, run projection
    remaining = CollectedPost.objects.filter(
        session=post.session,
        tagging_status='pending',
    ).count()
    if remaining == 0 and post.session:
        debounce_key = f'signet:project_pending:{post.session_id}'
        if cache.add(debounce_key, '1', timeout=settings.SIGNET_PROJECT_DEBOUNCE_SECONDS):
            project_session_task.apply_async(
                (post.session_id,),
                countdown=settings.SIGNET_PROJECT_DEBOUNCE_SECONDS,
            )


@shared_task(bind=True, max_retries=1, ignore_result=True)
def project_session_task(self, session_id: int):
    cache.delete(f'signet:project_pending:{session_id}')

    # Atomic lock to prevent concurrent projection
    lock_key = f'signet:projecting:{session_id}'
    if not cache.add(lock_key, '1', timeout=300):
        logger.info(f'project_session_task: session {session_id} already projecting — skipping')
        return

    try:
        try:
            session = CollectionSession.objects.get(id=session_id)
        except CollectionSession.DoesNotExist:
            return
        from signet.projector import project_session
        result = project_session(session)
        logger.info(f'project_session_task: session {session_id} → {result}')
    finally:
        cache.delete(lock_key)


@shared_task(bind=True, max_retries=0, ignore_result=True)
def signet_heartbeat(self):
    """Celery Beat entrypoint — finds running sessions and fires collection."""
    running = CollectionSession.objects.filter(status='running')
    for session in running:
        collect_reddit_task.delay(session.id)


@shared_task(bind=True, max_retries=0, ignore_result=True)
def signet_weekly_drift_check(self):
    """Weekly drift check — runs the golden-set eval and logs the result."""
    import json, os
    from django.conf import settings
    from signet.tagging import tag_post, PROMPT_VERSION

    golden_path = os.path.join(settings.BASE_DIR, 'signet', 'eval', 'golden_set.json')
    if not os.path.exists(golden_path):
        logger.warning('signet_weekly_drift_check: golden set not found')
        return

    with open(golden_path, 'r') as f:
        data = json.load(f)

    posts = data.get('posts', [])
    threshold = data.get('threshold_agreement', 0.85)
    correct = 0

    class DummyPost:
        def __init__(self, text):
            self.content_text = text

    import asyncio
    for post_data in posts[:20]:
        post = DummyPost(post_data['text'])
        expected_tags = set(post_data.get('expected_tags', []))
        expected_tier = post_data.get('expected_tier', 'low')
        try:
            result = asyncio.run(tag_post(post, user_id=settings.AUTH_USER_MODEL))
            actual_tags = {t['tag'] for t in result.get('tags', [])}
            actual_tier = result.get('confidence_tier', 'low')
            if actual_tags == expected_tags and actual_tier == expected_tier:
                correct += 1
        except Exception as e:
            logger.error(f'signet_weekly_drift_check: eval failed for {post_data["id"]}: {e}')

    agreement = correct / len(posts) if posts else 0
    passed = agreement >= threshold
    logger.info(
        f'signet_weekly_drift_check: {correct}/{len(posts)} = {agreement:.1%} '
        f'({"PASS" if passed else "FAIL"} vs threshold {threshold:.0%}) '
        f'tagger={PROMPT_VERSION}'
    )
