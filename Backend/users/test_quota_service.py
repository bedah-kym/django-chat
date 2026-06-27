"""Regression tests for users.QuotaService.get_user_quotas.

Charter (see Backend/TESTING.md):
  Owned invariants
    * get_status maps usage% to (status, color): >=100 exhausted/red,
      >=80 critical/orange, >=50 warning/yellow, else good/green. Boundaries are
      INCLUSIVE (>=), not exclusive.
    * 'used' reflects the value stored under each quota's exact cache key
      (search=daily, actions=hourly/no-time, messages=per-minute).
    * Uploads are counted from the DB within a rolling 10-hour window, scoped to
      the user — stale (>10h) and other users' uploads are excluded.
  Lanes: cache quotas use an isolated locmem cache (override_settings) for
  determinism; the upload window is a served-from-DB freshness predicate, so it
  uses the real DB (TestCase).

Converted from the assertion-light tests/smoke_quota_service.py.
"""
from datetime import datetime, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from users.quota_service import QuotaService
from chatbot.models import Chatroom, DocumentUpload

User = get_user_model()

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=LOCMEM)
class QuotaStatusBandTests(TestCase):
    """Drives the status/color bands through the `actions` quota, whose cache key
    has no time component, so the assertions are fully deterministic."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='quota_bands', password='x')
        self.service = QuotaService()

    def _set_actions(self, used):
        cache.set(f"mcp_rate:{self.user.id}", used, 3600)

    def _actions(self):
        return self.service.get_user_quotas(self.user.id)['actions']

    def test_good_band_below_half(self):
        self._set_actions(49)  # 49% -> good/green
        a = self._actions()
        self.assertEqual((a['used'], a['status'], a['color']), (49, 'good', 'green'))

    def test_warning_band_inclusive_at_fifty(self):
        self._set_actions(50)  # exactly 50% -> warning (fails if >=50 becomes >50)
        a = self._actions()
        self.assertEqual((a['status'], a['color']), ('warning', 'yellow'))

    def test_critical_band_inclusive_at_eighty(self):
        self._set_actions(80)  # exactly 80% -> critical (fails if >=80 becomes >80)
        a = self._actions()
        self.assertEqual((a['status'], a['color']), ('critical', 'orange'))

    def test_exhausted_band_inclusive_at_and_over_limit(self):
        self._set_actions(100)  # exactly 100% -> exhausted (fails if >=100 becomes >100)
        self.assertEqual(self._actions()['status'], 'exhausted')
        self._set_actions(105)  # over limit -> still exhausted/red
        a = self._actions()
        self.assertEqual((a['used'], a['status'], a['color']), (105, 'exhausted', 'red'))

    def test_unused_quota_defaults_to_zero_good(self):
        a = self._actions()  # nothing set in cache
        self.assertEqual((a['used'], a['status'], a['color']), (0, 'good', 'green'))


@override_settings(CACHES=LOCMEM)
class QuotaCacheKeyTests(TestCase):
    """The time-based keys (daily search, per-minute messages) must be read under
    the exact key the writer uses. Time is frozen so the test can't straddle a
    minute/day boundary between writing the key and reading it."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='quota_keys', password='x')
        self.service = QuotaService()

    def test_daily_and_minute_keys_are_read(self):
        frozen = datetime(2026, 6, 27, 10, 30, 0)
        today = frozen.strftime("%Y-%m-%d")
        minute = frozen.strftime("%Y-%m-%d-%H-%M")
        cache.set(f"search_limit:{self.user.id}:{today}", 7, 3600)
        cache.set(f"rate_limit:{self.user.id}:{minute}", 12, 60)
        with mock.patch('users.quota_service.datetime') as mdt:
            mdt.now.return_value = frozen
            q = self.service.get_user_quotas(self.user.id)
        self.assertEqual(q['search']['used'], 7)
        self.assertEqual(q['messages']['used'], 12)


@override_settings(CACHES=LOCMEM)
class UploadQuotaWindowTests(TestCase):
    """The upload quota is a served-from-DB freshness predicate: count rows for
    this user within the last 10 hours."""

    def setUp(self):
        cache.clear()  # so the cache-based quotas read 0
        self.user = User.objects.create_user(username='quota_uploads', password='x')
        self.room = Chatroom.objects.create()
        self.service = QuotaService()

    def _upload(self, when, user=None):
        up = DocumentUpload.objects.create(
            user=user or self.user, chatroom=self.room,
            file_type='pdf', file_path='uploads/test.pdf', file_size=1024,
            quota_window_start=when,  # required field; the quota query uses uploaded_at
        )
        # uploaded_at is auto_now_add; .update() bypasses it to place the row in time.
        DocumentUpload.objects.filter(pk=up.pk).update(uploaded_at=when)
        return up

    def test_counts_only_uploads_within_10h_window(self):
        now = timezone.now()
        self._upload(now - timedelta(hours=1))    # in window
        self._upload(now - timedelta(hours=9))    # in window
        self._upload(now - timedelta(hours=11))   # STALE -> excluded
        q = self.service.get_user_quotas(self.user.id)
        self.assertEqual(q['uploads']['used'], 2)

    def test_counts_only_target_users_uploads(self):
        other = User.objects.create_user(username='quota_other', password='x')
        now = timezone.now()
        self._upload(now - timedelta(hours=1))               # this user -> counted
        self._upload(now - timedelta(hours=1), user=other)   # other user -> excluded
        q = self.service.get_user_quotas(self.user.id)
        self.assertEqual(q['uploads']['used'], 1)
