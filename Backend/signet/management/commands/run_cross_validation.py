"""
Management command — cross-validation harness for SIGNET (Chunk 2).

Scores SIGNET's pipeline against external ground-truth datasets.

Usage:
    python manage.py run_cross_validation --dataset stanford_io --data-dir research/datasets/stanford_io/ --user 1
    python manage.py run_cross_validation --dataset pesacheck --data-dir research/datasets/pesacheck/ --user 1
    python manage.py run_cross_validation --dataset eip --data-dir research/datasets/eip/

Datasets must be downloaded first — see research/datasets/README.md.
"""
from __future__ import annotations

import json
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model

from signet.eval.dataset_loaders import (
    get_loader, LabeledPost, LabeledAccount, LabeledClaim,
    pesacheck_is_political_disinfo,
)
from signet.coordination import compute_coordination
from signet.models import (
    CollectionSession, CollectedPost, PostClassification, SignetAccount,
    SignetCoordinationCluster, SignetEdge,
)

User = get_user_model()


class Command(BaseCommand):
    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument('--dataset', required=True,
                            choices=['stanford_io', 'pesacheck', 'eip'],
                            help='Which dataset to evaluate against')
        parser.add_argument('--data-dir', required=True,
                            help='Path to the downloaded dataset directory')
        parser.add_argument('--user', type=int, default=None,
                            help='User ID for pipeline attribution. Defaults to the first user.')
        parser.add_argument('--verbose', action='store_true',
                            help='Print per-campaign / per-claim detail')

    def handle(self, *args, **options):
        dataset_name = options['dataset']
        data_dir = options['data_dir']
        user_id = options['user']
        verbose = options['verbose']

        if user_id is None:
            user = User.objects.order_by('id').first()
            if user is None:
                raise CommandError('No users exist. Create a user or pass --user <id>.')
        else:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise CommandError(f'User id={user_id} not found')

        loader = get_loader(dataset_name, data_dir)
        self.stdout.write(f'Dataset: {dataset_name} | dir: {data_dir}')

        # Validate
        stats = loader.validate()
        self.stdout.write(json.dumps(stats, indent=2, default=str))
        if stats['errors']:
            self.stdout.write(self.style.WARNING(f'Validation warnings: {stats["errors"]}'))
            if any('No' in e and 'loaded' in e for e in stats['errors']):
                return

        # Dispatch
        if dataset_name == 'stanford_io':
            self._eval_stanford_io(loader, user, verbose)
        elif dataset_name == 'pesacheck':
            self._eval_pesacheck(loader, user, verbose)
        elif dataset_name == 'eip':
            self._eval_eip(loader, user, verbose)

    # ── Stanford IO: coordination cluster eval ──────────────────────────────

    def _eval_stanford_io(self, loader, user, verbose):
        """Score coordination clusters against Stanford IO account labels."""
        posts: list[LabeledPost] = loader.load_posts()
        accounts: list[LabeledAccount] = loader.load_accounts()

        if not posts:
            self.stdout.write(self.style.ERROR('No posts loaded — aborting'))
            return

        # Build ground truth: account_id → is_io
        ground_truth = {a.account_id: a.is_io for a in accounts}

        self.stdout.write(f'\nGround truth: {len(accounts)} accounts '
                          f'({sum(1 for v in ground_truth.values() if v)} IO, '
                          f'{sum(1 for v in ground_truth.values() if not v)} control)')

        # Group posts by account for time windowing
        from collections import defaultdict
        account_posts: dict[str, list[LabeledPost]] = defaultdict(list)
        for p in posts:
            account_posts[p.account_id].append(p)

        # Determine time window: use earliest to latest post in dataset
        from datetime import datetime
        timestamps = []
        for p in posts:
            try:
                ts = datetime.fromisoformat(p.posted_at.replace('Z', '+00:00'))
                timestamps.append(ts)
            except (ValueError, AttributeError):
                continue

        if not timestamps:
            self.stdout.write(self.style.ERROR('No parseable timestamps — aborting'))
            return

        now = max(timestamps)
        window_start = now - timedelta(days=settings.SIGNET_PROJECTION_WINDOW_DAYS)

        # ── Seed synthetic SIGNET data ──
        # Create a temporary session and a run-scoped platform namespace. The
        # source models enforce uniqueness on (platform, platform_post_id), so
        # repeated evals must never reuse the live dataset platform directly.
        session = CollectionSession.objects.create(
            user=user, platform='stanford_io', config={'dataset': 'stanford_io'},
        )
        eval_platform = f'sio_eval_{session.id}'
        session.platform = eval_platform
        session.save(update_fields=['platform'])

        try:
            # Create SignetAccount rows
            account_handle_map: dict[str, str] = {}
            for account_id in account_posts:
                handle = f'eval_{session.id}_{account_id}'[:100]
                account_handle_map[account_id] = handle
                SignetAccount.objects.update_or_create(
                    handle=handle,
                    defaults={'user': user, 'platform': eval_platform, 'posts': len(account_posts[account_id])},
                )

            # Create CollectedPost rows for posts within the window
            created_posts: dict[str, list[CollectedPost]] = {}
            for index, p in enumerate(posts):
                try:
                    ts = datetime.fromisoformat(p.posted_at.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    continue
                if ts < window_start or ts > now:
                    continue

                handle = account_handle_map[p.account_id]
                source_post_id = p.post_id or f'{p.account_id}-{index}'
                cp = CollectedPost.objects.create(
                    user=user, session=session,
                    platform=eval_platform,
                    platform_post_id=f'{session.id}-{index}-{source_post_id}'[:100],
                    platform_author_id=p.account_id[:100],
                    author_handle=handle,
                    content_text=p.text or '',
                    posted_at=timezone.make_aware(ts) if timezone.is_naive(ts) else ts,
                    collected_at=timezone.now(),
                    hashtags=p.hashtags,
                    urls=p.urls,
                )
                created_posts.setdefault(p.account_id, []).append(cp)

            self.stdout.write(
                f'Seeded {sum(len(v) for v in created_posts.values())} CollectedPost rows (window)'
            )

            # Create PostClassification rows for IO-labelled accounts (simulating tagger output)
            for account_id, is_io in ground_truth.items():
                if not is_io:
                    continue
                for cp in created_posts.get(account_id, []):
                    PostClassification.objects.create(
                        user=user, session=session, post=cp,
                        tags=[{'tag': 'coordinated_inauthentic', 'confidence': 0.80}],
                        overall_confidence=0.80,
                        prompt_version='eval/stanford_io_sim',
                        model_version='cross_validation',
                        review_status='auto_eligible',
                    )

            # ── Run coordination ──
            result = compute_coordination(user, window_start, timezone.now())
            self.stdout.write(f'\nCoordination result: {json.dumps({k: v for k, v in result.items() if k != "account_cluster_scores" and k != "cluster_labels"}, default=str)}')

            # ── Score ──
            clusters = SignetCoordinationCluster.objects.filter(user=user)
            cluster_account_sets: list[set[str]] = []
            for c in clusters:
                # account_ids is a list of SignetAccount.id — resolve back to handles
                account_handles = set(
                    SignetAccount.objects.filter(id__in=c.account_ids).values_list('handle', flat=True)
                )
                cluster_account_sets.append(account_handles)

            # Map handles back to dataset account_ids
            handle_to_dataset_id = {v: k for k, v in account_handle_map.items()}

            # For scoring: accounts found by coordination vs IO labels
            all_clustered_ids: set[str] = set()
            for cluster_handles in cluster_account_sets:
                for h in cluster_handles:
                    did = handle_to_dataset_id.get(h)
                    if did:
                        all_clustered_ids.add(did)

            io_ids = {aid for aid, is_io in ground_truth.items() if is_io}
            control_ids = {aid for aid, is_io in ground_truth.items() if not is_io}

            tp = len(all_clustered_ids & io_ids)
            fp = len(all_clustered_ids & control_ids)
            fn = len(io_ids - all_clustered_ids)

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

            self.stdout.write('\n═══ Coordination Eval — Stanford IO ═══')
            self.stdout.write(f'IO accounts (ground truth):  {len(io_ids)}')
            self.stdout.write(f'Control accounts:            {len(control_ids)}')
            self.stdout.write(f'Clustered accounts (found):  {len(all_clustered_ids)}')
            self.stdout.write(f'True positives:   {tp}')
            self.stdout.write(f'False positives:  {fp}')
            self.stdout.write(f'False negatives:  {fn}')
            self.stdout.write(f'Precision: {precision:.4f}')
            self.stdout.write(f'Recall:    {recall:.4f}')
            self.stdout.write(f'F1:        {f1:.4f}')
        finally:
            # ── Cleanup ──
            PostClassification.objects.filter(session=session).delete()
            CollectedPost.objects.filter(session=session).delete()
            SignetEdge.objects.filter(user=user, source_type='account', target_type='account').delete()
            SignetCoordinationCluster.objects.filter(user=user).delete()
            SignetAccount.objects.filter(user=user, platform=eval_platform).delete()
            session.delete()
            self.stdout.write('\nCleanup complete.')

    # ── PesaCheck: political_disinfo tagger eval ────────────────────────────

    def _eval_pesacheck(self, loader, user, verbose):
        """Score tagger's political_disinfo tag against PesaCheck ratings."""
        import asyncio
        from signet.tagging import tag_post

        claims: list[LabeledClaim] = loader.load_claims()
        if not claims:
            self.stdout.write(self.style.ERROR('No claims loaded — aborting'))
            return

        # Filter to scorable claims (non-ambiguous PesaCheck ratings)
        scorable = [
            c for c in claims
            if pesacheck_is_political_disinfo(c.rating) is not None
        ]

        self.stdout.write(f'\nScorable claims: {len(scorable)} / {len(claims)}')

        class _DummyPost:
            def __init__(self, text):
                self.content_text = text

        tp, fp, fn, tn = 0, 0, 0, 0
        detail: list[dict] = []

        for c in scorable:
            truth = pesacheck_is_political_disinfo(c.rating)  # True/False
            post = _DummyPost(c.text)

            try:
                result = asyncio.run(tag_post(post, user_id=user.id))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Tagging failed for {c.claim_id}: {e}'))
                continue

            tags = {t['tag'] for t in result.get('tags', [])}
            pred = 'political_disinfo' in tags

            if truth and pred:
                tp += 1
            elif truth and not pred:
                fn += 1
            elif not truth and pred:
                fp += 1
            else:
                tn += 1

            if verbose:
                detail.append({
                    'id': c.claim_id, 'rating': c.rating, 'truth': truth, 'pred': pred,
                    'tags': sorted(tags), 'text': c.text[:120],
                })

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0.0

        self.stdout.write('\n═══ Tagger Eval — PesaCheck political_disinfo ═══')
        self.stdout.write(f'Scorable claims:  {len(scorable)}')
        self.stdout.write(f'TP={tp}  FP={fp}  FN={fn}  TN={tn}')
        self.stdout.write(f'Precision: {precision:.4f}')
        self.stdout.write(f'Recall:    {recall:.4f}')
        self.stdout.write(f'F1:        {f1:.4f}')
        self.stdout.write(f'Accuracy:  {accuracy:.4f}')

        if verbose and detail:
            self.stdout.write('\nPer-claim detail:')
            for d in detail:
                mark = '✓' if d['truth'] == d['pred'] else '✗'
                self.stdout.write(
                    f'  [{mark}] {d["id"]} | rating={d["rating"]} '
                    f'truth={d["truth"]} pred={d["pred"]} '
                    f'tags={d["tags"]} | "{d["text"]}"'
                )

    # ── EIP: qualitative cross-reference ────────────────────────────────────

    def _eval_eip(self, loader, user, verbose):
        """Cross-reference SIGNET coordination output against EIP campaign data.

        This is qualitative: prints EIP campaign names and checks whether any
        SIGNET-coordinated account handles match EIP-documented accounts.
        """
        accounts: list[LabeledAccount] = loader.load_accounts()
        if not accounts:
            self.stdout.write(self.style.ERROR('No accounts loaded — aborting'))
            return

        campaigns: dict[str, set[str]] = {}
        for a in accounts:
            campaigns.setdefault(a.campaign, set()).add(a.account_id)

        self.stdout.write('\n═══ EIP Cross-Reference ═══')
        self.stdout.write(f'Campaigns: {len(campaigns)}')
        for name, aids in sorted(campaigns.items()):
            self.stdout.write(f'  {name}: {len(aids)} accounts')

        # Check if any SIGNET coordination clusters exist
        clusters = SignetCoordinationCluster.objects.filter(user=user)
        if not clusters.exists():
            self.stdout.write('\nNo SIGNET coordination clusters found.')
            self.stdout.write(
                'Run coordination on live SIGNET data, then re-run this eval '
                'to cross-reference.'
            )
            return

        self.stdout.write(f'\nSIGNET clusters: {clusters.count()}')
        for c in clusters:
            handles = set(
                SignetAccount.objects.filter(id__in=c.account_ids)
                .values_list('handle', flat=True)
            )
            self.stdout.write(f'  {c.label}: {c.size} accounts, score={c.score:.2f}')
            # Cross-reference against EIP campaigns
            for name, aids in campaigns.items():
                overlap = handles & aids
                if overlap:
                    self.stdout.write(f'    → OVERLAP with EIP {name}: {sorted(overlap)[:5]}')

        self.stdout.write(
            '\nNote: EIP data is Twitter-centric; SIGNET is Reddit-only. '
            'Direct overlap is unlikely. This is a qualitative sanity check.'
        )
