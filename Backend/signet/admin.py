from django.contrib import admin
from .models import (
    SignetAccount, SignetNarrative, SignetHashtag, SignetEdge,
    SignetActivity, SignetReviewItem,
    CollectionSession, IngestionRecord, CollectedPost,
    PostClassification,
)

@admin.register(SignetAccount)
class SignetAccountAdmin(admin.ModelAdmin):
    list_display = ['handle', 'platform', 'tier', 'confidence', 'followers', 'is_muted']
    list_filter = ['tier', 'platform', 'is_muted']
    search_fields = ['handle']

@admin.register(SignetNarrative)
class SignetNarrativeAdmin(admin.ModelAdmin):
    list_display = ['label', 'status', 'confidence', 'reach']
    list_filter = ['status']
    search_fields = ['label']

@admin.register(SignetHashtag)
class SignetHashtagAdmin(admin.ModelAdmin):
    list_display = ['label', 'velocity', 'volume']
    list_filter = ['velocity']
    search_fields = ['label']

@admin.register(SignetEdge)
class SignetEdgeAdmin(admin.ModelAdmin):
    list_display = ['edge_type', 'source_type', 'source_id', 'target_type', 'target_id']
    list_filter = ['edge_type']

@admin.register(SignetActivity)
class SignetActivityAdmin(admin.ModelAdmin):
    list_display = ['text_short', 'is_alert', 'created_at']
    list_filter = ['is_alert']

    def text_short(self, obj):
        return obj.text[:80]

@admin.register(SignetReviewItem)
class SignetReviewItemAdmin(admin.ModelAdmin):
    list_display = ['gate', 'verdict_tag', 'target', 'tier', 'confidence', 'decision']
    list_filter = ['gate', 'tier', 'decision']
    search_fields = ['target', 'verdict_tag']


@admin.register(CollectionSession)
class CollectionSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'platform', 'status', 'started_at', 'created_at']
    list_filter = ['platform', 'status']

@admin.register(IngestionRecord)
class IngestionRecordAdmin(admin.ModelAdmin):
    list_display = ['platform', 'platform_post_id', 'collected_at', 'session_id']
    list_filter = ['platform']
    search_fields = ['platform_post_id']

@admin.register(CollectedPost)
class CollectedPostAdmin(admin.ModelAdmin):
    list_display = ['author_handle', 'platform', 'tagging_status', 'posted_at', 'likes']
    list_filter = ['platform', 'tagging_status']
    search_fields = ['author_handle', 'platform_post_id']


@admin.register(PostClassification)
class PostClassificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'post_author', 'confidence_tier', 'overall_confidence', 'review_status', 'created_at']
    list_filter = ['confidence_tier', 'review_status']
    search_fields = ['post__author_handle']

    def post_author(self, obj):
        return obj.post.author_handle
