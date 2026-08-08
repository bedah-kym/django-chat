"""Re-tag the corpus with the current tagging prompt version.

After a tagger version bump, the database accumulates a mix of prompt versions
across the same posts (one row per (post, run) — PostClassification is immutable
+ append-only). The projector picks the latest classification per post, so a
mixed corpus means the live console shows a blend of old and new verdicts.

This command re-tags posts whose latest classification is older than the target,
APPENDING a new classification (the old rows stay for history). It SKIPS:
  - posts already at the target prompt version
  - posts whose latest classification was human-decided (approved/amended/rejected)
    so operator verdicts are preserved

It does NOT create new SignetReviewItem rows — this is a bulk cleanup, not new
operator work. It also does NOT trigger projection per post; run the projector
once at the end (printed at completion).
"""
import asyncio
import time

from django.core.management.base import BaseCommand

from signet.models import CollectedPost, PostClassification
from signet.tagging import tag_post, PROMPT_VERSION as CURRENT_VERSION


HUMAN_DECIDED = {'approved', 'amended', 'rejected'}


class Command(BaseCommand):
    help = 'Re-tag corpus posts to the current tagging prompt version (append-only).'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, required=True,
                            help='User ID for LLM cost tracking on the re-tag calls')
        parser.add_argument('--owner-user', type=int, default=None,
                            help='Only re-tag posts owned by this user (default: all users)')
        parser.add_argument('--limit', type=int, default=0,
                            help='Max posts to re-tag (0 = no limit)')
        parser.add_argument('--target-version', type=str, default=CURRENT_VERSION,
                            help=f'Target prompt version (default: {CURRENT_VERSION})')
        parser.add_argument('--dry-run', action='store_true',
                            help='Count + classify candidates, do not call the LLM')

    def handle(self, *args, **opts):
        target = opts['target_version']
        user_id = opts['user_id']
        limit = opts['limit']
        dry = opts['dry_run']
        owner = opts['owner_user']

        self.stdout.write(f'Target prompt_version: {target}')
        self.stdout.write(f'LLM cost attribution user_id: {user_id}')

        posts_qs = CollectedPost.objects.all()
        if owner:
            posts_qs = posts_qs.filter(user_id=owner)

        candidates = []
        n_at_target = 0
        n_human = 0
        n_no_classification = 0
        for post in posts_qs.iterator(chunk_size=500):
            latest = (
                PostClassification.objects
                .filter(post=post)
                .order_by('-created_at')
                .first()
            )
            if latest is None:
                n_no_classification += 1
                candidates.append(post)
                continue
            if latest.prompt_version == target:
                n_at_target += 1
                continue
            if latest.review_status in HUMAN_DECIDED:
                n_human += 1
                continue
            candidates.append(post)

        total = len(candidates)
        self.stdout.write(
            f'\nInventory:\n'
            f'  to re-tag:                   {total}\n'
            f'  already at {target}: {n_at_target}\n'
            f'  human-decided (preserved):   {n_human}\n'
            f'  never tagged:                {n_no_classification}\n'
        )

        if dry:
            self.stdout.write('Dry-run — exiting before LLM calls.')
            return

        if limit and limit < total:
            candidates = candidates[:limit]
            self.stdout.write(f'Capped at first {limit} per --limit.\n')

        done = 0
        failed = 0
        t0 = time.monotonic()
        for post in candidates:
            try:
                result = asyncio.run(tag_post(post, user_id=user_id))
            except Exception as e:
                self.stderr.write(f'  LLM failed post {post.id}: {e}')
                failed += 1
                continue
            try:
                PostClassification.objects.create(
                    post=post,
                    tags=result['tags'],
                    overall_confidence=result['overall_confidence'],
                    prompt_version=result['prompt_version'],
                    model_version=result.get('model_version', ''),
                    llm_call_id=result['llm_call_id'],
                    raw_llm_response=result['raw_llm_response'],
                    review_status=result['review_status'],
                    user_id=post.user_id,
                    session=post.session,
                    themes=result.get('themes', []),
                    entities=result.get('entities', []),
                    summary=result.get('summary', ''),
                    novelty_flag=result.get('novelty_flag', False),
                    novelty_note=result.get('novelty_note', ''),
                    safety_category=result.get('safety_category', 'none'),
                    safety_excluded=result.get('safety_excluded', False),
                )
            except Exception as e:
                self.stderr.write(f'  DB create failed post {post.id}: {e}')
                failed += 1
                continue

            done += 1
            if done % 25 == 0:
                rate = done / max(time.monotonic() - t0, 1)
                remaining = len(candidates) - done
                eta_min = (remaining / max(rate, 0.001)) / 60
                self.stdout.write(
                    f'  {done}/{len(candidates)}  ({rate:.1f}/s, ETA {eta_min:.1f}m, failed {failed})'
                )

        dt = time.monotonic() - t0
        self.stdout.write(
            f'\nDone. tagged={done} failed={failed} elapsed={dt/60:.1f}m '
            f'rate={done/max(dt,1):.1f}/s'
        )
        self.stdout.write(
            'Run the projector to refresh the live console with the new verdicts:\n'
            '  python manage.py shell -c "'
            'from signet.models import CollectionSession; '
            'from signet.projector import project_session; '
            's=CollectionSession.objects.order_by(\\"-created_at\\").first(); '
            'print(project_session(s))"'
        )
