from rest_framework import serializers
from .models import SignetAccount, SignetNarrative, SignetHashtag, SignetEdge, SignetActivity, SignetReviewItem


class SignetAccountSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()

    class Meta:
        model = SignetAccount
        fields = ['id', 'type', 'handle', 'platform', 'tier', 'followers', 'posts',
                   'confidence', 'tags', 'is_muted', 'last_scanned_at']

    def get_type(self, obj):
        return 'account'


class SignetNarrativeSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()

    class Meta:
        model = SignetNarrative
        fields = ['id', 'type', 'label', 'tags', 'reach', 'confidence', 'status', 'themes', 'entities']

    def get_type(self, obj):
        return 'narrative'


class SignetHashtagSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()

    class Meta:
        model = SignetHashtag
        fields = ['id', 'type', 'label', 'volume', 'velocity', 'tags']

    def get_type(self, obj):
        return 'hashtag'


class SignetEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SignetEdge
        fields = '__all__'


class SignetActivitySerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    alert = serializers.BooleanField(source='is_alert')

    class Meta:
        model = SignetActivity
        fields = ['id', 'time', 'alert', 'text']

    def get_time(self, obj):
        return obj.created_at.strftime('%H:%M')


class SignetReviewItemSerializer(serializers.ModelSerializer):
    flagged_at = serializers.SerializerMethodField()
    subtags = serializers.SerializerMethodField()
    context = serializers.SerializerMethodField()

    class Meta:
        model = SignetReviewItem
        fields = ['id', 'gate', 'verdict_tag', 'target', 'confidence', 'tier',
                   'excerpt', 'reason', 'flagged_at', 'model_name', 'decision',
                   'subtags', 'context']

    def get_flagged_at(self, obj):
        return obj.created_at.strftime('%H:%M')

    def _classification(self, obj):
        # The classification that produced this review carries the full evidence.
        return obj.classifications.order_by('-created_at').first()

    def get_subtags(self, obj):
        """Every tag the tagger applied — each with its own grounding excerpt and
        confidence. Lets a reviewer judge the tagger's *reasoning* (why it fired
        each tag) instead of accepting/rejecting a bare top-line verdict on a hunch."""
        c = self._classification(obj)
        if not c:
            return []
        return [
            {
                'tag': t.get('tag', ''),
                'confidence': t.get('confidence', 0),
                'excerpt': t.get('excerpt', ''),
            }
            for t in (c.tags or [])
        ]

    def get_context(self, obj):
        """The tagger's read of what the post is substantively about — neutral
        context so the reviewer sees the post the way the tagger did."""
        c = self._classification(obj)
        if not c:
            return {}
        return {
            'themes': c.themes or [],
            'entities': c.entities or [],
            'summary': c.summary or '',
            'novelty_note': c.novelty_note or '',
            'safety_category': c.safety_category or 'none',
        }
