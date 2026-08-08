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
    themes = models.JSONField(null=True, blank=True)
    entities = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reach']
        # One narrative per (user, label) — makes update_or_create atomic and
        # prevents concurrent projections (heartbeat + manual) racing into dupes.
        unique_together = [('user', 'label')]

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


class SignetCoordinationCluster(models.Model):
    """Read-model for coordination graph layer (Chunk 1).

    Mirrors the SignetNarrative upsert pattern: bulk upsert + prune-not-in-window.
    Each row represents one candidate coordinated network of accounts.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('decaying', 'Decaying'),
        ('resolved', 'Resolved'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_coordination_clusters')
    label = models.CharField(max_length=200)
    account_ids = models.JSONField(default=list, blank=True)
    axes = models.JSONField(default=list, blank=True)
    score = models.FloatField(default=0.0)
    size = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-score']
        unique_together = [('user', 'label')]

    def __str__(self):
        return f'{self.label} (score={self.score:.2f}, size={self.size})'


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


# ── Collection Engine ──────────────────────────────────────────────

class CollectionSession(models.Model):
    STATUS_CHOICES = [
        ('idle', 'Idle'),
        ('running', 'Running'),
        ('paused', 'Paused'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_collection_sessions')
    platform = models.CharField(max_length=20, default='reddit')
    config = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='idle')
    started_at = models.DateTimeField(null=True, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.platform} session {self.id} ({self.status})'


class IngestionRecord(models.Model):
    """Immutable raw payload — never update, append-only."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_ingestion_records')
    session = models.ForeignKey(CollectionSession, on_delete=models.CASCADE, related_name='ingestion_records')
    platform = models.CharField(max_length=20)
    platform_post_id = models.CharField(max_length=100)
    raw_payload = models.JSONField()
    collected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('platform', 'platform_post_id')]
        ordering = ['-collected_at']
        indexes = [
            models.Index(fields=['platform', 'platform_post_id']),
            models.Index(fields=['session']),
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise RuntimeError('IngestionRecord is immutable and cannot be updated.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.platform}:{self.platform_post_id}'


class CollectedPost(models.Model):
    """Normalised post — Collection Payload Schema v1.0"""
    TAGGING_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('tagged', 'Tagged'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_collected_posts')
    session = models.ForeignKey(CollectionSession, on_delete=models.CASCADE, related_name='collected_posts')

    platform = models.CharField(max_length=20)
    platform_post_id = models.CharField(max_length=100)
    platform_author_id = models.CharField(max_length=100)
    author_handle = models.CharField(max_length=100)
    content_text = models.TextField()
    posted_at = models.DateTimeField()
    collected_at = models.DateTimeField()

    likes = models.IntegerField(null=True, blank=True)
    shares = models.IntegerField(null=True, blank=True)
    comments = models.IntegerField(null=True, blank=True)
    views = models.IntegerField(null=True, blank=True)
    reach = models.IntegerField(null=True, blank=True)

    hashtags = models.JSONField(default=list, blank=True)
    mentions = models.JSONField(default=list, blank=True)
    urls = models.JSONField(default=list, blank=True)
    media_type = models.CharField(max_length=20, null=True, blank=True)
    language = models.CharField(max_length=10, null=True, blank=True)
    is_reply = models.BooleanField(default=False)
    is_repost = models.BooleanField(default=False)
    parent_post_id = models.CharField(max_length=100, null=True, blank=True)

    collector_version = models.CharField(max_length=20, default='1.0')
    tagging_status = models.CharField(max_length=10, choices=TAGGING_STATUS_CHOICES, default='pending')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('platform', 'platform_post_id')]
        ordering = ['-posted_at']
        indexes = [
            models.Index(fields=['platform', 'platform_post_id']),
            models.Index(fields=['tagging_status']),
            models.Index(fields=['session']),
        ]

    def __str__(self):
        return f'{self.platform}:{self.platform_post_id} by {self.author_handle}'


class PostClassification(models.Model):
    """Immutable, versioned tag classification — append-only."""
    REVIEW_STATUS_CHOICES = [
        ('auto_eligible', 'Auto Eligible'),
        ('pending_review', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('failed', 'Failed'),
    ]

    post = models.ForeignKey(CollectedPost, on_delete=models.CASCADE, related_name='classifications')
    tags = models.JSONField(default=list, blank=True)
    overall_confidence = models.FloatField(default=0.0)
    confidence_tier = models.CharField(max_length=10, default='low')
    prompt_version = models.CharField(max_length=50)
    model_version = models.CharField(max_length=50, default='')
    llm_call_id = models.CharField(max_length=100, blank=True, default='')
    raw_llm_response = models.JSONField(default=dict, blank=True)
    review_status = models.CharField(max_length=20, choices=REVIEW_STATUS_CHOICES, default='pending_review')
    session = models.ForeignKey(CollectionSession, on_delete=models.SET_NULL, null=True, blank=True, related_name='classifications')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='signet_post_classifications')
    signet_review = models.ForeignKey('SignetReviewItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='classifications')
    themes = models.JSONField(null=True, blank=True)
    entities = models.JSONField(null=True, blank=True)
    summary = models.TextField(null=True, blank=True)
    novelty_flag = models.BooleanField(null=True, blank=True)
    novelty_note = models.TextField(null=True, blank=True)
    safety_category = models.CharField(max_length=40, null=True, blank=True)
    safety_excluded = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['post']),
            models.Index(fields=['review_status']),
            models.Index(fields=['confidence_tier']),
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise RuntimeError('PostClassification is immutable. Create a new versioned row instead of updating.')
        # Compute tier if needed
        if self.overall_confidence >= 0.80:
            self.confidence_tier = 'high'
        elif self.overall_confidence >= 0.50:
            self.confidence_tier = 'medium'
        else:
            self.confidence_tier = 'low'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Classification {self.id} on {self.post} ({self.confidence_tier})'
