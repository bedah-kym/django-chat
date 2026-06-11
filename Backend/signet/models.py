from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class SignetAccount(models.Model):
    TIER_CHOICES = [
        ('macro', 'Macro'),
        ('mid', 'Mid'),
        ('micro', 'Micro'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_accounts')
    handle = models.CharField(max_length=100, unique=True)
    platform = models.CharField(max_length=20, default='x')
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default='micro')
    followers = models.IntegerField(default=0)
    posts = models.IntegerField(default=0)
    confidence = models.FloatField(default=0.0)
    tags = models.JSONField(default=list, blank=True)
    is_muted = models.BooleanField(default=False)
    last_scanned_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-confidence']

    def __str__(self):
        return self.handle


class SignetNarrative(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('decaying', 'Decaying'),
        ('resolved', 'Resolved'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_narratives')
    label = models.CharField(max_length=200)
    tags = models.JSONField(default=list, blank=True)
    reach = models.IntegerField(default=0)
    confidence = models.FloatField(default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reach']

    def __str__(self):
        return self.label


class SignetHashtag(models.Model):
    VELOCITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('peak', 'Peak'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_hashtags')
    label = models.CharField(max_length=100, unique=True)
    volume = models.IntegerField(default=0)
    velocity = models.CharField(max_length=10, choices=VELOCITY_CHOICES, default='low')
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-volume']

    def __str__(self):
        return self.label


class SignetEdge(models.Model):
    EDGE_TYPES = [
        ('SEEDS', 'Seeds'),
        ('AMPLIFIES', 'Amplifies'),
        ('TAGGED_WITH', 'Tagged With'),
        ('SPREADS_VIA', 'Spreads Via'),
        ('PART_OF_NETWORK', 'Part of Network'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_edges')
    source_type = models.CharField(max_length=20)  # 'account', 'narrative', 'hashtag'
    source_id = models.IntegerField()
    target_type = models.CharField(max_length=20)
    target_id = models.IntegerField()
    edge_type = models.CharField(max_length=30, choices=EDGE_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.source_type}:{self.source_id} --{self.edge_type}--> {self.target_type}:{self.target_id}'


class SignetActivity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_activities')
    text = models.TextField()
    is_alert = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Signet activities'

    def __str__(self):
        return self.text[:80]


class SignetReviewItem(models.Model):
    GATE_CHOICES = [
        ('GATE 1', 'Gate 1 — Routine'),
        ('GATE 2', 'Gate 2 — Sensitive'),
    ]
    TIER_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    DECISION_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('amended', 'Amended'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_reviews')
    gate = models.CharField(max_length=10, choices=GATE_CHOICES, default='GATE 1')
    verdict_tag = models.CharField(max_length=100)
    target = models.CharField(max_length=100)
    confidence = models.FloatField(default=0.0)
    tier = models.CharField(max_length=10, choices=TIER_CHOICES)
    excerpt = models.TextField()
    reason = models.TextField()
    model_name = models.CharField(max_length=100, default='claude-sonnet/post_tagger_1.2')
    decision = models.CharField(max_length=10, choices=DECISION_CHOICES, default='pending')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.gate}: {self.verdict_tag} on {self.target}'
