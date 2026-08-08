import json
import os
import asyncio
from django.core.management.base import BaseCommand
from django.conf import settings

from signet.tagging import tag_post, PROMPT_VERSION as CURRENT_VERSION


class DummyPost:
    def __init__(self, text):
        self.content_text = text


_TIER_N = {'low': 0, 'medium': 1, 'high': 2}

# Defaults for the quality gate. Exact-set + exact-tier match is far too brittle
# for a 21-tag LLM tagger (one extra tag or an off-by-one tier = FAIL), so the
# gate is built from metrics that actually track usefulness:
#   - recall:        did it find the tags it should have?
#   - max_extra_tags: how much does it over-tag (spurious tags = analyst noise)?
#   - tier_within_1:  is the confidence magnitude in the right ballpark (+/-1)?
# Override per-golden-set via a top-level "thresholds" object.
DEFAULT_THRESHOLDS = {
    'recall': 0.80,
    'max_extra_tags': 0.50,
    'tier_within_1': 0.90,
}


class Command(BaseCommand):
    help = 'Run tagging eval against the golden set and report recall / over-tagging / tier metrics'

    def add_arguments(self, parser):
        parser.add_argument('--golden', type=str, default='signet/eval/golden_set.json')
        parser.add_argument('--user', type=int, default=1, help='User ID for LLM cost attribution')
        parser.add_argument('--verbose', action='store_true', help='Print every post, not just misses')

    def handle(self, *args, **options):
        golden_path = os.path.join(settings.BASE_DIR, options['golden'])
        if not os.path.exists(golden_path):
            self.stderr.write(f'Golden set not found: {golden_path}')
            return

        with open(golden_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        posts = data.get('posts', [])
        thresholds = {**DEFAULT_THRESHOLDS, **data.get('thresholds', {})}

        self.stdout.write(f'Golden set: {len(posts)} posts | tagger: {CURRENT_VERSION}')
        self.stdout.write(
            f'Gate: recall>={thresholds["recall"]:.0%}, '
            f'extra<={thresholds["max_extra_tags"]:.2f}/post, '
            f'tier_within_1>={thresholds["tier_within_1"]:.0%}\n'
        )

        exact = 0
        recalls, extras = [], []
        tier_exact = 0
        tier_within_1 = 0
        found_all = 0
        over_tag_counter: dict[str, int] = {}
        total = 0

        for pd in posts:
            post = DummyPost(pd['text'])
            expected = set(pd.get('expected_tags', []))
            exp_tier = pd.get('expected_tier', 'low')

            result = asyncio.run(tag_post(post, user_id=options['user']))
            actual = {t['tag'] for t in result.get('tags', [])}
            act_tier = result.get('confidence_tier', 'low')

            total += 1
            recall = 1.0 if not expected else len(expected & actual) / len(expected)
            extra = actual - expected
            recalls.append(recall)
            extras.append(len(extra))
            if expected <= actual:
                found_all += 1
            if act_tier == exp_tier:
                tier_exact += 1
            if abs(_TIER_N.get(exp_tier, 0) - _TIER_N.get(act_tier, 0)) <= 1:
                tier_within_1 += 1
            is_exact = actual == expected and act_tier == exp_tier
            if is_exact:
                exact += 1
            for t in extra:
                over_tag_counter[t] = over_tag_counter.get(t, 0) + 1

            if options['verbose'] or not (expected <= actual):
                self.stdout.write(
                    f'[{pd["id"]}] recall={recall:.0%} extra={sorted(extra)} '
                    f'tier={exp_tier}->{act_tier} '
                    f'exp={sorted(expected)} act={sorted(actual)}'
                )

        mean_recall = sum(recalls) / total if total else 0
        mean_extra = sum(extras) / total if total else 0
        twithin = tier_within_1 / total if total else 0

        passed = (
            mean_recall >= thresholds['recall']
            and mean_extra <= thresholds['max_extra_tags']
            and twithin >= thresholds['tier_within_1']
        )

        top_over = sorted(over_tag_counter.items(), key=lambda x: -x[1])[:5]

        self.stdout.write(f'\n{"=" * 56}')
        self.stdout.write(f'mean tag recall (found the right tags):  {mean_recall:.1%}  (gate >= {thresholds["recall"]:.0%})')
        self.stdout.write(f'over-tagging (extra tags/post):          {mean_extra:.2f}   (gate <= {thresholds["max_extra_tags"]:.2f})')
        self.stdout.write(f'tier within-1:                           {twithin:.1%}  (gate >= {thresholds["tier_within_1"]:.0%})')
        self.stdout.write(f'  -- found ALL expected tags:            {found_all}/{total} = {found_all/total:.1%}')
        self.stdout.write(f'  -- tier exact:                         {tier_exact}/{total} = {tier_exact/total:.1%}')
        self.stdout.write(f'  -- exact set+tier match (reference):   {exact}/{total} = {exact/total:.1%}')
        if top_over:
            self.stdout.write(f'  -- top spurious tags:                  {top_over}')
        self.stdout.write(f'\nRESULT: {"PASS" if passed else "FAIL"}  (tagger {CURRENT_VERSION})')

        if not passed:
            reasons = []
            if mean_recall < thresholds['recall']:
                reasons.append(f'recall {mean_recall:.0%} < {thresholds["recall"]:.0%}')
            if mean_extra > thresholds['max_extra_tags']:
                reasons.append(f'over-tagging {mean_extra:.2f} > {thresholds["max_extra_tags"]:.2f}')
            if twithin < thresholds['tier_within_1']:
                reasons.append(f'tier_within_1 {twithin:.0%} < {thresholds["tier_within_1"]:.0%}')
            self.stderr.write(f'\nEval FAILED: {"; ".join(reasons)}. Do not ship without review.')
