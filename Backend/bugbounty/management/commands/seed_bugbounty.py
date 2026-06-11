from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from bugbounty.models import BugBountyProgram, BugBountyReport, BugBountyReportDraft

User = get_user_model()

PROGRAMS = [
    {
        'program_id': 'h1-acme',
        'name': 'Acme Public Program',
        'platform': 'HackerOne',
        'asset_count': 18,
        'last_scanned_at': '2026-04-08T04:20:00Z',
        'bounty_range': '$500 - $5,000',
        'in_scope': ['app.acme.io', 'api.acme.io', '*.acme.io'],
        'out_of_scope': ['status.acme.io', 'third-party marketing domains'],
        'reward_notes': 'Critical auth and payment issues qualify for top-tier payouts.',
        'scan_status': 'running',
    },
    {
        'program_id': 'bc-finflow',
        'name': 'FinFlow',
        'platform': 'Bugcrowd',
        'asset_count': 9,
        'last_scanned_at': '2026-04-07T22:30:00Z',
        'bounty_range': '$250 - $3,000',
        'in_scope': ['portal.finflow.app', 'api.finflow.app'],
        'out_of_scope': ['employee.finflow.app'],
        'reward_notes': 'Bonus multipliers for chained authz findings.',
        'scan_status': 'ready',
    },
    {
        'program_id': 'int-kijani',
        'name': 'Kijani Cloud',
        'platform': 'Intigriti',
        'asset_count': 14,
        'last_scanned_at': '2026-04-06T12:10:00Z',
        'bounty_range': 'EUR 200 - EUR 4,000',
        'in_scope': ['console.kijani.cloud', '*.kijani.cloud'],
        'out_of_scope': ['careers.kijani.cloud'],
        'reward_notes': 'Focus on tenant isolation and exposed admin tooling.',
        'scan_status': 'queued',
    },
]

REPORTS = [
    {
        'report_id': 'report-1',
        'program_id': 'h1-acme',
        'title': 'Broken object-level authorization on invoice export',
        'target': 'api.acme.io',
        'bounty_kes': 182000,
        'platform': 'HackerOne',
        'status': 'triaged',
        'submitted_at': '2026-04-01T10:00:00Z',
        'severity': 'high',
    },
    {
        'report_id': 'report-2',
        'program_id': 'bc-finflow',
        'title': 'Stored XSS in support macro templates',
        'target': 'portal.finflow.app',
        'bounty_kes': 96000,
        'platform': 'Bugcrowd',
        'status': 'paid',
        'submitted_at': '2026-03-25T08:30:00Z',
        'severity': 'medium',
    },
    {
        'report_id': 'report-3',
        'program_id': 'int-kijani',
        'title': 'Leaked internal GraphQL schema...',
        'target': 'console.kijani.cloud',
        'bounty_kes': 0,
        'platform': 'Intigriti',
        'status': 'draft',
        'submitted_at': '2026-04-08T06:15:00Z',
        'severity': 'medium',
    },
]

DRAFTS = [
    {
        'program_id': 'h1-acme',
        'title': 'WebSocket connection hijacking via missing origin check',
        'severity': 'high',
        'platform_program': 'HackerOne: Acme Public Program',
        'steps': '1. Connect to wss://app.acme.io/ws\n2. Send without Origin header tracking\n3. Server does not validate',
        'impact': 'Attacker can replay sessions across origins',
        'evidence_name': 'ws-hijack-poc.txt',
        'estimated_bounty': '$1,200',
    },
]


class Command(BaseCommand):
    help = 'Seed bug bounty programs, reports, and drafts'

    def handle(self, *args, **kwargs):
        user = User.objects.first()
        if not user:
            self.stderr.write('No users found. Create a user first.')
            return

        BugBountyProgram.objects.filter(user=user).delete()
        BugBountyReport.objects.filter(user=user).delete()
        BugBountyReportDraft.objects.filter(user=user).delete()

        programs = {}
        for p in PROGRAMS:
            programs[p['program_id']] = BugBountyProgram.objects.create(
                user=user,
                program_id=p['program_id'],
                name=p['name'],
                platform=p['platform'],
                asset_count=p['asset_count'],
                last_scanned_at=p['last_scanned_at'],
                bounty_range=p['bounty_range'],
                in_scope=p['in_scope'],
                out_of_scope=p['out_of_scope'],
                reward_notes=p['reward_notes'],
                scan_status=p['scan_status'],
            )

        for r in REPORTS:
            program = programs.get(r['program_id'])
            if program:
                BugBountyReport.objects.create(
                    user=user,
                    program=program,
                    report_id=r['report_id'],
                    title=r['title'],
                    target=r['target'],
                    bounty_kes=r['bounty_kes'],
                    platform=r['platform'],
                    status=r['status'],
                    submitted_at=r['submitted_at'],
                    severity=r['severity'],
                )

        for d in DRAFTS:
            program = programs.get(d['program_id'])
            if program:
                BugBountyReportDraft.objects.create(
                    user=user,
                    program=program,
                    title=d['title'],
                    severity=d['severity'],
                    platform_program=d['platform_program'],
                    steps=d['steps'],
                    impact=d['impact'],
                    evidence_name=d['evidence_name'],
                    estimated_bounty=d['estimated_bounty'],
                )

        self.stdout.write(self.style.SUCCESS(
            f'Seeded: {len(PROGRAMS)} programs, {len(REPORTS)} reports, {len(DRAFTS)} drafts'
        ))
