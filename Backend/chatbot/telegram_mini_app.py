"""
Telegram Mini App — Django view serving the in-Telegram web application.

The Mini App is a lightweight HTML page that uses the Telegram Web App
SDK (window.Telegram.WebApp) to provide a native-feeling experience inside
Telegram. It shows the user's linked account status, provides quick
actions, and sends data back to the bot via WebApp.sendData().
"""
from __future__ import annotations

import json
import logging

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from .models import TelegramUser
from .telegram_link_api import _bot_username

logger = logging.getLogger(__name__)


@csrf_exempt
def telegram_mini_app(request: HttpRequest) -> HttpResponse:
    """
    Serve the Mini App HTML page.

    The page reads initData from the URL (injected by Telegram) and uses
    the Telegram Web App JS SDK for theming, user info, and interactions.
    """
    # Extract initData from query params (Telegram appends this)
    init_data = request.GET.get("tgWebAppData", "")

    # Try to extract chat_id from initData or query params
    chat_id = request.GET.get("chat_id", "")

    context = {
        "init_data": init_data,
        "chat_id": chat_id,
        "bot_username": _bot_username(),
    }

    # If user is authenticated via Django session, include linking info
    if request.user and request.user.is_authenticated:
        try:
            tg_user = TelegramUser.objects.filter(
                user=request.user, is_authenticated=True
            ).first()
            context["linked_tg"] = (
                f"@{tg_user.telegram_username}" if tg_user and tg_user.telegram_username else "Yes"
            )
        except Exception:
            context["linked_tg"] = None
    else:
        # Check if chat_id has a linked TG user
        if chat_id:
            try:
                tg_user = TelegramUser.objects.filter(
                    chat_id=int(chat_id), is_authenticated=True
                ).first()
                if tg_user and tg_user.user:
                    context["linked_user"] = tg_user.user.username
            except (ValueError, Exception):
                pass

    return render(request, "chatbot/mini_app.html", context)
