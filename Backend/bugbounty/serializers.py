from rest_framework import serializers
from .models import BugBountyProgram, BugBountyReport, BugBountyReportDraft


class BugBountyProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyProgram
        fields = '__all__'


class BugBountyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyReport
        fields = '__all__'


class BugBountyReportDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugBountyReportDraft
        fields = '__all__'
