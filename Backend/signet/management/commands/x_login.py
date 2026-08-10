"""
Management command — log into X and save cookies for the X Feed collector.

Usage:
    python manage.py x_login
    python manage.py x_login --email you@example.com --username yourhandle --password hunter2
    python manage.py x_login --output /app/x_cookies.json

Credentials can also be set via env vars:
    X_EMAIL, X_USERNAME, X_PASSWORD

The cookies file is saved to SIGNET_X_COOKIES_PATH (default: x_cookies.json)
and should be mounted into the Docker container or committed (gitignored by default).
"""
import json
import os
import getpass

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings


class Command(BaseCommand):
    help = 'Log into X and save cookies for the X Feed collector (twikit).'

    def add_arguments(self, parser):
        parser.add_argument('--email', help='X account email')
        parser.add_argument('--username', help='X @handle (without @)')
        parser.add_argument('--password', help='X password (omit to prompt)')
        parser.add_argument(
            '--output',
            default=None,
            help=f'Cookies output path (default: {getattr(settings, "SIGNET_X_COOKIES_PATH", "x_cookies.json")})',
        )

    def handle(self, **options):
        output_path = options['output'] or getattr(
            settings, 'SIGNET_X_COOKIES_PATH', 'x_cookies.json'
        )

        email = options['email'] or os.environ.get('X_EMAIL', '')
        username = options['username'] or os.environ.get('X_USERNAME', '')
        password = options['password'] or os.environ.get('X_PASSWORD', '')

        # Prompt for missing values
        if not email:
            email = input('X email: ').strip()
        if not username:
            username = input('X @handle (without @): ').strip()
        if not password:
            password = getpass.getpass('X password: ').strip()

        if not all([email, username, password]):
            raise CommandError('Email, username, and password are all required.')

        self.stdout.write(f'Logging into X as @{username}...')

        try:
            from twikit import Client
            import asyncio

            async def _login():
                client = Client('en-US')
                await client.login(
                    auth_info_1=username,
                    auth_info_2=email,
                    password=password,
                )
                return client

            client = asyncio.run(_login())

            # Save cookies
            cookies = client.get_cookies()
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(cookies, f, indent=2)

            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Cookies saved to {output_path} ({len(cookies)} cookies).'
                )
            )

            # Also print base64 version for Railway env var
            import base64
            b64 = base64.b64encode(
                json.dumps(cookies).encode('utf-8')
            ).decode('utf-8')
            self.stdout.write(
                f'\n📋 Railway env var (paste into SIGNET_X_COOKIES_JSON):\n'
                f'   SIGNET_X_COOKIES_JSON={b64[:80]}...'
            )

            # Verify by fetching user info
            user = client.user()
            self.stdout.write(
                f'\n👤 Verified: @{getattr(user, "screen_name", "?")} '
                f'({getattr(user, "name", "?")})'
            )

        except ImportError:
            raise CommandError(
                'twikit is not installed. Run: pip install twikit'
            )
        except Exception as exc:
            raise CommandError(f'Login failed: {exc}')
