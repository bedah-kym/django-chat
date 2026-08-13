from rest_framework import serializers
from .models import BugBountyProgram, BugBountyReport, BugBountyReportDraft


class BugBountyProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyProgram
        fields = '__all__'
        read_only_fields = ['external_id', 'source_handle', 'synced_at']


class BugBountyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyReport
        fields = '__all__'
        read_only_fields = ['external_id', 'source_url', 'raw_payload', 'synced_at']


class BugBountyReportDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyReportDraft
        fields = '__all__'
