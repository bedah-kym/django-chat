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
        fields = ['id', 'type', 'label', 'tags', 'reach', 'confidence', 'status']

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

    class Meta:
        model = SignetReviewItem
        fields = ['id', 'gate', 'verdict_tag', 'target', 'confidence', 'tier',
                   'excerpt', 'reason', 'flagged_at', 'model_name', 'decision']

    def get_flagged_at(self, obj):
        return obj.created_at.strftime('%H:%M')
