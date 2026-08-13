import hashlib
import hmac
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from orchestration.webhook_validator import verify_hackerone_signature

from .hackerone_client import HackerOneClient
from .hackerone_sync import map_h1_severity, map_h1_state, sync_programs_and_reports
from .models import BugBountyProgram, BugBountyReport, BugBountyWebhookEvent

User = get_user_model()


def h1_signature(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


class SignatureVerificationTests(TestCase):
    def test_valid_signature(self):
        body = b'{"data":{}}'
        self.assertTrue(verify_hackerone_signature(h1_signature(body, 'secret'), 'secret', body))

    def test_invalid_signature(self):
        self.assertFalse(verify_hackerone_signature(h1_signature(b'abc', 'secret'), 'secret', b'abd'))

    def test_missing_signature(self):
        self.assertFalse(verify_hackerone_signature('', 'secret', b'x'))

    def test_malformed_signature(self):
        self.assertFalse(verify_hackerone_signature('md5=abc123', 'secret', b'x'))

    def test_empty_secret_allowed(self):
        sig = h1_signature(b'body', '')
        self.assertTrue(verify_hackerone_signature(sig, '', b'body'))


class MappingTests(TestCase):
    def test_state_mapping(self):
        self.assertEqual(map_h1_state('triaged'), 'triaged')
        self.assertEqual(map_h1_state('resolved'), 'resolved')
        self.assertEqual(map_h1_state('duplicate'), 'duplicate')
        self.assertEqual(map_h1_state('new'), 'draft')
        self.assertEqual(map_h1_state('needs-more-info'), 'draft')
        self.assertEqual(map_h1_state('informative'), 'resolved')
        self.assertEqual(map_h1_state('spam'), 'resolved')
        self.assertEqual(map_h1_state(None), 'draft')
        self.assertEqual(map_h1_state('unknown'), 'draft')

    def test_severity_mapping(self):
        self.assertEqual(map_h1_severity('critical'), 'critical')
        self.assertEqual(map_h1_severity('high'), 'high')
        self.assertEqual(map_h1_severity('LOW'), 'low')
        self.assertEqual(map_h1_severity('none'), 'medium')
        self.assertEqual(map_h1_severity(None), 'medium')


@override_settings(HACKERONE_ENABLED=True, HACKERONE_API_TOKEN_ID='id', HACKERONE_API_TOKEN_VALUE='secret')
class SyncTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser('admin', 'admin@example.com', 'pass')

    def _program_res(self):
        return {
            'id': '123', 'type': 'program',
            'attributes': {'handle': 'security', 'name': 'Security Program', 'bounty_range': '$500 - $5,000'},
        }

    def _report_res(self, state='triaged'):
        return {
            'id': '456', 'type': 'report',
            'attributes': {
                'title': 'XSS on login', 'state': state,
                'submitted_at': '2026-08-13T00:00:00Z',
                'created_at': '2026-08-13T00:00:00Z',
            },
            'relationships': {
                'program': {'data': {'id': '123', 'type': 'program'}},
                'severity': {'data': {'id': '1', 'type': 'severity', 'attributes': {'rating': 'high'}}},
            },
        }

    def test_sync_creates_programs_and_reports(self):
        with patch.object(HackerOneClient, 'get_programs', return_value=[self._program_res()]), \
                patch.object(HackerOneClient, 'get_reports', return_value=[self._report_res()]):
            result = sync_programs_and_reports(owner=self.owner)

        self.assertEqual(result['programs_created'], 1)
        self.assertEqual(result['reports_created'], 1)

        program = BugBountyProgram.objects.get(program_id='h1-security')
        self.assertEqual(program.name, 'Security Program')
        self.assertEqual(program.source_handle, 'security')
        self.assertEqual(program.external_id, '123')

        report = BugBountyReport.objects.get(report_id='456')
        self.assertEqual(report.title, 'XSS on login')
        self.assertEqual(report.status, 'triaged')
        self.assertEqual(report.severity, 'high')
        self.assertEqual(report.program, program)
        self.assertEqual(report.source_url, 'https://hackerone.com/reports/456')

    def test_sync_is_idempotent(self):
        with patch.object(HackerOneClient, 'get_programs', return_value=[self._program_res()]), \
                patch.object(HackerOneClient, 'get_reports', return_value=[self._report_res()]):
            sync_programs_and_reports(owner=self.owner)
            result = sync_programs_and_reports(owner=self.owner)

        self.assertEqual(result['programs_updated'], 1)
        self.assertEqual(result['reports_updated'], 1)
        self.assertEqual(BugBountyProgram.objects.count(), 1)
        self.assertEqual(BugBountyReport.objects.count(), 1)


@override_settings(HACKERONE_ENABLED=True, HACKERONE_WEBHOOK_SECRET='test-secret')
class WebhookTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser('admin', 'admin@example.com', 'pass')
        BugBountyProgram.objects.create(
            user=self.owner, program_id='h1-security', name='Security Program',
            platform='HackerOne', external_id='123', source_handle='security',
        )
        self.url = reverse('bugbounty:hackerone_webhook')
        self.client = APIClient()

    def _report_payload(self, state='triaged'):
        return {
            'data': {
                'report': {
                    'id': '456', 'type': 'report',
                    'attributes': {
                        'title': 'XSS', 'state': state,
                        'submitted_at': '2026-08-13T00:00:00Z',
                        'created_at': '2026-08-13T00:00:00Z',
                    },
                    'relationships': {
                        'program': {'data': {'id': '123', 'type': 'program'}},
                        'severity': {'data': {'id': '1', 'type': 'severity', 'attributes': {'rating': 'high'}}},
                    },
                },
            },
        }

    def _post(self, payload, delivery='delivery-1', event='report_triaged', signature=None):
        body = json.dumps(payload)
        sig = signature if signature is not None else h1_signature(body.encode(), 'test-secret')
        return self.client.post(
            self.url, data=body, content_type='application/json',
            HTTP_X_H1_SIGNATURE=sig,
            HTTP_X_H1_DELIVERY=delivery,
            HTTP_X_H1_EVENT=event,
        )

    def test_invalid_signature_rejected(self):
        resp = self._post(self._report_payload(), signature='sha256=deadbeef')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(BugBountyWebhookEvent.objects.exists())

    def test_valid_webhook_creates_report(self):
        resp = self._post(self._report_payload())
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(BugBountyWebhookEvent.objects.filter(delivery_id='delivery-1', processed=True).exists())
        report = BugBountyReport.objects.get(report_id='456')
        self.assertEqual(report.status, 'triaged')
        self.assertEqual(report.severity, 'high')

    def test_duplicate_delivery_processed_once(self):
        self._post(self._report_payload(state='triaged'))
        self._post(self._report_payload(state='resolved'))
        self.assertEqual(BugBountyWebhookEvent.objects.filter(delivery_id='delivery-1').count(), 1)
        report = BugBountyReport.objects.get(report_id='456')
        self.assertEqual(report.status, 'triaged')


@override_settings(HACKERONE_ENABLED=True, HACKERONE_API_TOKEN_ID='id', HACKERONE_API_TOKEN_VALUE='secret')
class ImportEndpointTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser('admin', 'admin@example.com', 'pass')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.url = reverse('bugbounty:hackerone_import')

    def test_import_requires_fields(self):
        resp = self.client.post(self.url, {}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_import_creates_hackerone_report(self):
        created = {'id': '789', 'type': 'report', 'attributes': {'title': 'T', 'state': 'new'}}
        with patch.object(HackerOneClient, 'create_report', return_value=created):
            resp = self.client.post(self.url, {
                'program_handle': 'security',
                'title': 'XSS',
                'vulnerability_information': 'steps to reproduce',
                'impact': 'impact',
                'severity': 'high',
            }, format='json')

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['report_id'], '789')


class StatusEndpointTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser('admin', 'admin@example.com', 'pass')
        self.client = APIClient()

    def test_status_requires_auth(self):
        resp = self.client.get(reverse('bugbounty:hackerone_status'))
        self.assertIn(resp.status_code, (401, 403))

    @override_settings(HACKERONE_ENABLED=True, HACKERONE_API_TOKEN_ID='id', HACKERONE_API_TOKEN_VALUE='v')
    def test_status_returns_config(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.get(reverse('bugbounty:hackerone_status'))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['configured'])
        self.assertTrue(resp.data['isOwnerOrStaff'])
        self.assertEqual(resp.data['ownerUsername'], 'admin')
