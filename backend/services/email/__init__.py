"""
Email service package.

Provides email functionality via Resend with resilience features.

Usage:
    from services.email import send_alert_email, send_contact_email

    # Send email
    success = send_alert_email("subject", "message")
"""

# Exceptions
from .exceptions import (
    EmailCircuitOpenError,
    EmailConfigurationError,
    EmailError,
    EmailSendError,
    EmailServiceUnavailable,
)

# Resilience (circuit breaker, retry decorator)
from .resilience import (
    EmailCircuitBreaker,
    get_circuit_breaker,
    with_email_retry,
)

# Private module-level state (for admin health endpoints)
from .resilience import _email_circuit_breaker

# Send functions
from .service import (
    send_account_deleted_email,
    send_account_verification_email,
    send_alert_email,
    send_contact_email,
    send_newsletter_digest_email,
    send_newsletter_verification_email,
    send_newsletter_welcome_email,
    send_password_changed_email,
    send_password_reset_email,
)

# Private items (re-exported for test mocking compatibility)
from .service import _get_resend, _get_resend_or_raise, _resend_client

# Re-export settings for test mocking compatibility
from config import settings

__all__ = [
    # Exceptions
    "EmailError",
    "EmailConfigurationError",
    "EmailServiceUnavailable",
    "EmailSendError",
    "EmailCircuitOpenError",
    # Resilience
    "EmailCircuitBreaker",
    "get_circuit_breaker",
    "with_email_retry",
    # Send functions
    "send_alert_email",
    "send_contact_email",
    "send_password_reset_email",
    "send_newsletter_verification_email",
    "send_newsletter_welcome_email",
    "send_newsletter_digest_email",
    "send_account_verification_email",
    "send_password_changed_email",
    "send_account_deleted_email",
]
