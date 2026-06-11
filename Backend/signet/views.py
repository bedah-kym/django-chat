from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import SignetAccount, SignetNarrative, SignetHashtag, SignetEdge, SignetActivity, SignetReviewItem
from .serializers import (
    SignetAccountSerializer, SignetNarrativeSerializer, SignetHashtagSerializer,
    SignetEdgeSerializer, SignetActivitySerializer, SignetReviewItemSerializer,
)


class NoPagination:
    def paginate_queryset(self, queryset, request, view=None):
        return None

    def get_paginated_response(self, data):
        return Response(data)


class AccountList(generics.ListAPIView):
    serializer_class = SignetAccountSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetAccount.objects.filter(user=self.request.user)


class NarrativeList(generics.ListAPIView):
    serializer_class = SignetNarrativeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetNarrative.objects.filter(user=self.request.user)


class HashtagList(generics.ListAPIView):
    serializer_class = SignetHashtagSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetHashtag.objects.filter(user=self.request.user)


class EdgeList(generics.ListAPIView):
    serializer_class = SignetEdgeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetEdge.objects.filter(user=self.request.user)


class ActivityList(generics.ListAPIView):
    serializer_class = SignetActivitySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetActivity.objects.filter(user=self.request.user)[:20]


class ReviewItemList(generics.ListAPIView):
    serializer_class = SignetReviewItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return SignetReviewItem.objects.filter(user=self.request.user)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decide_review(request, pk):
    decision = request.data.get('decision')
    if decision not in ('approved', 'rejected', 'amended'):
        return Response({'error': 'Invalid decision'}, status=status.HTTP_400_BAD_REQUEST)

    item = SignetReviewItem.objects.get(pk=pk, user=request.user)
    item.decision = decision
    item.save()
    return Response({'status': 'ok', 'decision': decision})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mute_account(request, pk):
    account = SignetAccount.objects.get(pk=pk, user=request.user)
    account.is_muted = not account.is_muted
    account.save()
    return Response({'status': 'ok', 'is_muted': account.is_muted})
