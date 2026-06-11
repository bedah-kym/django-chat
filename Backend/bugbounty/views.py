from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import BugBountyProgram, BugBountyReport, BugBountyReportDraft
from .serializers import (
    BugBountyProgramSerializer, BugBountyReportSerializer, BugBountyReportDraftSerializer,
)


class NoPagination:
    def paginate_queryset(self, queryset, request, view=None):
        return None

    def get_paginated_response(self, data):
        return Response(data)


class ProgramList(generics.ListAPIView):
    serializer_class = BugBountyProgramSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyProgram.objects.filter(user=self.request.user)


class ReportList(generics.ListAPIView):
    serializer_class = BugBountyReportSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyReport.objects.filter(user=self.request.user)


class DraftList(generics.ListAPIView):
    serializer_class = BugBountyReportDraftSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return BugBountyReportDraft.objects.filter(user=self.request.user)
