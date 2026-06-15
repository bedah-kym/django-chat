import logging
from django.utils import timezone

from .models import (
    SignetAccount, SignetHashtag, SignetActivity,
    SignetNarrative, SignetEdge,
    CollectedPost, PostClassification, CollectionSession,
)

logger = logging.getLogger(__name__)


def _is_eligible(classification: PostClassification) -> bool:
    return classification.review_status in ('auto_eligible', 'approved')


def project_session(session: CollectionSession) -> dict:
    """Project classifications from a session into display models.

    Returns dict with counts: {accounts_upserted, hashtags_upserted, activities_created}
    """
    classifications = PostClassification.objects.filter(
        session=session,
    ).select_related('post')

    eligible = [c for c in classifications if _is_eligible(c)]
    if not eligible:
        logger.info(f'project_session: no eligible classifications in session {session.id}')
        return {'accounts_upserted': 0, 'hashtags_upserted': 0, 'activities_created': 0}

    user = session.user
    accounts_upserted = 0
    hashtags_upserted = 0
    activities_created = 0

    # Review items for pending classifications are created in tag_post_task at
    # classification time (so the immutable row carries the signet_review FK).

    # ── Group by author_handle ──
    author_data: dict[str, list[PostClassification]] = {}
    for c in eligible:
        handle = c.post.author_handle
        if handle and handle != '[deleted]':
            author_data.setdefault(handle, []).append(c)

    for handle, clist in author_data.items():
        posts_count = CollectedPost.objects.filter(author_handle=handle, session=session).count()
        confidences = [cl.overall_confidence for cl in clist]
        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        tags = sorted(set(t for cl in clist for t_obj in cl.tags for t in [t_obj['tag']]))

        # Tier bands
        if posts_count >= 10:
            tier = 'macro'
        elif posts_count >= 3:
            tier = 'mid'
        else:
            tier = 'micro'

        account, created = SignetAccount.objects.update_or_create(
            user=user,
            handle=handle,
            platform='reddit',
            defaults={
                'tier': tier,
                'posts': posts_count,
                'confidence': round(avg_conf, 4),
                'tags': tags,
                'last_scanned_at': timezone.now(),
            },
        )
        accounts_upserted += 1

        # Alerts for coordination / seed high-confidence
        for c in clist:
            for t_obj in c.tags:
                tag = t_obj.get('tag', '')
                if tag in ('coordinated_inauthentic', 'astroturfing') and float(t_obj.get('confidence', 0)) >= 0.80:
                    SignetActivity.objects.create(
                        user=user,
                        text=f'[ALERT] {handle}: {tag} (confidence {t_obj["confidence"]}) on {c.post.content_text[:100]}',
                        is_alert=True,
                    )
                    activities_created += 1

    # ── Hashtags ──
    hashtag_counts: dict[str, int] = {}
    posts = CollectedPost.objects.filter(session=session).exclude(author_handle='[deleted]')
    for post in posts:
        for tag in (post.hashtags or []):
            hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1

    for tag, volume in hashtag_counts.items():
        if volume <= 1:
            velocity = 'low'
        elif volume <= 5:
            velocity = 'medium'
        elif volume <= 15:
            velocity = 'high'
        else:
            velocity = 'peak'

        SignetHashtag.objects.update_or_create(
            user=user,
            label=tag,
            defaults={'volume': volume, 'velocity': velocity},
        )
        hashtags_upserted += 1

    # ── Narratives: group by dominant content-domain tag ──
    domain_tag_posts: dict[str, list[PostClassification]] = {}
    for c in eligible:
        for t_obj in c.tags:
            tag = t_obj.get('tag', '')
            if tag in (
                'political_disinfo', 'health_misinfo', 'economic_fear',
                'identity_wedge', 'election_integrity', 'anti_institution',
            ):
                domain_tag_posts.setdefault(tag, []).append(c)

    narratives_upserted = 0
    edges_upserted = 0
    for tag, clist in domain_tag_posts.items():
        if len(clist) < 1:
            continue
        reach = sum(c.post.likes or 0 for c in clist) + sum(c.post.comments or 0 for c in clist)
        hands = list({c.post.author_handle for c in clist})
        label = f'{tag.replace("_", " ").title()} — {len(hands)} accounts, {len(clist)} posts'

        nar, _ = SignetNarrative.objects.update_or_create(
            user=user,
            label=label,
            defaults={
                'tags': [tag],
                'reach': reach,
                'status': 'active',
            },
        )
        narratives_upserted += 1

        # Edges: SEEDS (earliest poster per narrative) + AMPLIFIES
        earliest = min(clist, key=lambda c: c.post.posted_at)
        SignetEdge.objects.get_or_create(
            user=user,
            source_type='account',
            source_id=SignetAccount.objects.get(user=user, handle=earliest.post.author_handle).id,
            target_type='narrative',
            target_id=nar.id,
            edge_type='SEEDS',
        )

        for c in clist:
            acct = SignetAccount.objects.filter(user=user, handle=c.post.author_handle).first()
            if acct:
                SignetEdge.objects.get_or_create(
                    user=user,
                    source_type='account',
                    source_id=acct.id,
                    target_type='narrative',
                    target_id=nar.id,
                    edge_type='AMPLIFIES',
                )
                edges_upserted += 1

        # TAGGED_WITH edges
        for ht_label in {h for c in clist for h in (c.post.hashtags or [])}:
            ht = SignetHashtag.objects.filter(user=user, label=ht_label).first()
            if ht:
                SignetEdge.objects.get_or_create(
                    user=user,
                    source_type='narrative',
                    source_id=nar.id,
                    target_type='hashtag',
                    target_id=ht.id,
                    edge_type='TAGGED_WITH',
                )
                edges_upserted += 1

    return {
        'accounts_upserted': accounts_upserted,
        'hashtags_upserted': hashtags_upserted,
        'activities_created': activities_created,
        'narratives_upserted': narratives_upserted,
        'edges_upserted': edges_upserted,
    }
