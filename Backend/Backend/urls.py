"""Backend URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import os

from django.contrib import admin
from django.http import Http404, HttpResponse
from django.shortcuts import redirect
from django.urls import path, re_path, include
from django.views.decorators.cache import never_cache
from rest_framework.urlpatterns import format_suffix_patterns
from rest_framework.authtoken.views import obtain_auth_token
from django.conf import settings
from django.conf.urls.static import static

from chatbot.views import upload_file

@never_cache
def spa_index(_request):
    """Serve the React SPA shell for any /app/* deep link.

    Without this, a refresh of /app/home (or any client-side route) hits
    Django before React mounts and returns 404. Tries the prod-collected
    static path first, then the local Vite build dir as a fallback for dev.
    """
    candidates = [
        os.path.join(settings.STATIC_ROOT or '', 'spa', 'index.html'),
        os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'index.html'),
    ]
    for path_ in candidates:
        if path_ and os.path.exists(path_):
            with open(path_, encoding='utf-8') as f:
                return HttpResponse(f.read())
    raise Http404("SPA index not built; run `cd frontend && npm run build` (or use the Vite dev server in development)")


urlpatterns = [
    path('', lambda _request: redirect('/app/home'), name='landing'),
    path('admin/', admin.site.urls),
    path('chatbot/', include('chatbot.urls')),
    path('accounts/', include('users.urls')),
    path('accounts/', include('allauth.urls')),  # Social Auth URLs
    path('api/', include('Api.urls')),
    path('api/workflows/', include('workflows.urls')),
    path('travel/', include('travel.urls')),  # Travel Planning UI
    path('payments/', include('payments.urls')),  # Payment System
    path('notifications/', include('notifications.urls')),
    path('api/signet/', include('signet.urls')),
    path('api/bugbounty/', include('bugbounty.urls')),
    path('api/pentest/', include('pentest.urls')),
    path('auth/', obtain_auth_token),
    path('api-auth/', include('rest_framework.urls')),
    path('uploads/', upload_file, name='upload_file'),
    re_path(r'^app(?:/.*)?$', spa_index, name='spa_index'),
]
urlpatterns = format_suffix_patterns(urlpatterns)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
