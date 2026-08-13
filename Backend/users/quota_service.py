import logging
from datetime import datetime, timedelta
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from chatbot.models import DocumentUpload

logger = logging.getLogger(__name__)


class QuotaService:
    """
    Service to report user usage quotas for rate-limited features.
    Limits are plan-aware: free < trial < pro < agency.
    """

    # Base limits (free tier) — others scale up
    BASE_LIMITS = {
        'search': 10,       # per day
        'actions': 100,     # per hour
        'messages': 30,     # per minute
        'uploads': 10       # per 10 hours (approx)
    }

    # Multipliers per plan
    PLAN_MULTIPLIERS = {
        'free': 1.0,
        'trial': 2.0,
        'pro': 5.0,
        'agency': 50.0,
    }

    def _get_plan(self, user_id: int) -> str:
        """Resolve the user's workspace plan."""
        try:
            from users.models import Workspace
            ws = Workspace.objects.filter(user_id=user_id).first()
            return ws.plan if ws else 'free'
        except Exception:
            return 'free'

    def _get_limits(self, user_id: int) -> dict:
        """Return plan-adjusted limits for a user."""
        plan = self._get_plan(user_id)
        multiplier = self.PLAN_MULTIPLIERS.get(plan, 1.0)
        return {
            k: max(1, int(v * multiplier))
            for k, v in self.BASE_LIMITS.items()
        }

    def get_user_quotas(self, user_id: int) -> dict:
        """
        Get current usage and limits for a user (plan-aware).
        """
        limits = self._get_limits(user_id)
        plan = self._get_plan(user_id)

        # 1. Search Limit (Daily)
        today = datetime.now().strftime("%Y-%m-%d")
        search_key = f"search_limit:{user_id}:{today}"
        search_used = int(cache.get(search_key) or 0)

        # 2. MCP Actions Limit (Hourly)
        action_key = f"mcp_rate:{user_id}"
        action_used = int(cache.get(action_key) or 0)

        # 3. Message Rate Limit (Minute)
        current_minute = datetime.now().strftime("%Y-%m-%d-%H-%M")
        msg_key = f"rate_limit:{user_id}:{current_minute}"
        msg_used = int(cache.get(msg_key) or 0)

        # 4. Document Uploads (10-hour window)
        ten_hours_ago = timezone.now() - timedelta(hours=10)
        upload_used = DocumentUpload.objects.filter(
            user_id=user_id,
            uploaded_at__gte=ten_hours_ago
        ).count()

        # 5. LLM Token Quota (hourly, plan-aware, staff exempt)
        token_key = f"llm_tokens:{user_id}"
        token_used = int(cache.get(token_key) or 0)
        token_limit = int(getattr(settings, 'LLM_TOKEN_LIMIT_PER_USER_PER_HOUR', 50000))

        # Staff / superusers are exempt (mirrors llm_client._get_user_token_budget)
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.filter(pk=user_id).only('is_staff', 'is_superuser').first()
            if user and (user.is_staff or user.is_superuser):
                token_limit = 10_000_000
        except Exception:
            pass

        # Plan-aware multiplier
        if token_limit < 1_000_000:
            token_limit = int(token_limit * self.PLAN_MULTIPLIERS.get(plan, 1.0))

        # Calculate Percentages & Status
        def get_status(used, limit):
            if limit == 0:
                return 'good', 'green'
            pct = (used / limit) * 100
            if pct >= 100: return 'exhausted', 'red'
            if pct >= 80: return 'critical', 'orange'
            if pct >= 50: return 'warning', 'yellow'
            return 'good', 'green'

        s_status, s_color = get_status(search_used, limits['search'])
        a_status, a_color = get_status(action_used, limits['actions'])
        m_status, m_color = get_status(msg_used, limits['messages'])
        u_status, u_color = get_status(upload_used, limits['uploads'])
        t_status, t_color = get_status(token_used, token_limit)

        return {
            "plan": plan,
            "search": {
                "name": "Online Searches",
                "used": search_used,
                "limit": limits['search'],
                "unit": "per day",
                "status": s_status,
                "color": s_color,
                "reset": "Midnight"
            },
            "actions": {
                "name": "AI Actions",
                "used": action_used,
                "limit": limits['actions'],
                "unit": "per hour",
                "status": a_status,
                "color": a_color,
                "reset": "Rolling 1 hour"
            },
            "messages": {
                "name": "Chat Messages",
                "used": msg_used,
                "limit": limits['messages'],
                "unit": "per minute",
                "status": m_status,
                "color": m_color,
                "reset": "Rolling 1 min"
            },
            "uploads": {
                "name": "Document Uploads",
                "used": upload_used,
                "limit": limits['uploads'],
                "unit": "per 10 hours",
                "status": u_status,
                "color": u_color,
                "reset": "10h from first"
            },
            "tokens": {
                "name": "LLM Tokens",
                "used": token_used,
                "limit": token_limit,
                "unit": "per hour",
                "status": t_status,
                "color": t_color,
                "reset": "Rolling 1 hour"
            }
        }

    def reset_user_quotas(self, user_id: int) -> dict:
        """
        Admin-only: reset all quota counters for a user.
        Returns the fresh (zeroed) quota state.
        """
        today = datetime.now().strftime("%Y-%m-%d")
        current_minute = datetime.now().strftime("%Y-%m-%d-%H-%M")

        keys_to_delete = [
            f"search_limit:{user_id}:{today}",
            f"mcp_rate:{user_id}",
            f"rate_limit:{user_id}:{current_minute}",
            f"llm_tokens:{user_id}",
        ]
        for key in keys_to_delete:
            cache.delete(key)

        logger.info(f"Quotas reset for user_id={user_id}")
        return self.get_user_quotas(user_id)
