import logging

from django.db.models import Count
from django.db.models.functions import TruncDate
from datetime import datetime, timedelta, date

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

logger = logging.getLogger(__name__)

from .models import (
    SignetAccount, SignetNarrative, SignetHashtag, SignetEdge,
    SignetActivity, SignetReviewItem,
    PostClassification, CollectionSession, CollectedPost,
)
from .serializers import (
    SignetAccountSerializer, SignetNarrativeSerializer, SignetHashtagSerializer,
    SignetEdgeSerializer, SignetActivitySerializer, SignetReviewItemSerializer,
)
from .projector import project_session


# ── Timeseries ─────────────────────────────────────────────────────

def _date_range(days: int, end: date) -> list[date]:
    return [end - timedelta(days=i) for i in range(days - 1, -1, -1)]


def _densify(buckets: dict[str, int], date_range: list[date]) -> list[int]:
    return [buckets.get(str(d), 0) for d in date_range]


def _account_timeseries(user, pk: int, days: int) -> list[int]:
    try:
        handle = SignetAccount.objects.get(pk=pk, user=user).handle
    except SignetAccount.DoesNotExist:
        return None

    end = date.today()
    start = end - timedelta(days=days)
    qs = (
        CollectedPost.objects.filter(
            user=user,
            author_handle=handle,
            platform='reddit',
            posted_at__date__gte=start,
            posted_at__date__lte=end,
        )
        .annotate(day=TruncDate('posted_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    buckets = {str(row['day']): row['count'] for row in qs}
    return _densify(buckets, _date_range(days, end))


def _hashtag_timeseries(user, pk: int, days: int) -> list[int]:
    try:
        label = SignetHashtag.objects.get(pk=pk, user=user).label
    except SignetHashtag.DoesNotExist:
        return None

    end = date.today()
    start = end - timedelta(days=days)
    posts = CollectedPost.objects.filter(
        user=user,
        platform='reddit',
        posted_at__date__gte=start,
        posted_at__date__lte=end,
    )
    buckets: dict[str, int] = {}
    for post in posts:
        if label in (post.hashtags or []):
            day_str = str(post.posted_at.date())
            buckets[day_str] = buckets.get(day_str, 0) + 1
    return _densify(buckets, _date_range(days, end))


def _narrative_timeseries(user, pk: int, days: int) -> list[int]:
    try:
        narrative = SignetNarrative.objects.get(pk=pk, user=user)
    except SignetNarrative.DoesNotExist:
        return None

    tag = (narrative.tags or [None])[0]
    if not tag:
        return [0] * days

    end = date.today()
    start = end - timedelta(days=days)
    qs = (
        CollectedPost.objects.filter(
            user=user,
            platform='reddit',
            posted_at__date__gte=start,
            posted_at__date__lte=end,
            classifications__tags__contains=[{'tag': tag}],
        )
        .annotate(day=TruncDate('posted_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    # Fallback (reach proxy) if the JSONB containment query matched nothing.
    if not qs.exists():
        posts = CollectedPost.objects.filter(user=user, platform='reddit', posted_at__date__gte=start, posted_at__date__lte=end)
        buckets: dict[str, int] = {}
        for post in posts:
            post_tags = {t.get('tag', '') for cl in post.classifications.all() for t in cl.tags}
            if tag in post_tags:
                day_str = str(post.posted_at.date())
                buckets[day_str] = buckets.get(day_str, 0) + (post.likes or 0) + (post.comments or 0)
        return _densify(buckets, _date_range(days, end))

    buckets = {str(row['day']): row['count'] for row in qs}
    return _densify(buckets, _date_range(days, end))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def node_timeseries(request, node_id: str):
    try:
        prefix, pk_str = node_id.split('_', 1)
        pk = int(pk_str)
    except (ValueError, IndexError):
        return Response({'error': 'Invalid node_id format'}, status=400)

    default_days = 30 if prefix == 'acc' else 14
    days = int(request.query_params.get('days', default_days))
    days = max(1, min(days, 90))

    series = None
    if prefix == 'acc':
        series = _account_timeseries(request.user, pk, days)
    elif prefix == 'nar':
        series = _narrative_timeseries(request.user, pk, days)
    elif prefix == 'tag':
        series = _hashtag_timeseries(request.user, pk, days)

    if series is None:
        return Response({'error': 'Not found'}, status=404)

    return Response({'node_id': node_id, 'days': days, 'series': series})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timeseries_bulk(request):
    """Per-day cadence for ALL of the user's nodes in one pass.

    Pulls posts + classifications + node maps in a fixed handful of queries
    and buckets in Python — NOT a query per node (that N+1 hangs the ASGI
    worker past its timeout).
    """
    from collections import defaultdict

    days = max(1, min(int(request.query_params.get('days', 7)), 90))
    user = request.user
    end = date.today()
    dr = _date_range(days, end)
    start = dr[0]

    posts = list(
        CollectedPost.objects.filter(
            user=user, platform='reddit',
            posted_at__date__gte=start, posted_at__date__lte=end,
        ).values('id', 'author_handle', 'hashtags', 'posted_at')
    )
    post_ids = [p['id'] for p in posts]

    post_tags: dict[int, set] = defaultdict(set)
    if post_ids:
        for cl in PostClassification.objects.filter(
            user=user, post_id__in=post_ids
        ).values('post_id', 'tags'):
            for t in (cl['tags'] or []):
                post_tags[cl['post_id']].add(t.get('tag', ''))

    accounts = {a.handle: a.pk for a in SignetAccount.objects.filter(user=user)}
    hashtags = {h.label: h.pk for h in SignetHashtag.objects.filter(user=user)}
    narratives = [(n.pk, (n.tags or [None])[0]) for n in SignetNarrative.objects.filter(user=user)]

    acc_c: dict = defaultdict(lambda: defaultdict(int))
    tag_c: dict = defaultdict(lambda: defaultdict(int))
    nar_c: dict = defaultdict(lambda: defaultdict(int))

    for p in posts:
        d = str(p['posted_at'].date())
        apk = accounts.get(p['author_handle'])
        if apk is not None:
            acc_c[apk][d] += 1
        for h in (p['hashtags'] or []):
            hpk = hashtags.get(h)
            if hpk is not None:
                tag_c[hpk][d] += 1
        ptags = post_tags.get(p['id'], set())
        for npk, ntag in narratives:
            if ntag and ntag in ptags:
                nar_c[npk][d] += 1

    result: dict[str, list[int]] = {}
    for pk in accounts.values():
        result[f'acc_{pk}'] = _densify(acc_c.get(pk, {}), dr)
    for npk, _ in narratives:
        result[f'nar_{npk}'] = _densify(nar_c.get(npk, {}), dr)
    for pk in hashtags.values():
        result[f'tag_{pk}'] = _densify(tag_c.get(pk, {}), dr)
    return Response(result)


class NoPagination:
    def paginate_queryset(self, queryset, request, view=None):
        return None

    def get_paginated_response(self, data):
        return Response(data)


class AccountList(generics.ListAPIView):
    serializer_class = SignetAccountSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        # Muted accounts are suppressed from triage (feed + graph).
        return SignetAccount.objects.filter(user=self.request.user, is_muted=False)


class NarrativeList(generics.ListAPIView):
    serializer_class = SignetNarrativeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetNarrative.objects.filter(user=self.request.user)


class HashtagList(generics.ListAPIView):
    serializer_class = SignetHashtagSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetHashtag.objects.filter(user=self.request.user)


class EdgeList(generics.ListAPIView):
    serializer_class = SignetEdgeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetEdge.objects.filter(user=self.request.user)


class ActivityList(generics.ListAPIView):
    serializer_class = SignetActivitySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetActivity.objects.filter(user=self.request.user)[:20]


class ReviewItemList(generics.ListAPIView):
    serializer_class = SignetReviewItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        # Only items still awaiting a decision belong in the queue; decided
        # items must not reappear after the operator acts + the view reloads.
        return (
            SignetReviewItem.objects
            .filter(user=self.request.user, decision='pending')
            .prefetch_related('classifications')  # serializer reads tag evidence + context
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decide_review(request, pk):
    decision = request.data.get('decision')
    if decision not in ('approved', 'rejected', 'amended'):
        return Response({'error': 'Invalid decision'}, status=status.HTTP_400_BAD_REQUEST)

    item = SignetReviewItem.objects.get(pk=pk, user=request.user)

    # PostClassification is immutable — approve/amend write a NEW versioned row
    # (review_status='approved'), never mutate the original. record corrections.
    affected_sessions = set()

    if decision == 'amended':
        amended_tags = request.data.get('tags', [])
        original = item.classifications.order_by('-created_at').first()
        if original:
            PostClassification.objects.create(
                post=original.post,
                tags=amended_tags,
                overall_confidence=original.overall_confidence,
                prompt_version=original.prompt_version,
                model_version=original.model_version,
                llm_call_id=original.llm_call_id,
                raw_llm_response=original.raw_llm_response,
                review_status='approved',
                user=request.user,
                session=original.session,
                signet_review=item,
            )
            if original.session_id:
                affected_sessions.add(original.session)
            _record_correction(request.user, original, amended_tags)
    elif decision == 'approved':
        # Snapshot the latest classification(s) as approved versioned rows.
        seen_posts = set()
        for c in item.classifications.order_by('-created_at'):
            if c.review_status == 'approved' or c.post_id in seen_posts:
                continue
            seen_posts.add(c.post_id)
            PostClassification.objects.create(
                post=c.post,
                tags=c.tags,
                overall_confidence=c.overall_confidence,
                prompt_version=c.prompt_version,
                model_version=c.model_version,
                llm_call_id=c.llm_call_id,
                raw_llm_response=c.raw_llm_response,
                review_status='approved',
                user=request.user,
                session=c.session,
                signet_review=item,
            )
            if c.session_id:
                affected_sessions.add(c.session)

    item.decision = decision
    item.reviewed_at = timezone.now()
    item.save()

    # Re-project so an approved verdict surfaces in the Feed/Graph immediately.
    for session in affected_sessions:
        try:
            project_session(session)
        except Exception:
            pass

    return Response({'status': 'ok', 'decision': decision})


def _record_correction(user, original, amended_tags):
    """Record an operator tag correction (original vs amended) for Phase-2 tuning.

    NOTE: orchestration.telemetry.record_correction_signal is async and requires
    a workspace_id; full wiring into that pipeline is a follow-up. For now we
    persist an auditable signal line so corrections aren't lost.
    """
    logger.info(
        'signet_tag_correction user=%s post=%s original=%s amended=%s',
        getattr(user, 'id', None), original.post_id, original.tags, amended_tags,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mute_account(request, pk):
    account = SignetAccount.objects.get(pk=pk, user=request.user)
    account.is_muted = not account.is_muted
    account.save()
    return Response({'status': 'ok', 'is_muted': account.is_muted})


# ── Collection control ──

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collection_start(request):
    subreddits = request.data.get('subreddits', ['Kenya'])
    limit = request.data.get('limit', 25)
    config = {'subreddits': subreddits if isinstance(subreddits, list) else [subreddits], 'limit': limit}

    session = CollectionSession.objects.create(
        user=request.user,
        platform='reddit',
        config=config,
        status='running',
        started_at=timezone.now(),
    )

    from signet.tasks import collect_reddit_task
    collect_reddit_task.delay(session.id)

    return Response({'status': 'started', 'session_id': session.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collection_stop(request):
    session_id = request.data.get('session_id')
    if session_id:
        session = CollectionSession.objects.get(id=session_id, user=request.user)
        session.status = 'paused'
        session.save()
        return Response({'status': 'paused', 'session_id': session.id})
    CollectionSession.objects.filter(user=request.user, status='running').update(status='paused')
    return Response({'status': 'all_paused'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def collection_status(request):
    running = CollectionSession.objects.filter(user=request.user, status='running').first()
    total_posts = CollectedPost.objects.filter(user=request.user).count()
    tagged = CollectedPost.objects.filter(user=request.user, tagging_status='tagged').count()
    accounts = SignetAccount.objects.filter(user=request.user).count()

    return Response({
        'is_collecting': bool(running),
        'session_id': running.id if running else None,
        'counts': {
            'posts_collected': total_posts,
            'posts_tagged': tagged,
            'accounts': accounts,
        },
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def collection_config(request):
    session_id = request.data.get('session_id')
    config = request.data.get('config', {})
    if session_id:
        session = CollectionSession.objects.get(id=session_id, user=request.user)
        session.config = {**(session.config or {}), **config}
        session.save()
        return Response({'status': 'updated', 'config': session.config})
    return Response({'error': 'session_id required'}, status=400)
