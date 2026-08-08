import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

if 'praw' not in sys.modules:
    praw_stub = ModuleType('praw')
    praw_stub.Reddit = object
    sys.modules['praw'] = praw_stub

from .collectors.telegram_collector import TelegramCollector
from .coordination import compute_coordination
from .models import (
    CollectionSession,
    CollectedPost,
    PostClassification,
    SignetActivity,
    SignetAccount,
    SignetCoordinationCluster,
    SignetEdge,
)
from .payload import normalize_telegram_message
from .projector import project_session
from .views import collection_start
from .eval.dataset_loaders import EIPLoader, PesaCheckLoader, StanfordIOLoader


User = get_user_model()


def _telegram_message(
    *,
    message_id=42,
    text='Live update #Kenya from @source https://example.com/item',
    chat=None,
    sender=None,
    views=1200,
    forwards=5,
    comments=7,
    reply_to_message_id=41,
):
    chat = chat or SimpleNamespace(id=-100123, title='Kenya News', username='kenyanews')
    sender = sender or chat
    return SimpleNamespace(
        id=message_id,
        message_id=message_id,
        text=text,
        caption=None,
        chat=chat,
        from_user=None,
        sender_chat=sender,
        date=datetime(2026, 6, 26, 9, 30, 0),
        forwards=forwards,
        views=views,
        replies=SimpleNamespace(replies=comments),
        reply_to_message_id=reply_to_message_id,
        forward_from_chat=SimpleNamespace(id=-100555, title='Forward Source', username='forwardsrc'),
        forward_from=None,
    )


class _FakeTelegramClient:
    def __init__(self, messages):
        self.messages = messages
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def get_chat_history(self, channel, limit=50):
        self.calls.append((channel, limit))

        async def _items():
            for message in self.messages[:limit]:
                yield message

        return _items()


class TelegramPayloadTests(TestCase):
    def test_normalize_telegram_message_maps_identity_engagement_and_flags(self):
        payload = normalize_telegram_message(_telegram_message())

        self.assertEqual(payload.platform, 'telegram')
        self.assertEqual(payload.platform_post_id, '-100123:42')
        self.assertEqual(payload.platform_author_id, '-100123')
        self.assertEqual(payload.author_handle, 'tg:@kenyanews')
        self.assertEqual(payload.content_text, 'Live update #Kenya from @source https://example.com/item')
        self.assertEqual(payload.posted_at, '2026-06-26T09:30:00+00:00')
        self.assertEqual(payload.shares, 5)
        self.assertEqual(payload.comments, 7)
        self.assertEqual(payload.views, 1200)
        self.assertEqual(payload.reach, 1200)
        self.assertEqual(payload.hashtags, ['Kenya'])
        self.assertEqual(payload.mentions, ['source'])
        self.assertEqual(payload.urls, ['https://example.com/item'])
        self.assertEqual(payload.media_type, 'text')
        self.assertTrue(payload.is_reply)
        self.assertTrue(payload.is_repost)
        self.assertEqual(payload.parent_post_id, '41')


@override_settings(
    TELEGRAM_DEFAULT_CHANNELS=['@kenyanews'],
    TELEGRAM_API_ID='1',
    TELEGRAM_API_HASH='hash',
    TELEGRAM_SESSION_STRING='session',
    TELEGRAM_BOT_TOKEN='',
)
class TelegramCollectorBoundaryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tg_collector_user', password='x')
        self.session = CollectionSession.objects.create(
            user=self.user,
            platform='telegram',
            config={'channels': ['@kenyanews'], 'limit': 10},
        )

    def test_collect_stores_messages_only_after_async_fetch_finishes(self):
        message = _telegram_message()
        client = _FakeTelegramClient([message])
        collector = TelegramCollector(self.session)
        stored_ids = []

        def store_message_from_sync_context(stored_message):
            with self.assertRaises(RuntimeError):
                asyncio.get_running_loop()
            stored_ids.append(stored_message.id)
            return True

        with (
            patch.object(collector, '_client', return_value=client),
            patch.object(collector, '_store_message', side_effect=store_message_from_sync_context) as store,
        ):
            collected = collector.collect()

        self.assertEqual(collected, 1)
        self.assertEqual(stored_ids, [42])
        self.assertEqual(client.calls, [('@kenyanews', 10)])
        store.assert_called_once_with(message)


@override_settings(
    SIGNET_PROJECTION_WINDOW_DAYS=3,
    SIGNET_COORD_T_MINUTES=15,
    SIGNET_COORD_JACCARD_THRESHOLD=0.6,
    SIGNET_COORD_MIN_CLUSTER_SIZE=3,
    SIGNET_COORD_MIN_CLUSTER_SCORE=0.5,
)
class ProjectorReachTierTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='reach_user', password='x')
        self.session = CollectionSession.objects.create(user=self.user, platform='telegram')
        self.now = timezone.now()

    def _post(
        self,
        handle: str,
        index: int,
        *,
        platform='telegram',
        views=None,
        likes=None,
        comments=None,
        shares=None,
    ) -> CollectedPost:
        return CollectedPost.objects.create(
            user=self.user,
            session=self.session,
            platform=platform,
            platform_post_id=f'{handle}-{index}',
            platform_author_id=f'{handle}-id',
            author_handle=handle,
            content_text=f'post {index} from {handle}',
            posted_at=self.now - timedelta(minutes=index),
            collected_at=self.now,
            likes=likes,
            shares=shares,
            comments=comments,
            views=views,
            reach=views,
            hashtags=[],
            urls=[],
        )

    def _classification(self, post: CollectedPost):
        return PostClassification.objects.create(
            user=self.user,
            session=self.session,
            post=post,
            tags=[],
            overall_confidence=0.0,
            prompt_version='test/post_tagger',
            model_version='test-model',
            raw_llm_response={},
            review_status='auto_eligible',
        )

    def test_projector_sets_reach_proxy_and_tiers_from_engagement(self):
        for i in range(5):
            self._classification(self._post('tg:@macro', i, views=4000))
        for i in range(2):
            self._classification(self._post('tg:@mid', i, views=500))
        for i in range(2):
            self._classification(
                self._post('reddit_micro', i, platform='reddit', likes=5, comments=2, shares=1)
            )

        result = project_session(self.session)

        self.assertEqual(result['accounts_upserted'], 3)
        accounts = {
            account.handle: account
            for account in SignetAccount.objects.filter(user=self.user)
        }
        self.assertEqual(accounts['tg:@macro'].platform, 'telegram')
        self.assertEqual(accounts['tg:@macro'].followers, 20000)
        self.assertEqual(accounts['tg:@macro'].posts, 5)
        self.assertEqual(accounts['tg:@macro'].tier, 'macro')
        self.assertEqual(accounts['tg:@mid'].followers, 1000)
        self.assertEqual(accounts['tg:@mid'].tier, 'mid')
        self.assertEqual(accounts['reddit_micro'].platform, 'reddit')
        self.assertEqual(accounts['reddit_micro'].followers, 16)
        self.assertEqual(accounts['reddit_micro'].tier, 'micro')


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    REST_FRAMEWORK={'DEFAULT_THROTTLE_CLASSES': []},
)
class CollectionStartRoutingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='route_user', password='x')
        self.factory = APIRequestFactory()

    def _request(self, data):
        request = self.factory.post('/signet/collection/start/', data, format='json')
        force_authenticate(request, user=self.user)
        return collection_start(request)

    def test_collection_start_defaults_to_reddit_and_preserves_default_subreddit(self):
        with (
            patch('signet.tasks.collect_reddit_task.delay') as reddit_delay,
            patch('signet.tasks.collect_telegram_task.delay') as telegram_delay,
        ):
            response = self._request({})

        self.assertEqual(response.status_code, 200)
        session = CollectionSession.objects.get(id=response.data['session_id'])
        self.assertEqual(session.platform, 'reddit')
        self.assertEqual(session.config, {'subreddits': ['Kenya'], 'limit': 25})
        reddit_delay.assert_called_once_with(session.id)
        telegram_delay.assert_not_called()

    @override_settings(TELEGRAM_DEFAULT_CHANNELS=[])
    def test_collection_start_rejects_telegram_without_channels(self):
        with (
            patch('signet.tasks.collect_reddit_task.delay') as reddit_delay,
            patch('signet.tasks.collect_telegram_task.delay') as telegram_delay,
        ):
            response = self._request({'platform': 'telegram'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Telegram channels required')
        self.assertFalse(CollectionSession.objects.filter(user=self.user).exists())
        reddit_delay.assert_not_called()
        telegram_delay.assert_not_called()

    @override_settings(TELEGRAM_DEFAULT_CHANNELS=[])
    def test_collection_start_routes_telegram_when_channels_are_supplied(self):
        with (
            patch('signet.tasks.collect_reddit_task.delay') as reddit_delay,
            patch('signet.tasks.collect_telegram_task.delay') as telegram_delay,
        ):
            response = self._request({'platform': 'telegram', 'channels': ['@kenyanews'], 'limit': 7})

        self.assertEqual(response.status_code, 200)
        session = CollectionSession.objects.get(id=response.data['session_id'])
        self.assertEqual(session.platform, 'telegram')
        self.assertEqual(session.config, {'channels': ['@kenyanews'], 'limit': 7})
        telegram_delay.assert_called_once_with(session.id)
        reddit_delay.assert_not_called()

    def test_collection_start_rejects_unknown_platform(self):
        response = self._request({'platform': 'whatsapp'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Unsupported platform')
        self.assertFalse(CollectionSession.objects.filter(user=self.user).exists())


@override_settings(
    SIGNET_PROJECTION_WINDOW_DAYS=3,
    SIGNET_COORD_T_MINUTES=15,
    SIGNET_COORD_JACCARD_THRESHOLD=0.6,
    SIGNET_COORD_MIN_CLUSTER_SIZE=3,
    SIGNET_COORD_MIN_CLUSTER_SCORE=0.5,
)
class CoordinationGraphLayerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alex', password='x')
        self.session = CollectionSession.objects.create(user=self.user, platform='reddit')
        self.now = timezone.now()
        self.window_start = self.now - timedelta(days=3)

    def _account(self, handle: str) -> SignetAccount:
        return SignetAccount.objects.create(user=self.user, handle=handle)

    def _post(
        self,
        handle: str,
        minute: int,
        text: str,
        hashtags=None,
        platform_post_id: str | None = None,
    ) -> CollectedPost:
        return CollectedPost.objects.create(
            user=self.user,
            session=self.session,
            platform='reddit',
            platform_post_id=platform_post_id or f'{handle}-{minute}',
            platform_author_id=f'{handle}-id',
            author_handle=handle,
            content_text=text,
            posted_at=self.now - timedelta(minutes=minute),
            collected_at=self.now,
            hashtags=hashtags or [],
            urls=[],
        )

    def _classification(self, post: CollectedPost, tag='coordinated_inauthentic'):
        return PostClassification.objects.create(
            user=self.user,
            session=self.session,
            post=post,
            tags=[{'tag': tag, 'confidence': 0.91}],
            overall_confidence=0.91,
            prompt_version='test/post_tagger',
            model_version='test-model',
            raw_llm_response={},
            review_status='auto_eligible',
        )

    def test_positive_control_clusters_near_identical_burst(self):
        signal_handles = ['acct_a', 'acct_b', 'acct_c', 'acct_d']
        noise_handles = ['noise_a', 'noise_b', 'noise_c', 'noise_d']
        for handle in signal_handles + noise_handles:
            self._account(handle)

        for index, handle in enumerate(signal_handles):
            self._post(
                handle,
                index * 3,
                'same campaign copy about a coordinated claim',
                hashtags=['trend'],
            )
        for index, handle in enumerate(noise_handles):
            self._post(
                handle,
                120 + index * 20,
                f'unrelated normal post {index}',
                hashtags=[f'noise{index}'],
            )

        result = compute_coordination(self.user, self.window_start, self.now)

        self.assertEqual(result['clusters_upserted'], 1)
        self.assertEqual(result['edges_upserted'], 6)
        cluster = SignetCoordinationCluster.objects.get(user=self.user)
        self.assertEqual(cluster.size, 4)
        self.assertIn('near-identical-text', cluster.axes)
        self.assertIn('shared-hashtag', cluster.axes)
        self.assertEqual(
            SignetEdge.objects.filter(user=self.user, edge_type='PART_OF_NETWORK').count(),
            6,
        )

    def test_adversarial_organic_hashtag_burst_does_not_cluster(self):
        # Organic trending pile-on: many accounts on ONE hashtag in a tight window
        # with DISTINCT text. This MUST fire the posting-time-burst axis (alongside
        # shared-hashtag), so the only thing preventing a false-positive cluster is
        # _axes_are_independent() rejecting the correlated {shared-hashtag,
        # posting-time-burst} pair. NOTE: a small 4-account version does NOT reach
        # burst_threshold = max(avg_bucket_size*2, 3), so the burst axis never fires
        # and the test passes even with the guard reverted (vacuous). The 8 spike
        # accounts + 30 noise singletons pull avg_bucket_size down so the burst axis
        # actually fires — making this a real fail-on-revert guard. Do not shrink it.
        spike = ['trend_a', 'trend_b', 'trend_c', 'trend_d',
                 'trend_e', 'trend_f', 'trend_g', 'trend_h']
        spike_texts = [
            'coast results are coming in now',
            'my constituency just announced its tally',
            'turnout looks high in the rift this year',
            'still waiting on the official IEBC numbers',
            'nairobi results trickling in slowly',
            'western region is almost fully counted',
            'this has been a very long election night',
            'hoping for a peaceful outcome whatever happens',
        ]
        for handle in spike:
            self._account(handle)
        for index, handle in enumerate(spike):
            self._post(handle, int(index * 1.5), spike_texts[index], hashtags=['trend'])

        # Background noise: distinct hashtags spread across the window so the burst
        # baseline (avg_bucket_size) is low enough for the spike bucket to exceed it.
        for i in range(30):
            self._account(f'noise_{i}')
            self._post(f'noise_{i}', 30 + i * 90, f'unrelated daily life post {i}',
                       hashtags=[f'noise{i}'])

        result = compute_coordination(self.user, self.window_start, self.now)

        # With the independence guard the spike's only axes are
        # {shared-hashtag, posting-time-burst} (correlated) -> no cluster.
        # Revert _axes_are_independent and this becomes 1 cluster / 15 edges.
        self.assertEqual(result['clusters_upserted'], 0)
        self.assertEqual(result['edges_upserted'], 0)
        self.assertFalse(SignetCoordinationCluster.objects.filter(user=self.user).exists())
        self.assertFalse(
            SignetEdge.objects.filter(user=self.user, edge_type='PART_OF_NETWORK').exists()
        )

    def test_projector_empty_path_returns_coordination_keys(self):
        result = project_session(self.session)

        self.assertEqual(result['clusters_upserted'], 0)
        self.assertEqual(result['coordination_edges_upserted'], 0)

    def test_projector_routes_uncorroborated_coordination_as_coord_tag_only(self):
        texts = [
            'bus queues are moving again downtown',
            'photos from the rally show a packed street',
            'my neighbour says prices changed overnight',
            'radio callers are debating the court ruling',
        ]
        for index, handle in enumerate(['trend_a', 'trend_b', 'trend_c', 'trend_d']):
            post = self._post(
                handle,
                index * 3,
                texts[index],
                hashtags=['trend'],
            )
            self._classification(post)

        result = project_session(self.session)

        self.assertEqual(result['clusters_upserted'], 0)
        self.assertEqual(result['coordination_edges_upserted'], 0)
        texts = list(SignetActivity.objects.filter(user=self.user).values_list('text', flat=True))
        self.assertTrue(texts)
        self.assertTrue(all(text.startswith('[COORD_TAG]') for text in texts))
        self.assertFalse(any(text.startswith('[ALERT]') for text in texts))


class CrossValidationHarnessTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='eval_user', password='x')
        self.session = CollectionSession.objects.create(user=self.user, platform='reddit')
        self.now = timezone.now()

    def _post(
        self,
        handle: str,
        minute: int,
        text: str,
        hashtags=None,
        platform_post_id: str | None = None,
    ) -> CollectedPost:
        return CollectedPost.objects.create(
            user=self.user,
            session=self.session,
            platform='reddit',
            platform_post_id=platform_post_id or f'{handle}-{minute}',
            platform_author_id=f'{handle}-id',
            author_handle=handle,
            content_text=text,
            posted_at=self.now - timedelta(minutes=minute),
            collected_at=self.now,
            hashtags=hashtags or [],
            urls=[],
        )

    def _classification(self, post: CollectedPost, tag='coordinated_inauthentic'):
        return PostClassification.objects.create(
            user=self.user,
            session=self.session,
            post=post,
            tags=[{'tag': tag, 'confidence': 0.91}],
            overall_confidence=0.91,
            prompt_version='test/post_tagger',
            model_version='test-model',
            raw_llm_response={},
            review_status='auto_eligible',
        )

    def test_loaders_accept_utf8_bom_files(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            stanford = root / 'stanford'
            pesacheck = root / 'pesacheck'
            eip = root / 'eip'
            stanford.mkdir()
            pesacheck.mkdir()
            eip.mkdir()

            (stanford / 'sample.csv').write_text(
                '\ufeffpostid,post_text,accountid,post_time,hashtags,urls,is_control\n'
                'p1,"same text",a1,2026-06-22T06:00:00Z,"[""trend""]",[],False\n',
                encoding='utf-8',
            )
            (pesacheck / 'claims.json').write_text(
                '\ufeff[{"id":"c1","text":"false claim","rating":"False"}]',
                encoding='utf-8',
            )
            (eip / 'manifest.json').write_text(
                '\ufeff{"campaigns":[{"name":"sample","accounts":["a1"]}]}',
                encoding='utf-8',
            )

            self.assertEqual(StanfordIOLoader(str(stanford)).validate()['count'], 1)
            self.assertEqual(PesaCheckLoader(str(pesacheck)).validate()['count'], 1)
            self.assertEqual(EIPLoader(str(eip)).validate()['count'], 1)

    def test_pesacheck_command_runs_with_mocked_tagger(self):
        async def fake_tag_post(_post, user_id):
            return {'tags': [{'tag': 'political_disinfo', 'confidence': 0.9}]}

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'claims.json').write_text(
                '[{"id":"c1","text":"false claim","rating":"False"},'
                '{"id":"c2","text":"satire claim","rating":"Satire"}]',
                encoding='utf-8',
            )

            with patch('signet.tagging.tag_post', side_effect=fake_tag_post):
                call_command(
                    'run_cross_validation',
                    dataset='pesacheck',
                    data_dir=str(root),
                    user=self.user.id,
                    verbosity=0,
                )

    def test_projector_routes_corroborated_coordination_as_alert(self):
        """Positive path: account inside a graph cluster → [ALERT] graph corroborated.

        Mutation-verify: temporarily change projector.py's ``in_cluster`` to
        ``False`` → this test MUST fail (returns 0); restore → passes.
        Landmine: isolated 4-account identical cluster has no baseline contrast
        (all pairs score the same) → score=0.0 is expected. Do NOT assert on score.
        """
        handle = 'acct_a'
        signal_handles = [handle, 'acct_b', 'acct_c', 'acct_d']
        identical_text = 'same campaign copy about a coordinated claim'

        for h in signal_handles:
            post = self._post(h, signal_handles.index(h) * 3, identical_text, hashtags=['trend'])
            self._classification(post)

        result = project_session(self.session)

        self.assertGreaterEqual(result['clusters_upserted'], 1)

        activities = list(
            SignetActivity.objects.filter(user=self.user).values_list('text', flat=True)
        )
        alert_texts = [t for t in activities if t.startswith('[ALERT]')]
        coord_tag_texts = [t for t in activities if t.startswith('[COORD_TAG]')]

        # At least one [ALERT] for the clustered handle with corroboration
        self.assertTrue(alert_texts)
        corroborated = [t for t in alert_texts if handle in t and 'graph corroborated' in t]
        self.assertTrue(corroborated, f'No [ALERT] with graph corroborated for {handle}')

        # The clustered handle must NOT have a [COORD_TAG] (it was corroborated)
        self.assertFalse(
            any(handle in t for t in coord_tag_texts),
            f'{handle} should not have a [COORD_TAG] when graph-corroborated',
        )
