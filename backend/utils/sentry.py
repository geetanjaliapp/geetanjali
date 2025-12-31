"""Sentry error tracking and performance monitoring initialization.

This module provides centralized Sentry configuration for:
- FastAPI web application (main.py)
- RQ background worker (worker.py)

Sentry is only initialized when SENTRY_DSN is configured.
"""

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

# Track initialization state
_sentry_initialized = False


def init_sentry(service_name: str = "backend") -> bool:
    """Initialize Sentry SDK for error tracking and performance monitoring.

    Args:
        service_name: Identifier for this service (e.g., "backend", "worker")

    Returns:
        True if Sentry was initialized, False if skipped (no DSN configured)
    """
    global _sentry_initialized

    if _sentry_initialized:
        logger.debug("Sentry already initialized")
        return True

    if not settings.SENTRY_DSN:
        logger.info("Sentry disabled (SENTRY_DSN not configured)")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.rq import RqIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.APP_ENV,
            release=f"geetanjali-{service_name}@{settings.APP_VERSION}",
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            # Integrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(
                    level=logging.INFO,  # Capture INFO and above as breadcrumbs
                    event_level=logging.ERROR,  # Send ERROR and above as events
                ),
                RqIntegration(),
            ],
            # PII filtering
            before_send=_filter_event,
            # Performance: don't send transactions for health checks
            traces_sampler=_traces_sampler,
            # Don't send PII by default
            send_default_pii=False,
            # Attach stack traces to log messages
            attach_stacktrace=True,
            # Server name for distinguishing instances
            server_name=f"geetanjali-{service_name}",
            # Keep HTTP connections alive to prevent SSL errors on stale connections
            # See: https://github.com/getsentry/sentry-python/issues/1198
            keep_alive=True,
        )

        _sentry_initialized = True
        logger.info(
            f"Sentry initialized for {service_name} "
            f"(env={settings.APP_ENV}, traces={settings.SENTRY_TRACES_SAMPLE_RATE})"
        )
        return True

    except Exception as e:
        logger.warning(f"Failed to initialize Sentry: {e}")
        return False


def _filter_event(event: Any, _hint: dict[str, Any]) -> Any:
    """Filter sensitive data from Sentry events before sending.

    This is the before_send hook that runs on every event.
    Return None to drop the event entirely.
    """
    # Filter out rate limit errors (expected behavior, not bugs)
    if "exception" in event:
        for exc_info in event.get("exception", {}).get("values", []):
            exc_type = exc_info.get("type", "")
            if exc_type in ("RateLimitExceeded", "TooManyRequestsError"):
                return None

    # Remove PII from user context
    if "user" in event:
        user = event["user"]
        # Keep user ID for correlation, remove PII
        event["user"] = {"id": user.get("id")}

    # Scrub sensitive data from request
    if "request" in event:
        request = event["request"]
        # Remove cookies (contain auth tokens)
        if "cookies" in request:
            request["cookies"] = "[Filtered]"
        # Remove authorization header
        if "headers" in request:
            headers = request["headers"]
            if "Authorization" in headers:
                headers["Authorization"] = "[Filtered]"
            if "Cookie" in headers:
                headers["Cookie"] = "[Filtered]"
            if "X-CSRF-Token" in headers:
                headers["X-CSRF-Token"] = "[Filtered]"
        # Scrub sensitive fields from request body (PII protection)
        if "data" in request and isinstance(request["data"], dict):
            body = request["data"]
            sensitive_body_keys = [
                "password",
                "new_password",
                "current_password",
                "email",
                "phone",
                "address",
                "ssn",
                "credit_card",
                "token",
                "secret",
                "api_key",
                "situation",  # situation may contain personal details
            ]
            for key in list(body.keys()):
                if any(s in key.lower() for s in sensitive_body_keys):
                    body[key] = "[Filtered]"

    # Scrub sensitive data from extra context
    if "extra" in event:
        extra = event["extra"]
        sensitive_keys = ["password", "token", "secret", "api_key", "email"]
        for key in list(extra.keys()):
            if any(s in key.lower() for s in sensitive_keys):
                extra[key] = "[Filtered]"

    return event


def _traces_sampler(sampling_context: dict[str, Any]) -> float:
    """Custom sampler to avoid tracing health checks and static assets."""
    # Get transaction name from context
    transaction_context = sampling_context.get("transaction_context", {})
    name = transaction_context.get("name", "")

    # Don't trace health check endpoints
    if "/health" in name or "/ready" in name or "/live" in name:
        return 0.0

    # Don't trace static asset requests
    if name.startswith("/static") or name.endswith((".js", ".css", ".ico")):
        return 0.0

    # Use configured sample rate for everything else
    return settings.SENTRY_TRACES_SAMPLE_RATE


def capture_exception(error: Exception, **context: Any) -> None:
    """Capture an exception to Sentry with optional context.

    Safe to call even if Sentry is not initialized - will log instead.

    Args:
        error: The exception to capture
        **context: Additional context to attach to the event
    """
    if not _sentry_initialized:
        logger.error(f"Exception (Sentry disabled): {error}", exc_info=error)
        return

    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_exception(error)
    except Exception as e:
        logger.error(f"Failed to capture exception to Sentry: {e}")
        logger.error(f"Original exception: {error}", exc_info=error)


def set_user(user_id: str) -> None:
    """Set the current user for Sentry context.

    Only sets user ID (no PII).

    Args:
        user_id: The user's unique identifier
    """
    if not _sentry_initialized:
        return

    try:
        import sentry_sdk

        sentry_sdk.set_user({"id": user_id})
    except Exception:
        pass  # Silent fail - non-critical


def add_breadcrumb(message: str, category: str = "custom", level: str = "info") -> None:
    """Add a breadcrumb for debugging context.

    Args:
        message: Description of the action
        category: Category for grouping (e.g., "auth", "db", "llm")
        level: Severity level (debug, info, warning, error)
    """
    if not _sentry_initialized:
        return

    try:
        import sentry_sdk

        sentry_sdk.add_breadcrumb(
            message=message,
            category=category,
            level=level,
        )
    except Exception:
        pass  # Silent fail - non-critical
