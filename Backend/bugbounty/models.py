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
