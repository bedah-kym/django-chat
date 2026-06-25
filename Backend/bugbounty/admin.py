from django.contrib import admin
from .models import BugBountyProgram, BugBountyReport, BugBountyReportDraft


@admin.register(BugBountyProgram)
class BugBountyProgramAdmin(admin.ModelAdmin):
    list_display = ['name', 'platform', 'asset_count', 'scan_status', 'bounty_range', 'last_scanned_at']
    list_filter = ['platform', 'scan_status']
    search_fields = ['name', 'program_id']


@admin.register(BugBountyReport)
class BugBountyReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'program', 'platform', 'status', 'severity', 'bounty_kes', 'submitted_at']
    list_filter = ['platform', 'status', 'severity']
    search_fields = ['title', 'report_id', 'target']


@admin.register(BugBountyReportDraft)
class BugBountyReportDraftAdmin(admin.ModelAdmin):
    list_display = ['title', 'program', 'severity', 'estimated_bounty', 'created_at']
    list_filter = ['severity']
    search_fields = ['title']
