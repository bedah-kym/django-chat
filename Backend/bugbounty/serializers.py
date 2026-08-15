from rest_framework import serializers
from .models import (
    BugBountyProgram, BugBountyReport, BugBountyReportDraft,
    BugBountyCampaign, BugBountyAsset, BugBountyOrg,
)


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


class BugBountyCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyCampaign
        fields = '__all__'
        read_only_fields = ['raw_payload', 'synced_at']


class BugBountyAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyAsset
        fields = '__all__'
        read_only_fields = ['raw_payload', 'synced_at']


class BugBountyOrgSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyOrg
        fields = '__all__'
        read_only_fields = ['raw_payload', 'synced_at']
