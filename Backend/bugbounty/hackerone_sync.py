"""
Sync service: pull HackerOne programs + reports into local models.

All rows are owned by a single "integration owner" user (see
``resolve_owner``) because the HackerOne API token is org-wide via env vars.
"""

import logging
from datetime import datetime, timezone

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone as dj_timezone

from .hackerone_client import (
    HackerOneClient,
    _get_attr,
    _get_relationship_attr,
    _get_relationship_id,
    is_configured,
)
from .models import BugBountyProgram, BugBountyReport

logger = logging.getLogger(__name__)

User = get_user_model()

STATE_MAP = {
    'triaged': 'triaged',
    'resolved': 'resolved',
    'duplicate': 'duplicate',
    # open/active states -> draft (local "draft" is the generic open bucket)
    'new': 'draft',
    'needs-more-info': 'draft',
    'retesting': 'draft',
    # closed states without a distinct local bucket -> resolved
    'not-applicable': 'resolved',
    'informative': 'resolved',
    'spam': 'resolved',
}

SEVERITY_MAP = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
}


def resolve_owner():
    """Return the User that owns synced HackerOne data, or None."""
    username = getattr(settings, 'HACKERONE_OWNER_USERNAME', '') or ''
    if username:
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            logger.warning("HACKERONE_OWNER_USERNAME=%r not found; falling back to first superuser", username)
    return User.objects.filter(is_superuser=True).order_by('id').first()


def map_h1_state(state):
    if not state:
        return 'draft'
    return STATE_MAP.get(str(state).lower(), 'draft')


def map_h1_severity(rating):
    if not rating:
        return 'medium'
    return SEVERITY_MAP.get(str(rating).lower(), 'medium')


def _parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None


def _map_program(resource, user):
    attrs = resource.get('attributes') or {}
    handle = attrs.get('handle') or str(resource.get('id', ''))
    return {
        'user': user,
        'program_id': f"h1-{handle}",
        'name': (attrs.get('name') or handle)[:200],
        'platform': 'HackerOne',
        'external_id': str(resource.get('id', '')),
        'source_handle': handle,
        'bounty_range': (attrs.get('bounty_range') or '')[:100],
        'scan_status': 'ready',
        'synced_at': dj_timezone.now(),
    }


def _map_report(resource, program, user):
    attrs = resource.get('attributes') or {}
    report_id = str(resource.get('id', ''))
    severity = _get_relationship_attr(resource, 'severity', 'rating') or attrs.get('severity_rating')
    target = (
        attrs.get('structured_scope')
        or _get_relationship_attr(resource, 'structured_scope', 'asset_identifier')
        or ''
    )
    submitted_at = _parse_dt(attrs.get('submitted_at') or attrs.get('created_at'))
    if submitted_at is None:
        submitted_at = dj_timezone.now()

    return {
        'user': user,
        'report_id': report_id,
        'title': (attrs.get('title') or 'Untitled report')[:300],
        'target': str(target or '')[:300],
        'bounty_kes': 0,
        'platform': 'HackerOne',
        'program': program,
        'status': map_h1_state(attrs.get('state')),
        'submitted_at': submitted_at,
        'severity': map_h1_severity(severity),
        'external_id': report_id,
        'source_url': f"https://hackerone.com/reports/{report_id}",
        'raw_payload': resource,
        'synced_at': dj_timezone.now(),
    }


def _resolve_program_for_report(resource, programs_by_id, programs_by_handle):
    """Find the local BugBountyProgram a report belongs to, or None."""
    handle = _get_relationship_attr(resource, 'program', 'handle')
    if handle and f"h1-{handle}" in programs_by_handle:
        return programs_by_handle[f"h1-{handle}"]

    numeric_id = _get_relationship_id(resource, 'program')
    if numeric_id and str(numeric_id) in programs_by_id:
        return programs_by_id[str(numeric_id)]

    return None


def _build_program_index(owner):
    programs = BugBountyProgram.objects.filter(user=owner)
    by_id = {p.external_id: p for p in programs if p.external_id}
    by_handle = {p.program_id: p for p in programs}
    return by_id, by_handle


def upsert_report_from_resource(owner, resource):
    """Upsert a single report resource (used by the webhook receiver).

    Returns ``(report_or_none, outcome)`` where outcome is one of
    ``created``, ``updated``, or ``program_not_found``.
    """
    by_id, by_handle = _build_program_index(owner)
    program = _resolve_program_for_report(resource, by_id, by_handle)
    if program is None:
        return None, 'program_not_found'

    data = _map_report(resource, program, owner)
    report, created = BugBountyReport.objects.update_or_create(
        report_id=data['report_id'],
        defaults=data,
    )
    return report, ('created' if created else 'updated')


def sync_programs_and_reports(owner=None):
    """Pull HackerOne programs + reports into ``owner``'s local rows.

    Returns a summary dict with created/updated/skipped counts.
    """
    if not is_configured():
        return {'error': 'HackerOne integration is not configured'}

    owner = owner or resolve_owner()
    if owner is None:
        return {'error': 'No integration owner found (set HACKERONE_OWNER_USERNAME or create a superuser)'}

    client = HackerOneClient()
    programs_created = programs_updated = 0
    reports_created = reports_updated = reports_skipped = 0

    # 1) Programs
    programs_by_id = {}
    programs_by_handle = {}
    for resource in client.get_programs():
        data = _map_program(resource, owner)
        program, created = BugBountyProgram.objects.update_or_create(
            program_id=data['program_id'],
            defaults=data,
        )
        programs_by_id[program.external_id] = program
        programs_by_handle[program.program_id] = program
        if created:
            programs_created += 1
        else:
            programs_updated += 1

    # 2) Reports — HackerOne lists reports per program via filter[program][].
    for program in programs_by_handle.values():
        if not program.source_handle:
            continue
        for resource in client.get_reports(program_handle=program.source_handle):
            data = _map_report(resource, program, owner)
            report, created = BugBountyReport.objects.update_or_create(
                report_id=data['report_id'],
                defaults=data,
            )
            if created:
                reports_created += 1
            else:
                reports_updated += 1

    return {
        'programs_created': programs_created,
        'programs_updated': programs_updated,
        'reports_created': reports_created,
        'reports_updated': reports_updated,
        'reports_skipped': reports_skipped,
    }
