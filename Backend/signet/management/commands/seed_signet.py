from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from signet.models import (
    SignetAccount, SignetNarrative, SignetHashtag,
    SignetEdge, SignetActivity, SignetReviewItem,
)

User = get_user_model()

ACCOUNTS = [
    {'id': 'acc_001', 'handle': '@KE_Wakili', 'tier': 'macro', 'tags': ['red_pill_pipeline', 'anti_institution'], 'followers': 89400, 'posts': 342, 'confidence': 0.91},
    {'id': 'acc_002', 'handle': '@NairobiTruth_KE', 'tier': 'macro', 'tags': ['firehose_falsehood', 'political_disinfo'], 'followers': 124000, 'posts': 891, 'confidence': 0.87},
    {'id': 'acc_003', 'handle': '@Rift_Patriot', 'tier': 'mid', 'tags': ['identity_wedge', 'coordinated_inauthentic'], 'followers': 34200, 'posts': 214, 'confidence': 0.78},
    {'id': 'acc_004', 'handle': '@254_Analyst', 'tier': 'mid', 'tags': ['political_disinfo'], 'followers': 22100, 'posts': 156, 'confidence': 0.65},
    {'id': 'acc_005', 'handle': '@KenyaWatchdog', 'tier': 'mid', 'tags': ['appeal_to_victimhood'], 'followers': 18700, 'posts': 203, 'confidence': 0.72},
    {'id': 'acc_006', 'handle': '@MtaaAnalyst', 'tier': 'mid', 'tags': ['red_pill_pipeline'], 'followers': 15300, 'posts': 178, 'confidence': 0.81},
    {'id': 'acc_007', 'handle': '@SavannahPulse', 'tier': 'mid', 'tags': ['coordinated_inauthentic'], 'followers': 28900, 'posts': 445, 'confidence': 0.69},
    {'id': 'acc_008', 'handle': '@citizen_k254', 'tier': 'micro', 'tags': [], 'followers': 892, 'posts': 34, 'confidence': 0.30},
    {'id': 'acc_009', 'handle': '@nairobi_mwananchi', 'tier': 'micro', 'tags': ['appeal_to_victimhood'], 'followers': 2100, 'posts': 67, 'confidence': 0.44},
    {'id': 'acc_010', 'handle': '@eastafrica_now', 'tier': 'micro', 'tags': [], 'followers': 1340, 'posts': 23, 'confidence': 0.28},
    {'id': 'acc_011', 'handle': '@ke_observer_9', 'tier': 'micro', 'tags': ['coordinated_inauthentic'], 'followers': 445, 'posts': 89, 'confidence': 0.83},
    {'id': 'acc_012', 'handle': '@kenyapolitics24', 'tier': 'micro', 'tags': ['coordinated_inauthentic'], 'followers': 677, 'posts': 112, 'confidence': 0.79},
]

NARRATIVES = [
    {'id': 'nar_001', 'label': 'Election System Compromised', 'tags': ['election_integrity', 'coordinated_amplified'], 'reach': 234000, 'confidence': 0.88, 'status': 'active'},
    {'id': 'nar_002', 'label': 'IMF Debt Trap Narrative', 'tags': ['economic_fear', 'firehose_falsehood'], 'reach': 189000, 'confidence': 0.82, 'status': 'active'},
    {'id': 'nar_003', 'label': 'Foreign NGO Interference', 'tags': ['anti_institution', 'political_disinfo'], 'reach': 145000, 'confidence': 0.74, 'status': 'decaying'},
    {'id': 'nar_004', 'label': 'Ethnic Land Grievance Reframe', 'tags': ['identity_wedge', 'appeal_to_victimhood'], 'reach': 98000, 'confidence': 0.91, 'status': 'active'},
    {'id': 'nar_005', 'label': 'Vaccine Microchip Revival', 'tags': ['health_misinfo'], 'reach': 67000, 'confidence': 0.95, 'status': 'decaying'},
]

HASHTAGS = [
    {'id': 'tag_001', 'label': '#KenyaDecides', 'volume': 45200, 'velocity': 'high'},
    {'id': 'tag_002', 'label': '#IMFGoHome', 'volume': 38900, 'velocity': 'high'},
    {'id': 'tag_003', 'label': '#RutoMustGo', 'volume': 89400, 'velocity': 'peak'},
    {'id': 'tag_004', 'label': '#WakiliSpeaks', 'volume': 12300, 'velocity': 'medium'},
    {'id': 'tag_005', 'label': '#254Truth', 'volume': 8900, 'velocity': 'low'},
]

EDGES = [
    ('acc_001', 'account', 'nar_001', 'narrative', 'SEEDS'),
    ('acc_002', 'account', 'nar_002', 'narrative', 'SEEDS'),
    ('acc_001', 'account', 'nar_004', 'narrative', 'SEEDS'),
    ('acc_003', 'account', 'nar_004', 'narrative', 'SEEDS'),
    ('acc_002', 'account', 'nar_003', 'narrative', 'SEEDS'),
    ('acc_004', 'account', 'nar_001', 'narrative', 'AMPLIFIES'),
    ('acc_005', 'account', 'nar_001', 'narrative', 'AMPLIFIES'),
    ('acc_006', 'account', 'nar_002', 'narrative', 'AMPLIFIES'),
    ('acc_007', 'account', 'nar_002', 'narrative', 'AMPLIFIES'),
    ('acc_007', 'account', 'nar_003', 'narrative', 'AMPLIFIES'),
    ('acc_011', 'account', 'nar_001', 'narrative', 'AMPLIFIES'),
    ('acc_012', 'account', 'nar_001', 'narrative', 'AMPLIFIES'),
    ('acc_009', 'account', 'nar_004', 'narrative', 'AMPLIFIES'),
    ('acc_008', 'account', 'nar_002', 'narrative', 'AMPLIFIES'),
    ('acc_005', 'account', 'nar_005', 'narrative', 'AMPLIFIES'),
    ('acc_001', 'account', 'tag_001', 'hashtag', 'TAGGED_WITH'),
    ('acc_001', 'account', 'tag_004', 'hashtag', 'TAGGED_WITH'),
    ('acc_002', 'account', 'tag_002', 'hashtag', 'TAGGED_WITH'),
    ('acc_002', 'account', 'tag_003', 'hashtag', 'TAGGED_WITH'),
    ('acc_003', 'account', 'tag_003', 'hashtag', 'TAGGED_WITH'),
    ('acc_004', 'account', 'tag_001', 'hashtag', 'TAGGED_WITH'),
    ('acc_005', 'account', 'tag_003', 'hashtag', 'TAGGED_WITH'),
    ('acc_006', 'account', 'tag_002', 'hashtag', 'TAGGED_WITH'),
    ('acc_007', 'account', 'tag_005', 'hashtag', 'TAGGED_WITH'),
    ('acc_011', 'account', 'tag_001', 'hashtag', 'TAGGED_WITH'),
    ('acc_012', 'account', 'tag_001', 'hashtag', 'TAGGED_WITH'),
    ('nar_001', 'narrative', 'tag_001', 'hashtag', 'SPREADS_VIA'),
    ('nar_002', 'narrative', 'tag_002', 'hashtag', 'SPREADS_VIA'),
    ('nar_004', 'narrative', 'tag_003', 'hashtag', 'SPREADS_VIA'),
    ('acc_011', 'account', 'acc_012', 'account', 'PART_OF_NETWORK'),
    ('acc_004', 'account', 'acc_005', 'account', 'PART_OF_NETWORK'),
]

ACTIVITIES = [
    ('09:41', True, 'Coordination detected: @ke_observer_9 ↔ @kenyapolitics24 — 94% posting overlap over 72hrs'),
    ('09:38', False, '[Election System Compromised] velocity +34% in 6hrs — 3 new amplifiers detected'),
    ('09:22', False, "@NairobiTruth_KE seeded new claim: 'foreign observers pre-scripted outcome'"),
    ('09:11', False, '#RutoMustGo reached peak velocity — 89,400 posts, 67% from accounts <6 months old'),
    ('08:55', True, 'New cluster forming around [Ethnic Land Grievance Reframe] — 4 new micro accounts in 2hrs'),
    ('08:33', False, '[Vaccine Microchip Revival] decaying — reach down 42% over 48hrs'),
    ('08:14', False, '@KE_Wakili posted 14 times in 3hrs — cadence anomaly flagged'),
]

REVIEWS = [
    {'gate': 'GATE 2', 'verdict_tag': 'coordinated_inauthentic', 'target': '@ke_observer_9', 'confidence': 0.62, 'tier': 'medium',
     'excerpt': 'Election was decided 6 months ago in Washington — wake up people \U0001f1f0\U0001f1ea',
     'reason': 'Sensitive verdict (coordination) + medium confidence', 'model_name': 'claude-sonnet/post_tagger_1.2'},
    {'gate': 'GATE 2', 'verdict_tag': 'identity_wedge', 'target': '@Rift_Patriot', 'confidence': 0.81, 'tier': 'high',
     'excerpt': 'Our people have been silenced for too long. The land is OURS. They know who took it.',
     'reason': 'Sensitive: identity_wedge attribution requires sign-off', 'model_name': 'claude-sonnet/post_tagger_1.2'},
    {'gate': 'GATE 1', 'verdict_tag': 'firehose_falsehood', 'target': '@NairobiTruth_KE', 'confidence': 0.74, 'tier': 'medium',
     'excerpt': 'IMF doc leaked: KE forced to sell port. RT before they delete!!! [link]',
     'reason': 'Medium confidence on firehose pattern', 'model_name': 'claude-sonnet/post_tagger_1.2'},
    {'gate': 'GATE 1', 'verdict_tag': 'health_misinfo', 'target': '@KenyaWatchdog', 'confidence': 0.45, 'tier': 'low',
     'excerpt': 'Why did 3 friends get sick after the booster? Just asking questions, brothers.',
     'reason': 'Low confidence — needs analyst ground truth', 'model_name': 'claude-sonnet/post_tagger_1.2'},
    {'gate': 'GATE 2', 'verdict_tag': 'coordinated_inauthentic', 'target': '@kenyapolitics24', 'confidence': 0.79, 'tier': 'high',
     'excerpt': 'BREAKING: ELECTION IS RIGGED. EVERY KENYAN MUST KNOW THIS NOW.',
     'reason': 'Coordination attribution → network cluster #C7', 'model_name': 'claude-sonnet/post_tagger_1.2'},
    {'gate': 'GATE 1', 'verdict_tag': 'appeal_to_victimhood', 'target': '@nairobi_mwananchi', 'confidence': 0.58, 'tier': 'medium',
     'excerpt': 'We are the victims here. They will pay for what they did to us.',
     'reason': 'Medium confidence on victimhood appeal', 'model_name': 'claude-sonnet/post_tagger_1.2'},
]


class Command(BaseCommand):
    help = 'Seed the Signet database with mock intelligence data'

    def handle(self, *args, **kwargs):
        user = User.objects.first()
        if not user:
            self.stderr.write('No users found. Create a user first.')
            return

        # Clear existing
        SignetAccount.objects.filter(user=user).delete()
        SignetNarrative.objects.filter(user=user).delete()
        SignetHashtag.objects.filter(user=user).delete()
        SignetEdge.objects.filter(user=user).delete()
        SignetActivity.objects.filter(user=user).delete()
        SignetReviewItem.objects.filter(user=user).delete()

        # Create accounts
        id_map = {}
        for a in ACCOUNTS:
            acc = SignetAccount.objects.create(
                user=user, handle=a['handle'], tier=a['tier'],
                followers=a['followers'], posts=a['posts'],
                confidence=a['confidence'], tags=a['tags'],
            )
            id_map[a['id']] = acc

        for n in NARRATIVES:
            nar = SignetNarrative.objects.create(
                user=user, label=n['label'], tags=n['tags'],
                reach=n['reach'], confidence=n['confidence'], status=n['status'],
            )
            id_map[n['id']] = nar

        for h in HASHTAGS:
            tag = SignetHashtag.objects.create(
                user=user, label=h['label'], volume=h['volume'], velocity=h['velocity'],
            )
            id_map[h['id']] = tag

        for src_id, src_type, tgt_id, tgt_type, edge_type in EDGES:
            src = id_map.get(src_id)
            tgt = id_map.get(tgt_id)
            if src and tgt:
                SignetEdge.objects.create(
                    user=user, source_type=src_type, source_id=src.id,
                    target_type=tgt_type, target_id=tgt.id, edge_type=edge_type,
                )

        for time_str, is_alert, text in ACTIVITIES:
            SignetActivity.objects.create(user=user, text=text, is_alert=is_alert)

        for r in REVIEWS:
            SignetReviewItem.objects.create(user=user, **r)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded: {len(ACCOUNTS)} accounts, {len(NARRATIVES)} narratives, '
            f'{len(HASHTAGS)} hashtags, {len(EDGES)} edges, '
            f'{len(ACTIVITIES)} activities, {len(REVIEWS)} reviews'
        ))
