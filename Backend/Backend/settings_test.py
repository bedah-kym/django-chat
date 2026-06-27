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

# In-process cache + email so tests never reach Redis/SMTP, stay isolated between
# runs, and can assert against django.core.mail.outbox.
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
