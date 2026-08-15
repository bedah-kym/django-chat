from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class BugBountyProgram(models.Model):
    PLATFORM_CHOICES = [
        ('HackerOne', 'HackerOne'),
        ('Bugcrowd', 'Bugcrowd'),
        ('Intigriti', 'Intigriti'),
    ]
    SCAN_STATUS_CHOICES = [
        ('ready', 'Ready'),
        ('queued', 'Queued'),
        ('running', 'Running'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bugbounty_programs')
    program_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    asset_count = models.IntegerField(default=0)
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    bounty_range = models.CharField(max_length=100, default='')
    in_scope = models.JSONField(default=list)
    out_of_scope = models.JSONField(default=list)
    reward_notes = models.TextField(default='')
    scan_status = models.CharField(max_length=20, choices=SCAN_STATUS_CHOICES, default='ready')
    created_at = models.DateTimeField(auto_now_add=True)
    # HackerOne sync metadata
    external_id = models.CharField(max_length=100, blank=True, default='')
    source_handle = models.CharField(max_length=200, blank=True, default='')
    synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class BugBountyReport(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('triaged', 'Triaged'),
        ('duplicate', 'Duplicate'),
        ('resolved', 'Resolved'),
        ('paid', 'Paid'),
    ]
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    PLATFORM_CHOICES = [
        ('HackerOne', 'HackerOne'),
        ('Bugcrowd', 'Bugcrowd'),
        ('Intigriti', 'Intigriti'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bugbounty_reports')
    program = models.ForeignKey(BugBountyProgram, on_delete=models.CASCADE, related_name='reports')
    report_id = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=300)
    target = models.CharField(max_length=300)
    bounty_kes = models.IntegerField(default=0)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    created_at = models.DateTimeField(auto_now_add=True)
    # HackerOne sync metadata
    external_id = models.CharField(max_length=100, blank=True, default='')
    source_url = models.CharField(max_length=500, blank=True, default='')
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return self.title


class BugBountyReportDraft(models.Model):
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bugbounty_drafts')
    program = models.ForeignKey(BugBountyProgram, on_delete=models.CASCADE, related_name='drafts')
    title = models.CharField(max_length=300)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    platform_program = models.CharField(max_length=200)
    steps = models.TextField()
    impact = models.TextField()
    evidence_name = models.CharField(max_length=200, default='')
    estimated_bounty = models.CharField(max_length=100, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class BugBountyWebhookEvent(models.Model):
    """Received HackerOne webhook delivery (idempotency + audit)."""

    delivery_id = models.CharField(max_length=64, unique=True)
    event_type = models.CharField(max_length=100)
    signature_valid = models.BooleanField(default=False)
    payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False)
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} ({self.delivery_id})"


class BugBountyCampaign(models.Model):
    """A HackerOne bounty campaign (bounty multiplier incentive on scoped assets)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bugbounty_campaigns')
    program = models.ForeignKey(BugBountyProgram, on_delete=models.CASCADE, related_name='campaigns')
    campaign_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=300, blank=True, default='')
    multiplier = models.CharField(max_length=50, blank=True, default='')
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, blank=True, default='')
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-starts_at']

    def __str__(self):
        return self.name or self.campaign_id


class BugBountyAsset(models.Model):
    """A HackerOne asset (organization-level scope item)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bugbounty_assets')
    asset_id = models.CharField(max_length=100, unique=True)
    asset_type = models.CharField(max_length=50, blank=True, default='')
    identifier = models.CharField(max_length=500, blank=True, default='')
    state = models.CharField(max_length=30, blank=True, default='')
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['asset_type', 'identifier']

    def __str__(self):
        return self.identifier or self.asset_id


class BugBountyOrg(models.Model):
    """A HackerOne organization the integration token belongs to."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bugbounty_orgs')
    org_id = models.CharField(max_length=100, unique=True)
    handle = models.CharField(max_length=200, blank=True, default='')
    name = models.CharField(max_length=200, blank=True, default='')
    member_count = models.IntegerField(default=0)
    raw_payload = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['handle']

    def __str__(self):
        return self.handle or self.org_id
