from django.apps import AppConfig
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class OrchestrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'orchestration'

    def ready(self):
        # Phase 2 of v0.4 OSS port: invoke the connector registry at
        # startup so any new-style BaseConnector subclasses (with class-level
        # `name` + `actions` attrs) and pip-installed `kazi.connectors`
        # entry points are registered into the action catalog before
        # MCPRouter validates its mappings. Master's existing connectors
        # don't yet declare class-level attrs so this is a no-op for them;
        # legacy hardcoded connectors continue to load via _load_legacy_connectors
        # inside discover_connectors().
        try:
            from orchestration.connector_registry import discover_connectors
            discover_connectors()
        except Exception as exc:
            logger.warning("Connector registry discovery failed: %s", exc)

        if not getattr(settings, "ORCHESTRATION_STRICT_STARTUP_CHECKS", True):
            return
        try:
            from orchestration.mcp_router import get_mcp_router

            get_mcp_router()
        except Exception as exc:
            logger.error("Orchestration startup integrity check failed: %s", exc)
            raise
