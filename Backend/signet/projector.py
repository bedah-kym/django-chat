import logging
import math
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Count
from django.conf import settings

from .models import (
    SignetAccount, SignetHashtag, SignetActivity,
    SignetNarrative, SignetEdge,
    CollectedPost, PostClassification, CollectionSession,
)
from .coordination import compute_coordination

logger = logging.getLogger(__name__)

DOMAIN_TAGS = (
    'political_disinfo', 'health_misinfo', 'economic_fear',
    'identity_wedge', 'election_integrity', 'anti_institution',
)


def project_session(session: CollectionSession) -> dict:
    """Project a session's classifications into the display read-models.

    Rolling-window, set-based: aggregates are scoped to the last
    SIGNET_PROJECTION_WINDOW_DAYS so cost stays bounded as history grows, and
    every step is a GROUP BY / bulk op (no per-row N+1). The whole write phase
    runs in one transaction so the snapshot the frontend / decide_review reads
    is never half-built.
    """
    user = session.user
    now = timezone.now()
    window_start = now - timedelta(days=settings.SIGNET_PROJECTION_WINDOW_DAYS)
    # active/decaying split: a narrative is "active" while it still draws fresh
    # posts, "decaying" once its newest post is older than this but still inside
    # the projection window. Older than the window entirely → pruned.
    fresh_start = now - timedelta(days=1)

    # ── Source set: 1 query, windowed at the DB, dedup latest-per-post ──
    rows = list(
        PostClassification.objects
        .filter(
            user=user,
            post__posted_at__gte=window_start,
        )
        .filter(Q(review_status__in=('auto_eligible', 'approved')) | Q(tags=[]))
        .exclude(safety_excluded=True)
        .select_related('post')
        .order_by('post_id', '-created_at')
    )

    latest: dict[int, PostClassification] = {}
    for c in rows:
        if c.post_id not in latest:
            latest[c.post_id] = c
    eligible = list(latest.values())

    if not eligible:
        return {
            'accounts_upserted': 0, 'hashtags_upserted': 0,
            'activities_created': 0, 'narratives_upserted': 0, 'edges_upserted': 0,
            'coordination_edges_upserted': 0, 'clusters_upserted': 0,
        }

    # ── Session post IDs: alerts are session-scoped (this run's new finds),
    #    aggregates are window-scoped. 1 query. ──
    session_post_ids = set(
        CollectedPost.objects.filter(session=session).values_list('id', flat=True)
    )

    # ── Account post-counts: 1 query, window-scoped GROUP BY ──
    post_counts = dict(
        CollectedPost.objects
        .filter(user=user, posted_at__gte=window_start)
        .exclude(author_handle='[deleted]')
        .values('author_handle')
        .annotate(n=Count('id'))
        .values_list('author_handle', 'n')
    )

    # ── Group eligible by author ──
    author_data: dict[str, list] = {}
    for c in eligible:
        h = c.post.author_handle
        if h and h != '[deleted]':
            author_data.setdefault(h, []).append(c)

    desired_accounts: dict[str, dict] = {}
    alert_texts: list[str] = []
    novel_texts: list[str] = []
    # Coordination tags are deferred — the graph is the judge (Chunk 1).
    # Keyed by handle → list of (tag, confidence, excerpt).
    coord_data: dict[str, list[tuple[str, float, str]]] = {}

    for handle, clist in author_data.items():
        posts_count = post_counts.get(handle, 0)
        confidences = [cl.overall_confidence for cl in clist]
        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        tags = sorted(set(t for cl in clist for t_obj in cl.tags for t in [t_obj['tag']]))
        platforms = [cl.post.platform for cl in clist if cl.post.platform]
        platform = platforms[0] if platforms else 'reddit'

        # Audience reach proxy — real follower counts aren't collected, so use the
        # best engagement signal each platform exposes: Telegram views/forwards,
        # Reddit score(likes)+comments. Stored on `followers` (the model's audience
        # field) and drives influence-based tiering + the frontend threat score.
        reach = 0
        for cl in clist:
            p = cl.post
            engagement = (p.likes or 0) + (p.comments or 0) + (p.shares or 0)
            reach += max(p.views or 0, engagement)

        # Influence tier from reach (log-scaled) + sustained activity — not raw
        # post count, which the collection limit caps so everything flattens to macro.
        influence = math.log10(reach + 1)
        if influence >= 3.5 and posts_count >= 5:
            tier = 'macro'
        elif influence >= 2.0:
            tier = 'mid'
        else:
            tier = 'micro'

        desired_accounts[handle] = {
            'platform': platform,
            'tier': tier,
            'posts': posts_count,
            'followers': reach,
            'confidence': round(avg_conf, 4),
            'tags': tags,
        }

        # Collect coordination tag hits — deferred to graph-level judgement
        for c in clist:
            if c.post_id not in session_post_ids:
                continue
            for t_obj in c.tags:
                tag = t_obj.get('tag', '')
                if tag in ('coordinated_inauthentic', 'astroturfing') and float(t_obj.get('confidence', 0)) >= 0.80:
                    coord_data.setdefault(handle, []).append(
                        (tag, float(t_obj['confidence']), c.post.content_text[:100])
                    )

    # ── Novelty alerts (session-scoped, from the windowed rows) ──
    novel_posts: set[int] = set()
    for c in rows:
        if c.novelty_flag and c.post_id not in novel_posts and c.post_id in session_post_ids:
            novel_posts.add(c.post_id)
            note = (c.novelty_note or 'Unknown novelty pattern').strip()
            novel_texts.append(f'[NOVEL] u/{c.post.author_handle}: {note}')

    # ── Hashtag volumes (window-scoped, from eligible) ──
    hashtag_counts: dict[str, int] = {}
    for c in eligible:
        for tag in (c.post.hashtags or []):
            hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1

    # ── Narrative aggregation (pure Python; objects built for a bulk upsert) ──
    domain_tag_posts: dict[str, list] = {}
    for c in eligible:
        ctags = {t.get('tag', '') for t in c.tags}
        for dt in DOMAIN_TAGS:
            if dt in ctags:
                domain_tag_posts.setdefault(dt, []).append(c)

    narr_objs: list[SignetNarrative] = []
    narr_meta: dict[str, list] = {}   # label -> clist, for edge building
    kept_labels: list[str] = []
    for tag, clist in domain_tag_posts.items():
        reach = sum((c.post.likes or 0) + (c.post.comments or 0) for c in clist)
        avg_conf = sum(c.overall_confidence for c in clist) / len(clist)
        latest_ts = max(c.post.posted_at for c in clist)
        status = 'active' if latest_ts >= fresh_start else 'decaying'
        label = tag.replace('_', ' ').title()
        kept_labels.append(label)
        narr_meta[label] = clist

        theme_counts: dict[str, int] = {}
        entity_counts: dict[str, int] = {}
        for c in clist:
            for t in (c.themes or []):
                theme_counts[t] = theme_counts.get(t, 0) + 1
            for e in (c.entities or []):
                entity_counts[e] = entity_counts.get(e, 0) + 1
        top_themes = [t for t, _ in sorted(theme_counts.items(), key=lambda x: -x[1])[:6]]
        top_entities = [e for e, _ in sorted(entity_counts.items(), key=lambda x: -x[1])[:6]]

        narr_objs.append(SignetNarrative(
            user=user, label=label, tags=[tag], reach=reach, status=status,
            confidence=round(avg_conf, 4), themes=top_themes, entities=top_entities,
        ))

    # ── Single atomic write phase ──
    with transaction.atomic():
        # Accounts (prefetch-split — preserves is_muted, never deletes accounts)
        existing_accts = {
            a.handle: a
            for a in SignetAccount.objects.filter(user=user, handle__in=list(desired_accounts.keys()))
        }
        to_create_accts, to_update_accts = [], []
        for handle, fields in desired_accounts.items():
            a = existing_accts.get(handle)
            if a is None:
                to_create_accts.append(SignetAccount(
                    user=user, handle=handle, last_scanned_at=now, **fields,
                ))
            else:
                a.platform = fields['platform']
                a.tier = fields['tier']
                a.posts = fields['posts']
                a.followers = fields['followers']
                a.confidence = fields['confidence']
                a.tags = fields['tags']
                a.last_scanned_at = now
                to_update_accts.append(a)
        if to_create_accts:
            SignetAccount.objects.bulk_create(to_create_accts)
        if to_update_accts:
            SignetAccount.objects.bulk_update(
                to_update_accts,
                ['platform', 'tier', 'posts', 'followers', 'confidence', 'tags', 'last_scanned_at'],
            )
        accounts_upserted = len(to_create_accts) + len(to_update_accts)

        # ── Coordination graph layer (Chunk 1) ──
        # Runs after account upsert so SignetAccount rows exist for the edge FK targets.
        coord_result = compute_coordination(user, window_start, now)
        clusters_upserted = coord_result['clusters_upserted']
        coordination_edges_upserted = coord_result.get('edges_upserted', 0)
        account_cluster_scores: dict[int, list[float]] = coord_result.get('account_cluster_scores', {})

        # Resolve deferred coordination alerts: [ALERT] for accounts in clusters,
        # [COORD_TAG] for lone posts with no graph corroboration.
        acct_ids_lookup = dict(SignetAccount.objects.filter(user=user).values_list('handle', 'id'))
        for handle, hits in coord_data.items():
            acct_pk = acct_ids_lookup.get(handle)
            in_cluster = acct_pk is not None and acct_pk in account_cluster_scores
            for tag, conf, excerpt in hits:
                if in_cluster:
                    alert_texts.append(
                        f'[ALERT] {handle}: {tag} (confidence {conf}, '
                        f'graph corroborated — cluster score {max(account_cluster_scores[acct_pk]):.2f}) '
                        f'on {excerpt}'
                    )
                else:
                    alert_texts.append(
                        f'[COORD_TAG] {handle}: {tag} (confidence {conf}) '
                        f'on {excerpt} — no graph corroboration'
                    )

        # Activities (batched dedup on exact text)
        activities_created = 0
        all_candidates = alert_texts + novel_texts
        if all_candidates:
            existing_texts = set(
                SignetActivity.objects.filter(user=user, text__in=all_candidates)
                .values_list('text', flat=True)
            )
            to_create_activities = [
                SignetActivity(user=user, text=t, is_alert=True)
                for t in all_candidates if t not in existing_texts
            ]
            if to_create_activities:
                SignetActivity.objects.bulk_create(to_create_activities)
                activities_created = len(to_create_activities)

        # Hashtags (prefetch-split)
        existing_hts = {
            h.label: h
            for h in SignetHashtag.objects.filter(user=user, label__in=list(hashtag_counts.keys()))
        }
        to_create_ht, to_update_ht = [], []
        for label, volume in hashtag_counts.items():
            if volume <= 1:
                velocity = 'low'
            elif volume <= 5:
                velocity = 'medium'
            elif volume <= 15:
                velocity = 'high'
            else:
                velocity = 'peak'
            h = existing_hts.get(label)
            if h is None:
                to_create_ht.append(SignetHashtag(user=user, label=label, volume=volume, velocity=velocity))
            else:
                h.volume = volume
                h.velocity = velocity
                to_update_ht.append(h)
        if to_create_ht:
            SignetHashtag.objects.bulk_create(to_create_ht)
        if to_update_ht:
            SignetHashtag.objects.bulk_update(to_update_ht, ['volume', 'velocity'])
        hashtags_upserted = len(to_create_ht) + len(to_update_ht)

        # Narratives — bulk upsert via the real unique_together(user,label) constraint
        narratives_upserted = 0
        if narr_objs:
            SignetNarrative.objects.bulk_create(
                narr_objs,
                update_conflicts=True,
                unique_fields=['user', 'label'],
                update_fields=['tags', 'reach', 'status', 'confidence', 'themes', 'entities'],
            )
            narratives_upserted = len(narr_objs)
        # Prune narratives whose tag no longer appears in the window
        SignetNarrative.objects.filter(user=user).exclude(label__in=kept_labels).delete()

        # ID maps (resolved after all upserts; narrative ids re-read so we don't
        # depend on bulk_create's conflict-return PK semantics)
        acct_ids = dict(SignetAccount.objects.filter(user=user).values_list('handle', 'id'))
        ht_ids = dict(SignetHashtag.objects.filter(user=user).values_list('label', 'id'))
        narr_ids = dict(
            SignetNarrative.objects.filter(user=user, label__in=kept_labels).values_list('label', 'id')
        )

        # Edges — diff against current (no global wipe; steady state = 0 writes)
        desired: set[tuple] = set()
        for label, clist in narr_meta.items():
            nid = narr_ids.get(label)
            if not nid:
                continue
            earliest = min(clist, key=lambda c: c.post.posted_at)
            seed_handle = earliest.post.author_handle
            seed_pk = acct_ids.get(seed_handle)
            if seed_pk:
                desired.add(('account', seed_pk, 'narrative', nid, 'SEEDS'))
            for handle in {c.post.author_handle for c in clist}:
                if handle == seed_handle or handle == '[deleted]':
                    continue
                pk = acct_ids.get(handle)
                if pk:
                    desired.add(('account', pk, 'narrative', nid, 'AMPLIFIES'))
            for ht_label in {h for c in clist for h in (c.post.hashtags or [])}:
                ht_pk = ht_ids.get(ht_label)
                if ht_pk:
                    desired.add(('narrative', nid, 'hashtag', ht_pk, 'TAGGED_WITH'))

        cur = {
            (st, si, tt, ti, et): eid
            for st, si, tt, ti, et, eid in SignetEdge.objects.filter(user=user)
            .filter(Q(source_type='narrative') | Q(target_type='narrative'))
            .values_list('source_type', 'source_id', 'target_type', 'target_id', 'edge_type', 'id')
        }
        to_del = [cur[k] for k in (set(cur.keys()) - desired)]
        to_add = desired - set(cur.keys())
        if to_del:
            SignetEdge.objects.filter(id__in=to_del).delete()
        if to_add:
            SignetEdge.objects.bulk_create([
                SignetEdge(user=user, source_type=st, source_id=si,
                           target_type=tt, target_id=ti, edge_type=et)
                for (st, si, tt, ti, et) in to_add
            ], ignore_conflicts=True)
        edges_upserted = len(to_del) + len(to_add)

    return {
        'accounts_upserted': accounts_upserted,
        'hashtags_upserted': hashtags_upserted,
        'activities_created': activities_created,
        'narratives_upserted': narratives_upserted,
        'edges_upserted': edges_upserted,
        'coordination_edges_upserted': coordination_edges_upserted,
        'clusters_upserted': clusters_upserted,
    }
