"""
Signet Coordination Graph Layer — Chunk 1 (Stanford IO method)

Operates on CollectedPost for one user, windowed by
settings.SIGNET_PROJECTION_WINDOW_DAYS. Excludes author_handle='[deleted]'.

Algorithm (Stanford IO "synchronized action", minimally):
  1. Per-axis co-occurrence → unordered account pairs sharing a feature in T minutes.
  2. Multi-axis gate → edge only when ≥2 distinct axes fire.
  3. Union-find cluster → connected components, each ≥ min_cluster_size.
  4. Baseline score → z-score of internal density against window-wide distribution.

Pure stdlib — no networkx, no numpy. Data is window-bounded and small.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta
from typing import Dict, List, Set, Tuple

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    CollectedPost, SignetAccount, SignetEdge, SignetCoordinationCluster,
)

logger = logging.getLogger(__name__)

# ── helpers ────────────────────────────────────────────────────────────────


def _normalise_url(url: str) -> str:
    """Strip scheme, www, trailing slash, and fragment from a URL."""
    s = url.strip().lower()
    for prefix in ('https://', 'http://'):
        if s.startswith(prefix):
            s = s[len(prefix):]
            break
    if s.startswith('www.'):
        s = s[4:]
    # fragment
    if '#' in s:
        s = s[:s.index('#')]
    s = s.rstrip('/')
    return s


def _k_shingles(text: str, k: int = 3) -> Set[str]:
    """Character k-shingle set from text (lowercased, whitespace-collapsed)."""
    t = ' '.join(text.lower().split())
    if len(t) < k:
        return {t} if t else set()
    return {t[i:i + k] for i in range(len(t) - k + 1)}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    """Jaccard similarity between two sets."""
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def _union_find_clusters(edges: List[Tuple[int, int]]) -> Dict[int, Set[int]]:
    """Union-find connected components.

    Returns dict[root -> set of node ids].
    """
    parent: Dict[int, int] = {}
    rank: Dict[int, int] = {}

    def find(x: int) -> int:
        if parent.setdefault(x, x) != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x: int, y: int) -> None:
        rx, ry = find(x), find(y)
        if rx == ry:
            return
        if rank.get(rx, 0) < rank.get(ry, 0):
            parent[rx] = ry
        elif rank.get(rx, 0) > rank.get(ry, 0):
            parent[ry] = rx
        else:
            parent[ry] = rx
            rank[rx] = rank.get(rx, 0) + 1

    for a, b in edges:
        union(a, b)

    clusters: Dict[int, Set[int]] = defaultdict(set)
    for node in parent:
        clusters[find(node)].add(node)

    return dict(clusters)


def _estimate_baseline(
    all_pairs: List[Tuple[int, int]],
    pair_axis_counts: Dict[Tuple[int, int], int],
) -> Tuple[float, float]:
    """Compute mean and std of per-pair co-occurrence axis counts."""
    if not all_pairs:
        return 0.0, 1.0
    counts = [pair_axis_counts.get(p, 0) for p in all_pairs]
    n = len(counts)
    mean = sum(counts) / n
    if n <= 1:
        return mean, 1.0
    variance = sum((c - mean) ** 2 for c in counts) / (n - 1)
    std = variance ** 0.5
    return mean, std if std > 0 else 1.0


def _axes_are_independent(axes: Set[str]) -> bool:
    """Return true when a pair has at least two non-redundant signals.

    Same hashtag + same time is common during organic trend pile-ons. Treating
    that as two independent axes turns the multi-axis gate into a false sense of
    certainty, so a surviving pair needs either a stronger content axis or two
    content features that are not just hashtag timing.

    **Known limitation — recall blind spot.** Deliberately rejecting
    {shared-hashtag, posting-time-burst} means a botnet that synchronises *only*
    hashtag + timing (paraphrased text below Jaccard threshold, no shared links)
    is invisible to this gate. In a Reddit-only deployment that is a material
    gap: real coordination campaigns routinely vary text to evade exact-match
    filters while keeping the same hashtag and post cadence.  Future recovery
    axes for this blind spot include:
      - ``near-identical-text`` at a lower Jaccard threshold (J ≈ 0.4) when the
        other two axes already fire;
      - shared-link normalisation that folds redirects / shorteners to the same
        canonical URL, making the link axis fire for campaigns that spread one
        article through different shortened URLs;
      - account-creation-date clustering (beyond the Reddit shadow — requires
        cross-platform enrichment).
    None of these are implemented here — this function stays strict by design.
    """
    if len(axes) < 2:
        return False
    if axes <= {'shared-hashtag', 'posting-time-burst'}:
        return False
    return True


# ── main entry point ───────────────────────────────────────────────────────


def compute_coordination(user, window_start, now) -> dict:
    """Run coordination detection for one user within the window.

    Called from project_session's atomic write phase.

    Returns dict with 'clusters_upserted' and 'edges_upserted'.
    """
    T = settings.SIGNET_COORD_T_MINUTES
    J = settings.SIGNET_COORD_JACCARD_THRESHOLD
    min_size = settings.SIGNET_COORD_MIN_CLUSTER_SIZE
    min_score = getattr(settings, 'SIGNET_COORD_MIN_CLUSTER_SCORE', 0.5)

    # ── Fetch posts in window (1 query) ──
    posts_qs = (
        CollectedPost.objects
        .filter(user=user, posted_at__gte=window_start)
        .exclude(author_handle='[deleted]')
        .only('id', 'author_handle', 'content_text', 'posted_at', 'urls', 'hashtags')
    )

    posts: List[dict] = []
    handle_to_post_ids: Dict[str, List[int]] = defaultdict(list)
    for p in posts_qs:
        posts.append({
            'id': p.id,
            'handle': p.author_handle,
            'text': p.content_text or '',
            'posted_at': p.posted_at,
            'urls': [u for u in (p.urls or []) if isinstance(u, str)],
            'hashtags': [h for h in (p.hashtags or []) if isinstance(h, str)],
        })
        handle_to_post_ids[p.author_handle].append(p.id)

    if not posts:
        return {'clusters_upserted': 0, 'edges_upserted': 0}

    # ── Account ID map (same pattern as projector) ──
    handles = list(handle_to_post_ids.keys())
    acct_ids: Dict[str, int] = dict(
        SignetAccount.objects.filter(user=user, handle__in=handles)
        .values_list('handle', 'id')
    )

    # ── Step 1: Per-axis co-occurrence ──────────────────────────────────
    # axis_edges[axis][(acct_A_id, acct_B_id)] = count of co-occurrences
    axis_edges: Dict[str, Dict[Tuple[int, int], int]] = {
        'shared-link': defaultdict(int),
        'shared-hashtag': defaultdict(int),
        'near-identical-text': defaultdict(int),
        'posting-time-burst': defaultdict(int),
    }

    # Index posts by handle for pair-wise lookups
    handle_posts: Dict[str, List[dict]] = defaultdict(list)
    for p in posts:
        handle_posts[p['handle']].append(p)

    # Map acct_id -> handle for the cluster labelling
    id_to_handle: Dict[int, str] = {v: k for k, v in acct_ids.items()}

    active_handles = [h for h in handle_posts if h in acct_ids]
    active_acct_ids = {acct_ids[h] for h in active_handles}

    # shared-link & shared-hashtag: group by feature, then pairwise
    for axis_name, extractor in [
        ('shared-link', lambda p: {_normalise_url(u) for u in p['urls']}),
        ('shared-hashtag', lambda p: {h.lower() for h in p['hashtags']}),
    ]:
        feature_to_posts: Dict[str, List[dict]] = defaultdict(list)
        for p in posts:
            for feat in extractor(p):
                feature_to_posts[feat].append(p)

        for feat, feat_posts in feature_to_posts.items():
            # sort by time
            feat_posts.sort(key=lambda p: p['posted_at'])
            n = len(feat_posts)
            for i in range(n):
                pi = feat_posts[i]
                hi = pi['handle']
                ai = acct_ids.get(hi)
                if ai is None:
                    continue
                for j in range(i + 1, n):
                    pj = feat_posts[j]
                    # Stop when time diff exceeds T
                    if (pj['posted_at'] - pi['posted_at']) > timedelta(minutes=T):
                        break
                    hj = pj['handle']
                    aj = acct_ids.get(hj)
                    if aj is None or ai == aj:
                        continue
                    key = (ai, aj) if ai < aj else (aj, ai)
                    axis_edges[axis_name][key] += 1

    # near-identical-text: pairwise shingle Jaccard
    text_shingles: Dict[int, Set[str]] = {}
    for p in posts:
        h = p['handle']
        aid = acct_ids.get(h)
        if aid is None:
            continue
        text_shingles[p['id']] = _k_shingles(p['text'], k=3)

    # Only compare posts from different authors, within T minutes
    post_times: Dict[int, object] = {p['id']: p['posted_at'] for p in posts}
    for h1 in active_handles:
        a1 = acct_ids[h1]
        posts1 = handle_posts[h1]
        for h2 in active_handles:
            if h2 <= h1:
                continue
            a2 = acct_ids[h2]
            posts2 = handle_posts[h2]
            for p1 in posts1:
                s1 = text_shingles.get(p1['id'])
                if not s1:
                    continue
                for p2 in posts2:
                    if abs((p1['posted_at'] - p2['posted_at']).total_seconds()) > T * 60:
                        continue
                    s2 = text_shingles.get(p2['id'])
                    if not s2:
                        continue
                    jac = _jaccard(s1, s2)
                    if jac >= J:
                        key = (a1, a2) if a1 < a2 else (a2, a1)
                        axis_edges['near-identical-text'][key] += 1

    # posting-time-burst: bucket posts by T-minute windows and hashtag,
    # flag pairs where density is anomalously high
    bucket_key_to_posts: Dict[str, List[dict]] = defaultdict(list)
    for p in posts:
        ts = p['posted_at']
        bucket_floor = ts.replace(second=0, microsecond=0)
        minute_offset = bucket_floor.minute % T
        bucket_time = bucket_floor.replace(minute=bucket_floor.minute - minute_offset)
        for ht in (p['hashtags'] or []):
            bucket_key_to_posts[f'{bucket_time.isoformat()}:{ht.lower()}'].append(p)
        # Also bucket by empty hashtag (accounts posting in same time window)
        bucket_key_to_posts[f'{bucket_time.isoformat()}:__NO_HASHTAG__'].append(p)

    # Baseline rate: average posts per T-minute bucket
    bucket_sizes = [len(v) for v in bucket_key_to_posts.values()]
    avg_bucket_size = sum(bucket_sizes) / len(bucket_sizes) if bucket_sizes else 1.0
    burst_threshold = max(avg_bucket_size * 2, 3)  # 2x baseline or at least 3

    for bucket_posts in bucket_key_to_posts.values():
        if len(bucket_posts) < burst_threshold:
            continue
        # Pairs in this burst bucket
        bucket_handles = set()
        for p in bucket_posts:
            h = p['handle']
            aid = acct_ids.get(h)
            if aid:
                bucket_handles.add((aid, h))
        bucket_acct_ids = sorted(set(aid for aid, _ in bucket_handles))
        for i in range(len(bucket_acct_ids)):
            for j in range(i + 1, len(bucket_acct_ids)):
                ai = bucket_acct_ids[i]
                aj = bucket_acct_ids[j]
                key = (ai, aj) if ai < aj else (aj, ai)
                axis_edges['posting-time-burst'][key] += 1

    # ── Step 2: Multi-axis gate ────────────────────────────────────────
    # An edge survives only if the pair appears on >= 2 distinct axes.
    all_pairs: Set[Tuple[int, int]] = set()
    for axis_edges_dict in axis_edges.values():
        all_pairs.update(axis_edges_dict.keys())

    pair_axis_counts: Dict[Tuple[int, int], int] = {}
    pair_axes: Dict[Tuple[int, int], Set[str]] = {}
    for pair in all_pairs:
        axes = {
            axis_name
            for axis_name, edges_dict in axis_edges.items()
            if pair in edges_dict
        }
        pair_axes[pair] = axes
        pair_axis_counts[pair] = len(axes)

    surviving_edges = [
        pair for pair, axes in pair_axes.items() if _axes_are_independent(axes)
    ]

    # ── Step 3: Union-find clusters ────────────────────────────────────
    raw_clusters = _union_find_clusters(surviving_edges)
    clusters = {
        root: members
        for root, members in raw_clusters.items()
        if len(members) >= min_size
    }

    # ── Step 4: Baseline score ────────────────────────────────────────
    active_ids = sorted(active_acct_ids)
    baseline_pairs = [
        (active_ids[i], active_ids[j])
        for i in range(len(active_ids))
        for j in range(i + 1, len(active_ids))
    ]
    mean_cooccur, std_cooccur = _estimate_baseline(
        baseline_pairs or list(all_pairs), pair_axis_counts,
    )
    has_baseline_contrast = any(
        pair_axis_counts.get(pair, 0) == 0 for pair in baseline_pairs
    )

    cluster_scores: Dict[int, float] = {}
    for root, members in clusters.items():
        internal_pairs = [
            (a, b) for a in members for b in members if a < b
        ]
        internal_counts = [
            pair_axis_counts.get(p, 0) for p in internal_pairs
        ]
        if internal_counts:
            cluster_mean = sum(internal_counts) / len(internal_counts)
            z = (cluster_mean - mean_cooccur) / std_cooccur if std_cooccur > 0 else 0.0
        else:
            z = 0.0
        cluster_scores[root] = round(z, 4)

    if has_baseline_contrast:
        clusters = {
            root: members
            for root, members in clusters.items()
            if cluster_scores.get(root, 0.0) >= min_score
        }

    # ── Determine per-cluster axes that fired ──
    cluster_axes: Dict[int, List[str]] = {}
    for root, members in clusters.items():
        fired_axes = []
        for axis_name, edges_dict in axis_edges.items():
            for a in members:
                for b in members:
                    if a < b and (a, b) in edges_dict:
                        fired_axes.append(axis_name)
                        break
                else:
                    continue
                break
        cluster_axes[root] = sorted(set(fired_axes))

    # ── Build cluster labels ──
    # Format: "coord-cluster-{N}" or use the most common handle prefix
    cluster_labels: Dict[int, str] = {}
    for i, root in enumerate(sorted(clusters.keys()), 1):
        members = clusters[root]
        handles_in_cluster = [id_to_handle.get(a, str(a)) for a in members]
        handles_in_cluster = [h for h in handles_in_cluster if h]
        if handles_in_cluster:
            # Use first 3 handles as label hint
            label_hint = ', '.join(sorted(handles_in_cluster)[:3])
            cluster_labels[root] = f'coord-network-{i}: {label_hint}'
        else:
            cluster_labels[root] = f'coord-network-{i}'

    # ── Wire into project_session's atomic phase ───────────────────────
    # Already inside transaction.atomic() — called from projector.
    edges_upserted = 0
    clusters_upserted = 0

    # --- PART_OF_NETWORK edges: diff against current ---
    desired_edge_set: Set[Tuple[int, int]] = set()
    for root, members in clusters.items():
        for a in members:
            for b in members:
                if a < b:
                    desired_edge_set.add((a, b))

    existing_edges = set(
        SignetEdge.objects
        .filter(
            user=user,
            source_type='account',
            target_type='account',
            edge_type='PART_OF_NETWORK',
        )
        .values_list('source_id', 'target_id')
    )

    to_del_edges = existing_edges - desired_edge_set
    to_add_edges = desired_edge_set - existing_edges

    if to_del_edges:
        q_del = Q()
        for src, tgt in to_del_edges:
            q_del |= Q(source_id=src, target_id=tgt)
        SignetEdge.objects.filter(
            user=user,
            source_type='account',
            target_type='account',
            edge_type='PART_OF_NETWORK',
        ).filter(q_del).delete()

    if to_add_edges:
        SignetEdge.objects.bulk_create([
            SignetEdge(
                user=user,
                source_type='account',
                source_id=src,
                target_type='account',
                target_id=tgt,
                edge_type='PART_OF_NETWORK',
            )
            for src, tgt in to_add_edges
        ], ignore_conflicts=True)

    edges_upserted = len(to_del_edges) + len(to_add_edges)

    # --- Cluster read-model: bulk upsert + prune ---
    kept_labels: List[str] = []
    for root, members in clusters.items():
        label = cluster_labels[root]
        kept_labels.append(label)
        SignetCoordinationCluster.objects.update_or_create(
            user=user,
            label=label,
            defaults={
                'account_ids': sorted(list(members)),
                'axes': cluster_axes.get(root, []),
                'score': cluster_scores.get(root, 0.0),
                'size': len(members),
                'status': 'active',
            },
        )

    # Prune clusters no longer in window
    SignetCoordinationCluster.objects.filter(user=user).exclude(
        label__in=kept_labels,
    ).delete()
    clusters_upserted = len(clusters)

    # --- Build a lookup: account → set of cluster scores it belongs to ---
    account_cluster_scores: Dict[int, List[float]] = defaultdict(list)
    for root, members in clusters.items():
        score = cluster_scores.get(root, 0.0)
        for a in members:
            account_cluster_scores[a].append(score)

    # Return the cluster-lookup for the projector's ALERT logic
    return {
        'clusters_upserted': clusters_upserted,
        'edges_upserted': edges_upserted,
        'account_cluster_scores': dict(account_cluster_scores),
        'cluster_labels': cluster_labels,
    }
