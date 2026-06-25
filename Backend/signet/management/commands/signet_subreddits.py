"""Discover the operator's Reddit subreddits and optionally point the live
collection session at them.

    python manage.py signet_subreddits                 # dry-run: list subs
    python manage.py signet_subreddits --apply         # repoint running session
    python manage.py signet_subreddits --apply --source active --clear-keywords
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from signet.collectors.reddit_auth import discover_user_subreddits
from signet.models import CollectionSession

User = get_user_model()


class Command(BaseCommand):
    help = "Discover the authenticated Reddit user's subreddits; optionally apply them to the collection session."

    def add_arguments(self, parser):
        parser.add_argument('--user', default='alex', help='CollectionSession owner username')
        parser.add_argument('--source', choices=['subscribed', 'active', 'both'], default='both',
                            help='Which set to apply (default: both, active first)')
        parser.add_argument('--apply', action='store_true',
                            help='Update the running session config with the discovered subreddits')
        parser.add_argument('--clear-keywords', action='store_true',
                            help='Clear the keyword filter so the collector pulls newest from each sub')
        parser.add_argument('--max-subs', type=int, default=25,
                            help='Cap how many subreddits are applied (avoids huge tagging volume)')

    def handle(self, *args, **opts):
        try:
            data = discover_user_subreddits()
        except Exception as e:
            self.stderr.write(self.style.ERROR(str(e)))
            return

        self.stdout.write(self.style.SUCCESS(f"Reddit user: u/{data['username']}"))
        self.stdout.write(f"Subscribed ({len(data['subscribed'])}): " + (', '.join(data['subscribed']) or '—'))
        self.stdout.write('Active (recent comments + submissions):')
        for name, n in data['active'][:30]:
            self.stdout.write(f'   r/{name}  ({n})')

        if not opts['apply']:
            self.stdout.write('\n(dry run — pass --apply to point the collection session at these)')
            return

        active_names = [name for name, _ in data['active']]
        if opts['source'] == 'subscribed':
            subs = data['subscribed']
        elif opts['source'] == 'active':
            subs = active_names
        else:  # both — active first (where they actually participate), then the rest of subscribed
            subs = list(dict.fromkeys(active_names + data['subscribed']))
        subs = subs[:opts['max_subs']]

        if not subs:
            self.stderr.write(self.style.ERROR('No subreddits discovered to apply.'))
            return

        user = User.objects.filter(username=opts['user']).first()
        if not user:
            self.stderr.write(self.style.ERROR(f"User '{opts['user']}' not found"))
            return

        session = (CollectionSession.objects
                   .filter(user=user, status='running')
                   .order_by('-id').first())
        if not session:
            session = CollectionSession.objects.create(
                user=user, platform='reddit', status='running', config={})
            self.stdout.write(f'No running session — created session {session.id}')

        cfg = dict(session.config or {})
        cfg['subreddits'] = subs
        if opts['clear_keywords']:
            cfg['keywords'] = []
        session.config = cfg
        session.save(update_fields=['config'])

        self.stdout.write(self.style.SUCCESS(
            f'Applied {len(subs)} subreddits to session {session.id}: {subs}'))
        self.stdout.write('The 30-min heartbeat will collect from these on the next cycle '
                          '(or run: python manage.py collect_reddit ... to pull now).')
