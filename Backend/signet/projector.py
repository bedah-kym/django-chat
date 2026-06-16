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

        # Alerts for coordination / seed high-confidence. get_or_create keyed on
        # the (stable) text so re-projection on every heartbeat doesn't spam dupes.
        for c in clist:
            for t_obj in c.tags:
                tag = t_obj.get('tag', '')
                if tag in ('coordinated_inauthentic', 'astroturfing') and float(t_obj.get('confidence', 0)) >= 0.80:
                    _, made = SignetActivity.objects.get_or_create(
                        user=user,
                        text=f'[ALERT] {handle}: {tag} (confidence {t_obj["confidence"]}) on {c.post.content_text[:100]}',
                        defaults={'is_alert': True},
                    )
                    activities_created += int(made)

    # ── Novelty alerts (from all classifications, not just eligible) ──
    novel_posts = set()
    for c in classifications:
        if c.novelty_flag and c.post_id not in novel_posts:
            novel_posts.add(c.post_id)
            handle = c.post.author_handle
            note = (c.novelty_note or 'Unknown novelty pattern').strip()
            _, made = SignetActivity.objects.get_or_create(
                user=user,
                text=f'[NOVEL] u/{handle}: {note}',
                defaults={'is_alert': True},
            )
            activities_created += int(made)

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

    # ── Narratives (GLOBAL per user, idempotent) ──
    # One narrative per content-domain tag, keyed on a STABLE label (no volatile
    # counts) and aggregated across ALL of the user's eligible classifications —
    # so repeated runs/sessions converge instead of spawning near-duplicates.
    from datetime import timedelta

    DOMAIN_TAGS = (
        'political_disinfo', 'health_misinfo', 'economic_fear',
        'identity_wedge', 'election_integrity', 'anti_institution',
    )

    # Latest eligible classification per post (a post can have versioned rows
    # from review/amend — don't double-count it).
    rows = (
        PostClassification.objects
        .filter(user=user, review_status__in=('auto_eligible', 'approved'))
        .select_related('post')
        .order_by('post_id', '-created_at')
    )
    seen_posts: set = set()
    eligible_all: list[PostClassification] = []
    for c in rows:
        if c.post_id in seen_posts:
            continue
        seen_posts.add(c.post_id)
        eligible_all.append(c)

    domain_tag_posts: dict[str, list[PostClassification]] = {}
    for c in eligible_all:
        ctags = {t.get('tag', '') for t in c.tags}
        for dt in DOMAIN_TAGS:
            if dt in ctags:
                domain_tag_posts.setdefault(dt, []).append(c)

    # Rebuild narrative-involved edges from scratch each run (cleans dangling
    # edges left by any previously-deduped narratives).
    SignetEdge.objects.filter(user=user, target_type='narrative').delete()
    SignetEdge.objects.filter(user=user, source_type='narrative').delete()

    narratives_upserted = 0
    edges_upserted = 0
    now = timezone.now()
    kept_labels: list[str] = []
    for tag, clist in domain_tag_posts.items():
        reach = sum((c.post.likes or 0) + (c.post.comments or 0) for c in clist)
        avg_conf = sum(c.overall_confidence for c in clist) / len(clist)
        latest = max(c.post.posted_at for c in clist)
        status = 'active' if latest >= now - timedelta(days=3) else 'decaying'
        label = tag.replace('_', ' ').title()  # stable key
        kept_labels.append(label)

        # Aggregate emergent themes + entities from classifications
        theme_counts: dict[str, int] = {}
        entity_counts: dict[str, int] = {}
        for c in clist:
            for t in (c.themes or []):
                theme_counts[t] = theme_counts.get(t, 0) + 1
            for e in (c.entities or []):
                entity_counts[e] = entity_counts.get(e, 0) + 1
        top_themes = [t for t, _ in sorted(theme_counts.items(), key=lambda x: -x[1])[:6]]
        top_entities = [e for e, _ in sorted(entity_counts.items(), key=lambda x: -x[1])[:6]]

        nar, _ = SignetNarrative.objects.update_or_create(
            user=user,
            label=label,
            defaults={
                'tags': [tag],
                'reach': reach,
                'status': status,
                'confidence': round(avg_conf, 4),
                'themes': top_themes,
                'entities': top_entities,
            },
        )
        narratives_upserted += 1

        # account → narrative: SEEDS (earliest poster) + AMPLIFIES (the rest)
        earliest = min(clist, key=lambda c: c.post.posted_at)
        seed_handle = earliest.post.author_handle
        seed_acct = SignetAccount.objects.filter(user=user, handle=seed_handle).first()
        if seed_acct:
            SignetEdge.objects.get_or_create(
                user=user, source_type='account', source_id=seed_acct.id,
                target_type='narrative', target_id=nar.id, edge_type='SEEDS',
            )
            edges_upserted += 1
        for handle in {c.post.author_handle for c in clist}:
            if handle == seed_handle or handle == '[deleted]':
                continue
            acct = SignetAccount.objects.filter(user=user, handle=handle).first()
            if acct:
                SignetEdge.objects.get_or_create(
                    user=user, source_type='account', source_id=acct.id,
                    target_type='narrative', target_id=nar.id, edge_type='AMPLIFIES',
                )
                edges_upserted += 1

        # narrative → hashtag
        for ht_label in {h for c in clist for h in (c.post.hashtags or [])}:
            ht = SignetHashtag.objects.filter(user=user, label=ht_label).first()
            if ht:
                SignetEdge.objects.get_or_create(
                    user=user, source_type='narrative', source_id=nar.id,
                    target_type='hashtag', target_id=ht.id, edge_type='TAGGED_WITH',
                )
                edges_upserted += 1

    # Drop narratives whose tag no longer appears (incl. the old count-labelled dupes).
    SignetNarrative.objects.filter(user=user).exclude(label__in=kept_labels).delete()

    return {
        'accounts_upserted': accounts_upserted,
        'hashtags_upserted': hashtags_upserted,
        'activities_created': activities_created,
        'narratives_upserted': narratives_upserted,
        'edges_upserted': edges_upserted,
    }
