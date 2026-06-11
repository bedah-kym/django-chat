from django.contrib import admin
from .models import SignetAccount, SignetNarrative, SignetHashtag, SignetEdge, SignetActivity, SignetReviewItem

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
