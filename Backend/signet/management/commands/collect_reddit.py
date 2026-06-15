from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from signet.models import CollectionSession, SignetActivity
from signet.collectors import RedditCollector

User = get_user_model()


class Command(BaseCommand):
    help = 'Collect Reddit posts and store as IngestionRecords + CollectedPosts'

    def add_arguments(self, parser):
        parser.add_argument('--subreddits', type=str, default='Kenya',
                            help='Comma-separated list of subreddits')
        parser.add_argument('--limit', type=int, default=50,
                            help='Posts per subreddit')
        parser.add_argument('--user', type=str, default='alex',
                            help='Username for the CollectionSession owner')

    def handle(self, *args, **options):
        subreddits = [s.strip() for s in options['subreddits'].split(',') if s.strip()]
        limit = options['limit']
        username = options['user']

        user = User.objects.filter(username=username).first()
        if not user:
            self.stderr.write(f'User "{username}" not found')
            return

        session = CollectionSession.objects.create(
            user=user,
            platform='reddit',
            config={'subreddits': subreddits, 'limit': limit},
            status='running',
            started_at=timezone.now(),
        )

        collector = RedditCollector(session)
        count = collector.collect()

        session.status = 'idle'
        session.stats = {'last_run': str(timezone.now()), 'posts_collected': count}
        session.save()

        for sub in subreddits:
            SignetActivity.objects.create(
                user=user,
                text=f'Collected {count} posts from r/{sub}',
                is_alert=False,
            )

        self.stdout.write(f'Collected {count} posts from {subreddits}')
