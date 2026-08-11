"""One-shot command: create an X collection session and fire the task."""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from signet.models import CollectionSession
from signet.tasks import collect_x_task


class Command(BaseCommand):
    help = 'Create an X feed collection session and trigger collection.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=10)
        parser.add_argument('--user-id', type=int, default=None)

    def handle(self, **options):
        User = get_user_model()
        user_id = options['user_id']
        user = User.objects.get(id=user_id) if user_id else User.objects.first()
        limit = options['limit']

        session = CollectionSession.objects.create(
            user=user,
            platform='x',
            config={'feed_types': ['for_you', 'following'], 'limit': limit},
            status='running',
        )
        self.stdout.write(f'Session created: id={session.id} user={user.username}')

        task = collect_x_task.delay(session.id)
        self.stdout.write(f'Task fired: {task.id}')
        self.stdout.write('Check `railway logs` for results.')
