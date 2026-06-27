"""Test settings: fast, deterministic, isolated.

Run the suite with:
    python manage.py test --settings=Backend.settings_test

Inherits everything from settings.py and overrides ONLY what makes tests faster
and hermetic — never anything that changes the behaviour under test.
"""
from .settings import *  # noqa: F401,F403

# PBKDF2 dominates the runtime of user-creation-heavy tests (every User triggers
# the encryption-key signal). MD5 is ~100x faster and fine for non-prod hashing.
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# locmem email so tests stay offline and can assert against mail.outbox.
# NB: CACHES is intentionally left as the base (shared) backend — django_ratelimit
# rejects a non-shared cache (LocMemCache) at system-check time (E003).
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# The Django test client only speaks HTTP, so an HTTPS redirect turns every
# request into a 301 and breaks view tests. Force it off here (not via DEBUG)
# so the suite is correct in ANY environment — including against prod Postgres.
SECURE_SSL_REDIRECT = False
