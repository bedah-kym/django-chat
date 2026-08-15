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
    HackerOneClientError,
    _get_attr,
    _get_relationship_attr,
    _get_relationship_id,
    is_configured,
)
from .models import (
    BugBountyProgram, BugBountyReport, BugBountyCampaign, BugBountyAsset, BugBountyOrg,
)

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


def _map_campaign(resource, program, user):
    attrs = resource.get('attributes') or {}
    campaign_id = str(resource.get('id', ''))
    multiplier = attrs.get('multiplier') or attrs.get('bounty_multiplier') or ''
    if isinstance(multiplier, (int, float)):
        multiplier = f"{multiplier}x"
    return {
        'user': user,
        'program': program,
        'campaign_id': campaign_id,
        'name': (attrs.get('name') or attrs.get('title') or 'Campaign')[:300],
        'multiplier': str(multiplier)[:50],
        'starts_at': _parse_dt(attrs.get('starts_at') or attrs.get('started_at')),
        'ends_at': _parse_dt(attrs.get('ends_at') or attrs.get('ended_at')),
        'status': str(attrs.get('status') or attrs.get('state') or '')[:30],
        'raw_payload': resource,
        'synced_at': dj_timezone.now(),
    }


def _map_asset(resource, user):
    attrs = resource.get('attributes') or {}
    asset_id = str(resource.get('id', ''))
    return {
        'user': user,
        'asset_id': asset_id,
        'asset_type': str(attrs.get('asset_type') or attrs.get('type') or '')[:50],
        'identifier': str(attrs.get('identifier') or attrs.get('asset_identifier') or '')[:500],
        'state': str(attrs.get('state') or '')[:30],
        'raw_payload': resource,
        'synced_at': dj_timezone.now(),
    }


def _map_org(resource, user, member_count):
    attrs = resource.get('attributes') or {}
    org_id = str(resource.get('id', ''))
    return {
        'user': user,
        'org_id': org_id,
        'handle': str(attrs.get('handle') or '')[:200],
        'name': str(attrs.get('name') or attrs.get('handle') or '')[:200],
        'member_count': member_count,
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

    # 3) Campaigns + structured scopes (program-scoped, numeric id).
    campaigns_created = campaigns_updated = 0
    scopes_updated = 0
    for program in programs_by_handle.values():
        if not program.external_id:
            continue
        for resource in client.get_campaigns(program.external_id):
            data = _map_campaign(resource, program, owner)
            _, created = BugBountyCampaign.objects.update_or_create(
                campaign_id=data['campaign_id'],
                defaults=data,
            )
            if created:
                campaigns_created += 1
            else:
                campaigns_updated += 1

        identifiers = []
        for scope in client.get_structured_scopes(program.external_id):
            ident = _get_attr(scope, 'asset_identifier') or _get_attr(scope, 'identifier') or ''
            if ident:
                identifiers.append(str(ident)[:300])
        if identifiers:
            merged = list(dict.fromkeys([*(program.in_scope or []), *identifiers]))
            if merged != (program.in_scope or []):
                program.in_scope = merged
                program.save(update_fields=['in_scope'])
                scopes_updated += 1

    # 4) Organizations, members, and assets (organization-scoped).
    organizations_created = organizations_updated = 0
    assets_created = assets_updated = 0
    organizations = []
    try:
        organizations = client.get_organizations()
    except HackerOneClientError as exc:
        logger.warning("HackerOne organization fetch failed: %s", exc)

    for org in organizations:
        org_id = str(org.get('id', ''))
        if not org_id:
            continue
        member_count = 0
        try:
            member_count = len(client.get_org_members(org_id))
        except HackerOneClientError as exc:
            logger.warning("HackerOne member fetch failed for org %s: %s", org_id, exc)

        data = _map_org(org, owner, member_count)
        _, created = BugBountyOrg.objects.update_or_create(
            org_id=data['org_id'],
            defaults=data,
        )
        if created:
            organizations_created += 1
        else:
            organizations_updated += 1

        for resource in client.get_assets(org_id):
            asset_data = _map_asset(resource, owner)
            _, asset_created = BugBountyAsset.objects.update_or_create(
                asset_id=asset_data['asset_id'],
                defaults=asset_data,
            )
            if asset_created:
                assets_created += 1
            else:
                assets_updated += 1

    return {
        'programs_created': programs_created,
        'programs_updated': programs_updated,
        'reports_created': reports_created,
        'reports_updated': reports_updated,
        'reports_skipped': reports_skipped,
        'campaigns_created': campaigns_created,
        'campaigns_updated': campaigns_updated,
        'scopes_updated': scopes_updated,
        'organizations_created': organizations_created,
        'organizations_updated': organizations_updated,
        'assets_created': assets_created,
        'assets_updated': assets_updated,
    }
