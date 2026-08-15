import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from rest_framework import generics, status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from orchestration.webhook_validator import verify_hackerone_signature

from .hackerone_client import HackerOneClient, HackerOneClientError, is_configured
from .hackerone_sync import resolve_owner, sync_programs_and_reports, upsert_report_from_resource
from .models import (
    BugBountyProgram, BugBountyReport, BugBountyReportDraft, BugBountyWebhookEvent,
    BugBountyCampaign, BugBountyAsset, BugBountyOrg,
)
from .serializers import (
    BugBountyProgramSerializer, BugBountyReportSerializer, BugBountyReportDraftSerializer,
    BugBountyCampaignSerializer, BugBountyAssetSerializer, BugBountyOrgSerializer,
)

logger = logging.getLogger(__name__)


class IsHackerOneOwnerOrStaff(BasePermission):
    """Allow staff users and the configured HackerOne integration owner.

    The shared org API token model means one Mathia user (``HACKERONE_OWNER_USERNAME``)
    owns all synced HackerOne data. Both that owner and any staff user may trigger
    syncs/imports; regular users may not.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff:
            return True
        owner = resolve_owner()
        return bool(owner and owner.id == request.user.id)


class NoPagination:
    def paginate_queryset(self, queryset, request, view=None):
        return None

    def get_paginated_response(self, data):
        return Response(data)


class ProgramList(generics.ListAPIView):
    serializer_class = BugBountyProgramSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyProgram.objects.filter(user=self.request.user)


class ReportList(generics.ListAPIView):
    serializer_class = BugBountyReportSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyReport.objects.filter(user=self.request.user)


class DraftList(generics.ListAPIView):
    serializer_class = BugBountyReportDraftSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyReportDraft.objects.filter(user=self.request.user)


class CampaignList(generics.ListAPIView):
    serializer_class = BugBountyCampaignSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyCampaign.objects.filter(user=self.request.user)


class AssetList(generics.ListAPIView):
    serializer_class = BugBountyAssetSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyAsset.objects.filter(user=self.request.user)


class OrgList(generics.ListAPIView):
    serializer_class = BugBountyOrgSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyOrg.objects.filter(user=self.request.user)


class HackerOneStatusView(APIView):
    """Report whether the HackerOne integration is configured and for whom."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner = resolve_owner()
        return Response({
            'enabled': bool(getattr(settings, 'HACKERONE_ENABLED', False)),
            'configured': is_configured(),
            'ownerUsername': owner.username if owner else None,
            'isOwnerOrStaff': bool(request.user.is_staff or (owner and request.user.id == owner.id)),
        })


class HackerOneSyncView(APIView):
    """Pull HackerOne programs + reports into the integration owner's account."""

    permission_classes = [IsHackerOneOwnerOrStaff]

    def post(self, request):
        if not is_configured():
            return Response(
                {'error': 'HackerOne integration is not configured. Set HACKERONE_ENABLED, HACKERONE_API_TOKEN_ID and HACKERONE_API_TOKEN_VALUE.'},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        try:
            result = sync_programs_and_reports(owner=resolve_owner())
        except HackerOneClientError as exc:
            logger.error("HackerOne sync failed: %s", exc)
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        if 'error' in result:
            return Response(result, status=status.HTTP_409_CONFLICT)
        return Response(result)


class HackerOneImportView(APIView):
    """Create/import a report into a HackerOne program and persist a local row."""

    permission_classes = [IsHackerOneOwnerOrStaff]

    def post(self, request):
        if not is_configured():
            return Response(
                {'error': 'HackerOne integration is not configured.'},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        program_handle = (request.data.get('program_handle') or '').strip()
        title = (request.data.get('title') or '').strip()
        vulnerability_information = request.data.get('vulnerability_information') or ''
        impact = request.data.get('impact') or ''
        severity = (request.data.get('severity') or '').strip().lower()

        if not program_handle or not title:
            return Response(
                {'error': 'program_handle and title are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not vulnerability_information and not impact:
            return Response(
                {'error': 'vulnerability_information or impact is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if severity and severity not in ('critical', 'high', 'medium', 'low', 'none'):
            return Response(
                {'error': 'severity must be one of critical, high, medium, low, none.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = resolve_owner()
        if owner is None:
            return Response(
                {'error': 'No integration owner found.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            client = HackerOneClient()
            created = client.create_report(
                program_handle, title, vulnerability_information, impact,
                severity=severity or None, source='api',
            )
        except HackerOneClientError as exc:
            logger.error("HackerOne import failed: %s", exc)
            return Response(
                {'error': str(exc), 'status_code': exc.status_code},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        report_id = str(created.get('id', ''))
        # Persist a local mirror so it shows up in the reports list immediately.
        try:
            program = BugBountyProgram.objects.filter(
                user=owner, source_handle=program_handle,
            ).first()
            if program is None:
                program = BugBountyProgram.objects.filter(
                    user=owner, program_id=f"h1-{program_handle}",
                ).first()
        except Exception:
            program = None

        if program is not None and report_id:
            upsert_report_from_resource(owner, created)

        return Response({
            'report_id': report_id,
            'url': f"https://hackerone.com/reports/{report_id}" if report_id else None,
            'raw': created,
        })


@csrf_exempt
@require_POST
def hackerone_webhook(request):
    """Receive HackerOne webhook deliveries (signed POST)."""
    body = request.body
    signature = request.headers.get('X-H1-Signature', '')
    event_type = request.headers.get('X-H1-Event', '')
    delivery_id = request.headers.get('X-H1-Delivery', '')

    secret = getattr(settings, 'HACKERONE_WEBHOOK_SECRET', '') or ''
    signature_valid = verify_hackerone_signature(signature, secret, body)

    if not signature_valid:
        logger.warning("Rejected HackerOne webhook: invalid signature (event=%s, delivery=%s)",
                       event_type, delivery_id)
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    try:
        payload = json.loads(body.decode('utf-8') if isinstance(body, bytes) else body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    if not delivery_id:
        delivery_id = event_type or 'unknown'

    event, created = BugBountyWebhookEvent.objects.get_or_create(
        delivery_id=delivery_id,
        defaults={
            'event_type': event_type,
            'signature_valid': True,
            'payload': payload,
        },
    )

    if not created:
        # Duplicate delivery — ack without reprocessing.
        return JsonResponse({'status': 'duplicate'}, status=200)

    error = ''
    processed = False
    owner = resolve_owner()
    if owner is None:
        error = 'no_integration_owner'
    else:
        report_resource = _extract_report_resource(payload)
        if report_resource is None:
            error = 'no_report_in_payload'
        else:
            try:
                _, outcome = upsert_report_from_resource(owner, report_resource)
                if outcome == 'program_not_found':
                    error = 'program_not_found'
                else:
                    processed = True
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("HackerOne webhook processing failed")
                error = f'exception: {exc}'

    event.processed = processed
    event.error = error
    event.save(update_fields=['processed', 'error'])

    # Always 200 on valid signature to prevent endless HackerOne retries;
    # errors are captured on the event row for the operator to inspect.
    return JsonResponse({'status': 'processed' if processed else 'skipped', 'error': error}, status=200)


def _extract_report_resource(payload):
    """Pull the report resource out of a HackerOne webhook payload."""
    if not isinstance(payload, dict):
        return None
    data = payload.get('data')
    if isinstance(data, dict):
        report = data.get('report')
        if isinstance(report, dict):
            return report
    report = payload.get('report')
    if isinstance(report, dict):
        return report
    return None
