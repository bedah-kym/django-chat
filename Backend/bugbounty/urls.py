from django.urls import path
from . import views

app_name = 'bugbounty'

urlpatterns = [
    path('programs/', views.ProgramList.as_view(), name='program_list'),
    path('reports/', views.ReportList.as_view(), name='report_list'),
    path('drafts/', views.DraftList.as_view(), name='draft_list'),
]
