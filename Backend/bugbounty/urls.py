from django.urls import path
from . import views

app_name = 'bugbounty'

urlpatterns = [
    path('programs/', views.ProgramList.as_view(), name='program_list'),
    path('reports/', views.ReportList.as_view(), name='report_list'),
    path('drafts/', views.DraftList.as_view(), name='draft_list'),

    # HackerOne integration
    path('hackerone/status/', views.HackerOneStatusView.as_view(), name='hackerone_status'),
    path('hackerone/sync/', views.HackerOneSyncView.as_view(), name='hackerone_sync'),
    path('hackerone/import/', views.HackerOneImportView.as_view(), name='hackerone_import'),
    path('webhooks/hackerone/', views.hackerone_webhook, name='hackerone_webhook'),
]
