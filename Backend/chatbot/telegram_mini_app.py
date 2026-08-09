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
    """Serve the Mini App HTML page."""
    context = {
        "init_data": request.GET.get("tgWebAppData", ""),
        "chat_id": request.GET.get("chat_id", ""),
        "bot_username": _bot_username_safe(),
        "linked_user": None,
        "linked_tg": None,
    }

    # Safely query TelegramUser — may not exist if migration hasn't run yet
    chat_id = context["chat_id"]
    try:
        if request.user and request.user.is_authenticated:
            tg_user = TelegramUser.objects.filter(
                user=request.user, is_authenticated=True
            ).first()
            if tg_user:
                context["linked_tg"] = (
                    f"@{tg_user.telegram_username}"
                    if tg_user.telegram_username else "Yes"
                )
        elif chat_id:
            tg_user = TelegramUser.objects.filter(
                chat_id=int(chat_id), is_authenticated=True
            ).first()
            if tg_user and tg_user.user:
                context["linked_user"] = tg_user.user.username
    except Exception as exc:
        logger.warning("Mini App: TelegramUser query failed (migration pending?): %s", exc)

    return render(request, "chatbot/mini_app.html", context)


def _bot_username_safe() -> str:
    """Get bot username without crashing on import errors."""
    try:
        return _bot_username()
    except Exception:
        import os
        from django.conf import settings as ds
        return getattr(ds, "TELEGRAM_BOT_USERNAME", "") or os.environ.get("TELEGRAM_BOT_USERNAME", "MathiaBot")
