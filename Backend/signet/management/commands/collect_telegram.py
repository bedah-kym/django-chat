from django.conf import settings
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from signet.models import CollectionSession, SignetActivity
from signet.collectors import TelegramCollector

User = get_user_model()


class Command(BaseCommand):
    help = 'Collect Telegram channel messages and store as IngestionRecords + CollectedPosts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--channels',
            type=str,
            default='',
            help='Comma-separated Telegram channel usernames/ids. Defaults to TELEGRAM_DEFAULT_CHANNELS.',
        )
        parser.add_argument('--limit', type=int, default=50, help='Messages per channel')
        parser.add_argument('--user', type=str, default='alex', help='Username for the CollectionSession owner')

    def handle(self, *args, **options):
        channels = [c.strip() for c in options['channels'].split(',') if c.strip()]
        if not channels:
            channels = getattr(settings, 'TELEGRAM_DEFAULT_CHANNELS', [])
        if not channels:
            self.stderr.write('No Telegram channels configured. Pass --channels or set TELEGRAM_DEFAULT_CHANNELS.')
            return

        user = User.objects.filter(username=options['user']).first()
        if not user:
            self.stderr.write(f'User "{options["user"]}" not found')
            return

        session = CollectionSession.objects.create(
            user=user,
            platform='telegram',
            config={'channels': channels, 'limit': options['limit']},
            status='running',
            started_at=timezone.now(),
        )

        collector = TelegramCollector(session)
        count = collector.collect()

        session.status = 'idle'
        session.stats = {'last_run': str(timezone.now()), 'posts_collected': count}
        session.save()

        for channel in channels:
            SignetActivity.objects.create(
                user=user,
                text=f'Collected {count} posts from {channel}',
                is_alert=False,
            )

        self.stdout.write(f'Collected {count} Telegram messages from {channels}')
