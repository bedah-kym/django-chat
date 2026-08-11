from django.urls import path
from . import views

app_name = "botApi"
urlpatterns = [
    path('user/me/', views.get_current_user, name='user_me'),
    path('rooms/list/', views.list_rooms, name='rooms_list'),
    path('rooms/create/', views.create_room, name='create_room'),
    path('getreplies/<int:room>/', views.GetMessage.as_view(), name="get_replies"),
    path('getmessages/<int:room>/', views.GetAllMessages.as_view(), name="get_messages"),
    path('newreply/', views.CreateReply.as_view(), name="new_replies"),

    # Calendly integration endpoints
    path('calendly/connect/', views.calendly_connect, name='calendly_connect'),
    path('calendly/callback/', views.calendly_callback, name='calendly_callback'),
    path('calendly/user/status/', views.calendly_status, name='calendly_status'),
    path('calendly/user/events/', views.calendly_events, name='calendly_events'),
    path('calendly/webhook/', views.calendly_webhook, name='calendly_webhook'),
    path('calendly/user/<int:user_id>/booking-link/', views.calendly_user_booking_link, name='calendly_user_booking_link'),
    path('calendly/user/username/<str:username>/booking-link/', views.calendly_user_booking_link_by_username, name='calendly_user_booking_link_by_username'),
    path('calendly/disconnect/', views.calendly_disconnect, name='calendly_disconnect'),
    path('calendly/event-types/', views.calendly_event_types, name='calendly_event_types'),
    path('calendly/set-event-type/', views.calendly_set_event_type, name='calendly_set_event_type'),

    # Gmail integration endpoints
    path('gmail/connect/', views.gmail_connect, name='gmail_connect'),
    path('gmail/callback/', views.gmail_callback, name='gmail_callback'),

    # Quota endpoints
    path('user/quotas/', views.get_user_quotas, name='user_quotas'),
    path('user/quotas/reset/', views.reset_own_quotas, name='reset_quotas'),

]
