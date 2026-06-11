from django.urls import path
from . import views

app_name = 'signet'

urlpatterns = [
    path('accounts/', views.AccountList.as_view(), name='account_list'),
    path('narratives/', views.NarrativeList.as_view(), name='narrative_list'),
    path('hashtags/', views.HashtagList.as_view(), name='hashtag_list'),
    path('edges/', views.EdgeList.as_view(), name='edge_list'),
    path('activity/', views.ActivityList.as_view(), name='activity_list'),
    path('reviews/', views.ReviewItemList.as_view(), name='review_list'),
    path('reviews/<int:pk>/decide/', views.decide_review, name='decide_review'),
    path('accounts/<int:pk>/mute/', views.mute_account, name='mute_account'),
]
