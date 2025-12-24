"""Email service using Resend for sending emails."""

import html
import logging
import time
from functools import wraps
from typing import Callable, Optional, TYPE_CHECKING, TypeVar

from config import settings
from utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpen
from utils.metrics import (
    email_sends_total,
    email_send_duration_seconds,
    email_circuit_breaker_state,
)

if TYPE_CHECKING:
    from models import Verse

logger = logging.getLogger(__name__)

# Type variable for generic return type
T = TypeVar("T")


# =============================================================================
# Exception Types
# =============================================================================


class EmailError(Exception):
    """Base exception for email service errors."""

    pass


class EmailConfigurationError(EmailError):
    """
    Email service is not configured properly.

    This is a non-retryable error - configuration must be fixed.
    Examples: Missing API key, missing FROM address.
    """

    pass


class EmailServiceUnavailable(EmailError):
    """
    Email service is unavailable.

    This may be transient (network issue) or permanent (library not installed).
    Caller should check the underlying cause.
    """

    pass


class EmailSendError(EmailError):
    """
    Failed to send email via provider.

    This wraps errors from the email provider (Resend).
    May be transient (rate limit, network) or permanent (invalid recipient).
    """

    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message)
        self.cause = cause


class EmailCircuitOpenError(EmailError):
    """
    Circuit breaker is open - email service temporarily disabled.

    This is raised when too many consecutive failures have occurred.
    The circuit will automatically close after the cooldown period.
    """

    pass


# =============================================================================
# Circuit Breaker (prevents hammering failing service)
# =============================================================================


class EmailCircuitBreaker(CircuitBreaker):
    """
    Circuit breaker for email service resilience.

    Extends the base CircuitBreaker with email-specific Prometheus metrics.

    States:
    - CLOSED: Normal operation, emails sent normally
    - OPEN: Too many failures, emails rejected immediately
    - HALF_OPEN: Testing if service recovered (one request allowed)
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
    ):
        """
        Initialize email circuit breaker.

        Args:
            failure_threshold: Consecutive failures before opening circuit
            recovery_timeout: Seconds to wait before testing recovery
        """
        super().__init__(
            name="email",
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )

    def _update_metric(self, state: str) -> None:
        """Update Prometheus metric for email circuit breaker state."""
        email_circuit_breaker_state.set(self.STATE_VALUES.get(state, 0))


# Global circuit breaker instance
_email_circuit_breaker = EmailCircuitBreaker()


def get_circuit_breaker() -> EmailCircuitBreaker:
    """Get the global email circuit breaker instance."""
    return _email_circuit_breaker


# =============================================================================
# Retry Decorator with Circuit Breaker
# =============================================================================


def with_email_retry(
    max_retries: int = 2,
    base_delay: float = 1.0,
    use_circuit_breaker: bool = True,
) -> Callable[[Callable[..., bool]], Callable[..., bool]]:
    """
    Decorator for email functions with retry and circuit breaker.

    Features:
    - Exponential backoff: delay doubles each retry (1s, 2s, 4s...)
    - Circuit breaker integration: stops retrying when service is down
    - Prometheus metrics for monitoring
    - Logs retry attempts with context

    Args:
        max_retries: Maximum retry attempts (default 2, so 3 total tries)
        base_delay: Initial delay in seconds (default 1.0)
        use_circuit_breaker: Whether to use circuit breaker (default True)

    Returns:
        Decorated function

    Example:
        @with_email_retry(max_retries=2)
        def send_important_email(email: str) -> bool:
            ...
    """

    def decorator(func: Callable[..., bool]) -> Callable[..., bool]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> bool:
            circuit = _email_circuit_breaker if use_circuit_breaker else None
            # Extract email type from function name (e.g., send_password_reset_email -> password_reset)
            email_type = func.__name__.replace("send_", "").replace("_email", "")

            # Check circuit breaker before attempting
            if circuit and not circuit.allow_request():
                logger.warning(
                    f"Email circuit breaker OPEN - skipping {func.__name__}"
                )
                email_sends_total.labels(email_type=email_type, result="circuit_open").inc()
                return False

            last_error: Optional[Exception] = None
            start_time = time.time()

            for attempt in range(max_retries + 1):
                try:
                    result = func(*args, **kwargs)

                    # Record duration for all completed sends (success or config failure)
                    email_send_duration_seconds.labels(email_type=email_type).observe(
                        time.time() - start_time
                    )

                    # Record success if we got True
                    if result:
                        if circuit:
                            circuit.record_success()
                        email_sends_total.labels(email_type=email_type, result="success").inc()
                    else:
                        # Function returned False (e.g., not configured)
                        email_sends_total.labels(email_type=email_type, result="failure").inc()

                    return result

                except (EmailConfigurationError, EmailServiceUnavailable):
                    # Non-retryable errors - don't retry
                    email_sends_total.labels(email_type=email_type, result="failure").inc()
                    raise

                except Exception as e:
                    last_error = e

                    # Record failure for circuit breaker
                    if circuit:
                        circuit.record_failure()

                    # Check if more retries available
                    if attempt < max_retries:
                        delay = base_delay * (2**attempt)  # Exponential backoff
                        logger.warning(
                            f"Email send failed (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {delay:.1f}s: {e}"
                        )
                        time.sleep(delay)

                        # Re-check circuit breaker after delay
                        if circuit and not circuit.allow_request():
                            logger.warning(
                                f"Email circuit breaker opened during retry - aborting"
                            )
                            email_sends_total.labels(email_type=email_type, result="circuit_open").inc()
                            return False
                    else:
                        logger.error(
                            f"Email send failed after {max_retries + 1} attempts: {e}"
                        )
                        email_sends_total.labels(email_type=email_type, result="failure").inc()

            return False

        return wrapper

    return decorator


# Lazy import resend to avoid import errors if not installed
_resend_client: Optional[object] = None
_resend_init_error: Optional[str] = None


def _get_resend():
    """
    Get or initialize Resend client.

    Returns:
        Resend module if available and configured, None otherwise.

    Note: Does not raise - caller should handle None return.
    """
    global _resend_client, _resend_init_error
    if _resend_client is None and _resend_init_error is None:
        try:
            import resend

            if settings.RESEND_API_KEY:
                resend.api_key = settings.RESEND_API_KEY
                _resend_client = resend
                logger.info("Resend email client initialized")
            else:
                _resend_init_error = "RESEND_API_KEY not configured"
                logger.warning(f"{_resend_init_error} - emails will not be sent")
        except ImportError:
            _resend_init_error = "Resend library not installed"
            logger.warning(f"{_resend_init_error} - emails will not be sent")
    return _resend_client


def _get_resend_or_raise():
    """
    Get Resend client, raising specific exceptions on failure.

    Returns:
        Resend module

    Raises:
        EmailConfigurationError: If API key not configured
        EmailServiceUnavailable: If resend library not installed
    """
    client = _get_resend()
    if client is None:
        if _resend_init_error and "not configured" in _resend_init_error:
            raise EmailConfigurationError(_resend_init_error)
        elif _resend_init_error:
            raise EmailServiceUnavailable(_resend_init_error)
        else:
            raise EmailServiceUnavailable("Email service unavailable")
    return client


# =============================================================================
# Composable Email Components (Quiet Library Design)
# =============================================================================

# Design tokens
EMAIL_LOGO_URL = "https://geetanjaliapp.com/logo-email.png"
EMAIL_APP_URL = "https://geetanjaliapp.com"


def _email_header(subtitle: str) -> str:
    """
    Generate email header with logo, brand name, and subtitle.

    Args:
        subtitle: Contextual subtitle (e.g., "Daily Wisdom", "Account Security")

    Returns:
        HTML string for header section
    """
    return f"""
            <!-- HEADER -->
            <div style="background: linear-gradient(to bottom, #fffbeb, #fef3c7); padding: 28px 24px; text-align: center; border-bottom: 1px solid #fde68a;">
                <!-- Logo -->
                <img src="{EMAIL_LOGO_URL}" alt="Geetanjali" width="48" height="48" style="margin-bottom: 10px;">
                <!-- Brand name -->
                <h1 style="color: #78350f; font-size: 20px; margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; letter-spacing: 0.5px;">
                    Geetanjali
                </h1>
                <p style="color: #92400e; font-size: 11px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">
                    {subtitle}
                </p>
            </div>
    """


def _email_footer(links: list[tuple[str, str]]) -> str:
    """
    Generate dark email footer with links.

    Args:
        links: List of (label, url) tuples for footer links

    Returns:
        HTML string for footer section
    """
    if links:
        link_html = '<span style="color: #525252; margin: 0 8px;">·</span>'.join(
            f'<a href="{url}" style="color: #a8a29e; font-size: 12px; text-decoration: none;">{label}</a>'
            for label, url in links
        )
    else:
        link_html = ""

    return f"""
            <!-- FOOTER -->
            <div style="background: #292524; padding: 24px; text-align: center;">
                <p style="color: #d6d3d1; font-size: 13px; margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif;">
                    Geetanjali
                </p>
                <p style="color: #78716c; font-size: 12px; margin: 0 0 16px 0;">
                    Wisdom for modern life
                </p>
                {f'<p style="margin: 0;">{link_html}</p>' if link_html else ''}
            </div>
    """


def _email_button(text: str, url: str) -> str:
    """
    Generate orange CTA button.

    Args:
        text: Button text
        url: Button URL

    Returns:
        HTML string for button
    """
    return f"""
                <div style="text-align: center; margin: 24px 0;">
                    <a href="{url}"
                       style="display: inline-block; background: #ea580c; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px;">
                        {text}
                    </a>
                </div>
    """


def _email_section(title: str, content: str, accent: bool = False) -> str:
    """
    Generate content section with optional left border accent.

    Args:
        title: Section title (uppercase)
        content: Section content HTML
        accent: Whether to show left border accent

    Returns:
        HTML string for section
    """
    border_style = "border-left: 3px solid #f59e0b;" if accent else ""
    bg_style = "background: #fefce8;" if accent else "background: rgba(254, 243, 199, 0.5);"

    return f"""
                <div style="margin-bottom: 24px; padding: 16px 20px; {bg_style} border-radius: 10px; {border_style}">
                    <h2 style="color: #92400e; font-size: 11px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                        {title}
                    </h2>
                    {content}
                </div>
    """


def _email_html_wrapper(body_content: str, header: str, footer: str) -> str:
    """
    Wrap email content in full HTML document structure.

    Args:
        body_content: Main body HTML content
        header: Header HTML from _email_header()
        footer: Footer HTML from _email_footer()

    Returns:
        Complete HTML email document
    """
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #fefce8; font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif;">
        <!-- Wrapper -->
        <div style="max-width: 600px; margin: 0 auto;">
            {header}
            <!-- BODY -->
            <div style="background: #fffbeb; padding: 28px 24px;">
                {body_content}
            </div>
            {footer}
        </div>
    </body>
    </html>
    """


def _email_greeting(greeting: str, name: str, show_date: bool = False) -> str:
    """
    Generate greeting with optional date.

    Args:
        greeting: Greeting text (e.g., "Hello", "Good morning")
        name: Recipient name
        show_date: Whether to show current date

    Returns:
        HTML string for greeting
    """
    from datetime import datetime

    date_html = ""
    if show_date:
        current_date = datetime.utcnow().strftime("%B %d, %Y")
        date_html = f'<p style="color: #a8a29e; font-size: 13px; margin: 0 0 24px 0;">{current_date}</p>'

    return f"""
                <p style="color: #57534e; font-size: 16px; margin: 0 0 {'4px' if show_date else '16px'} 0;">
                    {html.escape(greeting)}, {html.escape(name)}
                </p>
                {date_html}
    """


def _email_paragraph(text: str, muted: bool = False) -> str:
    """
    Generate paragraph with proper styling.

    Args:
        text: Paragraph text
        muted: Whether to use muted color

    Returns:
        HTML string for paragraph
    """
    color = "#78716c" if muted else "#57534e"
    return f'<p style="color: {color}; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">{text}</p>'


def _email_fallback_link(url: str) -> str:
    """
    Generate fallback link text for accessibility.

    Args:
        url: The URL to display

    Returns:
        HTML string for fallback link
    """
    return f"""
                <p style="color: #a8a29e; font-size: 12px; margin: 16px 0 0 0;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="{url}" style="color: #d97706; word-break: break-all;">{url}</a>
                </p>
    """


def send_alert_email(subject: str, message: str) -> bool:
    """
    Send an alert/notification email to the configured admin.

    Used by maintenance scripts and monitoring systems.

    Args:
        subject: Alert subject
        message: Alert message body

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - alert not sent")
        return False

    if not settings.CONTACT_EMAIL_TO or not settings.CONTACT_EMAIL_FROM:
        logger.warning("Email configuration incomplete - alert not sent")
        return False

    # Build HTML email using composable components
    message_html = f'<pre style="color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin: 0;">{html.escape(message)}</pre>'
    body_content = _email_section("Alert Details", message_html, accent=True)

    header = _email_header("System Alert")
    footer = _email_footer([("Dashboard", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [settings.CONTACT_EMAIL_TO],
            "subject": f"[Geetanjali Alert] {subject}",
            "html": html_body,
            "text": message,
        }

        response = resend.Emails.send(params)
        logger.info(f"Alert email sent: {response.get('id', 'unknown')}")
        return True

    except Exception as e:
        logger.error(f"Failed to send alert email: {e}")
        return False


def send_contact_email(
    name: str, email: str, message_type: str, subject: Optional[str], message: str
) -> bool:
    """
    Send contact form message via email.

    Args:
        name: Sender's name
        email: Sender's email (for reply-to)
        message_type: Type of message (feedback, question, etc.)
        subject: Optional subject line
        message: Message content

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - message not sent")
        return False

    # Validate email configuration
    if not settings.CONTACT_EMAIL_TO or not settings.CONTACT_EMAIL_FROM:
        logger.warning(
            "Email configuration incomplete - CONTACT_EMAIL_TO or CONTACT_EMAIL_FROM not set. "
            "Set both in .env to enable contact form emails."
        )
        return False

    # Build email subject
    email_subject = f"[Geetanjali {message_type.replace('_', ' ').title()}]"
    if subject:
        email_subject += f" {subject}"
    else:
        email_subject += f" from {name}"

    # Escape user inputs
    safe_name = html.escape(name)
    safe_email = html.escape(email)
    safe_type = html.escape(message_type.replace("_", " ").title())
    safe_subject = html.escape(subject) if subject else None
    safe_message = html.escape(message)

    # Build contact details section
    contact_html = f"""
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
                <td style="padding: 8px 0; color: #78716c; width: 80px; vertical-align: top;">From:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: 500;">{safe_name}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #78716c; vertical-align: top;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:{safe_email}" style="color: #d97706;">{safe_email}</a></td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #78716c; vertical-align: top;">Type:</td>
                <td style="padding: 8px 0; color: #374151;">{safe_type}</td>
            </tr>
            {f'<tr><td style="padding: 8px 0; color: #78716c; vertical-align: top;">Subject:</td><td style="padding: 8px 0; color: #374151;">{safe_subject}</td></tr>' if safe_subject else ''}
        </table>
    """

    # Build message section
    message_html = f'<div style="color: #374151; line-height: 1.7; white-space: pre-wrap;">{safe_message}</div>'

    # Compose body content
    body_content = (
        _email_section("Contact Details", contact_html)
        + _email_section("Message", message_html, accent=True)
    )

    header = _email_header("Contact Form")
    footer = _email_footer([("Dashboard", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
New Contact Message from Geetanjali

From: {name}
Email: {email}
Type: {message_type.replace('_', ' ').title()}
{f'Subject: {subject}' if subject else ''}

Message:
{message}

---
Sent from Geetanjali Contact Form
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [settings.CONTACT_EMAIL_TO],
            "reply_to": email,
            "subject": email_subject,
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(f"Contact email sent successfully: {response.get('id', 'unknown')}")
        return True

    except Exception as e:
        logger.error(f"Failed to send contact email: {e}")
        return False


@with_email_retry(max_retries=2, base_delay=1.0)
def send_password_reset_email(email: str, reset_url: str) -> bool:
    """
    Send password reset email to user.

    Uses retry wrapper - user is waiting for this email.

    Args:
        email: User's email address
        reset_url: Full URL to reset password page with token

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - reset email not sent")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - reset email not sent")
        return False

    # Build body content using composable components
    body_content = (
        _email_paragraph(
            "You requested to reset your password for your Geetanjali account. "
            "Click the button below to set a new password."
        )
        + _email_button("Reset Password", reset_url)
        + _email_paragraph(
            "This link will expire in 1 hour. If you didn't request this, "
            "you can safely ignore this email.",
            muted=True,
        )
        + _email_fallback_link(reset_url)
    )

    header = _email_header("Account Security")
    footer = _email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
Reset Your Password

You requested to reset your password for your Geetanjali account.

Click this link to set a new password:
{reset_url}

This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.

---
Geetanjali - Ethical Guidance from the Bhagavad Geeta
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": "Reset Your Geetanjali Password",
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Password reset email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
        return False


def send_newsletter_verification_email(
    email: str, name: Optional[str], verify_url: str
) -> bool:
    """
    Send newsletter verification email (double opt-in).

    Args:
        email: Subscriber's email address
        name: Subscriber's name (for greeting)
        verify_url: Full URL to verify subscription

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - verification email not sent")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - verification email not sent")
        return False

    # HTML-escape name as defense-in-depth (regex already sanitizes, but be safe)
    safe_name = html.escape(name) if name else ""
    greeting_text = f"Hello, {safe_name}" if safe_name else "Hello"

    # Build body content using composable components
    body_content = (
        _email_greeting("Hello", safe_name if safe_name else "there")
        + _email_paragraph(
            "Thank you for subscribing to <strong>Daily Wisdom</strong> from Geetanjali! "
            "Please confirm your email address to start receiving daily verses from the Bhagavad Geeta."
        )
        + _email_button("Confirm Subscription", verify_url)
        + _email_paragraph(
            "This link will expire in 24 hours. If you didn't request this, "
            "you can safely ignore this email.",
            muted=True,
        )
        + _email_fallback_link(verify_url)
    )

    header = _email_header("Daily Wisdom")
    footer = _email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
{greeting_text},

Thank you for subscribing to Daily Wisdom from Geetanjali!
Please confirm your email address to start receiving daily verses from the Bhagavad Geeta.

Click this link to confirm your subscription:
{verify_url}

This link will expire in 24 hours. If you didn't request this, you can safely ignore this email.

---
Geetanjali - Ethical Guidance from the Bhagavad Geeta
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": "Confirm Your Daily Wisdom Subscription",
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Newsletter verification email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to send newsletter verification email: {e}")
        return False


def send_newsletter_welcome_email(
    email: str,
    name: Optional[str],
    unsubscribe_url: str,
    preferences_url: str,
    app_url: str = "https://geetanjali.app",
) -> bool:
    """
    Send welcome email after newsletter verification.

    Args:
        email: Subscriber's email address
        name: Subscriber's name (for greeting)
        unsubscribe_url: URL to unsubscribe
        preferences_url: URL to manage preferences

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - welcome email not sent")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - welcome email not sent")
        return False

    # HTML-escape name as defense-in-depth (regex already sanitizes, but be safe)
    safe_name = html.escape(name) if name else ""
    greeting_text = f"Hello, {safe_name}" if safe_name else "Hello"

    # Build "What to expect" section
    expectations_html = """
        <ul style="color: #57534e; line-height: 1.8; margin: 0; padding-left: 24px;">
            <li>A carefully selected verse from the Geeta</li>
            <li>Sanskrit text with English translation</li>
            <li>Practical wisdom for modern life</li>
        </ul>
    """

    # Build body content using composable components
    body_content = (
        _email_greeting("Hello", safe_name if safe_name else "there")
        + _email_paragraph(
            "Your subscription is now confirmed! You'll receive a daily verse from the Bhagavad Geeta "
            "at your preferred time, personalized based on your learning goals."
        )
        + _email_section("What to Expect", expectations_html)
        + _email_button("Explore Geetanjali", app_url)
    )

    header = _email_header("Daily Wisdom")
    footer = _email_footer([
        ("Visit App", EMAIL_APP_URL),
        ("Preferences", preferences_url),
        ("Unsubscribe", unsubscribe_url),
    ])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
{greeting_text},

Your subscription is now confirmed! You'll receive a daily verse from the Bhagavad Geeta
at your preferred time, personalized based on your learning goals.

What to expect:
- A carefully selected verse from the Geeta
- Sanskrit text with English translation
- Practical wisdom for modern life

Visit Geetanjali: {app_url}

---
Manage Preferences: {preferences_url}
Unsubscribe: {unsubscribe_url}

Geetanjali - Ethical Guidance from the Bhagavad Geeta
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": "Welcome to Daily Wisdom!",
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Newsletter welcome email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to send newsletter welcome email: {e}")
        return False


def _format_sanskrit_lines(text: str) -> list[str]:
    """
    Format Sanskrit text into properly separated lines for email display.

    - Removes verse number at the end (e.g., ॥12.14॥)
    - Splits on danda marks (।) for line breaks
    - Uses alternating । and ॥ for line endings

    Args:
        text: Raw Sanskrit text in Devanagari script

    Returns:
        List of formatted lines
    """
    import re

    if not text:
        return []

    # Remove verse number at the end (e.g., ।।2.52।। or ॥2.52॥ or ॥12.14॥॥)
    clean_text = re.sub(r"[।॥]+\d+\.\d+[।॥]+\s*$", "", text)

    # Split on single danda followed by non-danda (clause boundaries)
    # This handles both "।" as separator and "॥" as verse-end marker
    parts = re.split(r"[।॥]+", clean_text)
    parts = [p.strip() for p in parts if p.strip()]

    if not parts:
        return [text.strip()]

    # Format with alternating danda marks (। for odd lines, ॥ for even)
    result = []
    for i, part in enumerate(parts):
        # Even index (0, 2, 4...) = odd line number (1, 3, 5...)
        end_mark = "॥" if (i + 1) % 2 == 0 else "।"
        result.append(f"{part} {end_mark}")

    return result


def send_newsletter_digest_email(
    email: str,
    name: str,
    greeting: str,
    verse: "Verse",
    goal_labels: str,
    milestone_message: Optional[str],
    reflection_prompt: Optional[str],
    verse_url: str,
    unsubscribe_url: str,
    preferences_url: str,
) -> bool:
    """
    Send daily digest email with personalized verse.

    This is the core daily email that subscribers receive. Design philosophy:
    - Editorial structure with quiet library warmth
    - Verse card matches app's detail card styling
    - Sanskrit with proper line breaks, verse reference at bottom
    - Warm amber/orange palette, content-forward

    Args:
        email: Subscriber's email address
        name: Display name for greeting
        greeting: Time-based greeting (Good morning, etc.)
        verse: Verse object with sanskrit, translation, paraphrase
        goal_labels: Human-readable goal description
        milestone_message: Optional milestone (day 7, 30, etc.)
        reflection_prompt: Optional reflection question
        verse_url: URL to full verse page
        unsubscribe_url: URL to unsubscribe
        preferences_url: URL to manage preferences

    Returns:
        True if email sent successfully, False otherwise
    """
    # Check email service availability with specific error categorization
    try:
        resend = _get_resend_or_raise()
    except EmailConfigurationError as e:
        logger.warning(f"Email not configured - digest email not sent: {e}")
        return False
    except EmailServiceUnavailable as e:
        logger.warning(f"Email service unavailable - digest email not sent: {e}")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - digest email not sent")
        return False

    # HTML-escape user inputs
    safe_name = html.escape(name)
    safe_goal_labels = html.escape(goal_labels)

    # Verse content
    verse_ref = f"{verse.chapter}.{verse.verse}"
    sanskrit_raw = verse.sanskrit_devanagari or ""
    translation = verse.translation_en or ""
    paraphrase = verse.paraphrase_en or ""

    # Format Sanskrit with proper line breaks
    sanskrit_lines = _format_sanskrit_lines(sanskrit_raw)
    sanskrit_html = "".join(
        f'<p style="margin: 0 0 4px 0;">{line}</p>' for line in sanskrit_lines
    )
    sanskrit_text = "\n".join(sanskrit_lines)

    # Build milestone section if applicable
    milestone_html = ""
    milestone_text = ""
    if milestone_message:
        milestone_html = f"""
                <!-- Milestone -->
                <div style="margin-bottom: 24px; padding: 16px 20px; background: #fef3c7; border-radius: 10px; text-align: center;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; font-style: italic;">
                        ✦ {html.escape(milestone_message)} ✦
                    </p>
                </div>
        """
        milestone_text = f"\n✦ {milestone_message} ✦\n"

    # Build reflection section if applicable
    reflection_html = ""
    reflection_text = ""
    if reflection_prompt:
        reflection_html = f"""
                <!-- Reflection -->
                <div style="margin-bottom: 24px; padding: 16px 20px; background: rgba(254, 243, 199, 0.3); border-radius: 10px; border: 1px dashed #fde68a;">
                    <p style="color: #78716c; font-size: 14px; margin: 0; font-style: italic; text-align: center;">
                        {html.escape(reflection_prompt)}
                    </p>
                </div>
        """
        reflection_text = f"\n{reflection_prompt}\n"

    # Build verse card (custom styling to match app's detail card)
    verse_card_html = f"""
                <!-- Verse Card (matches app detail card styling) -->
                <div style="background: linear-gradient(to bottom, #fff7ed, #fffbeb); border: 2px solid rgba(251, 191, 36, 0.35); border-radius: 16px; padding: 28px 24px; margin-bottom: 24px;">
                    <!-- Decorative Om -->
                    <div style="text-align: center; margin-bottom: 16px; font-size: 28px; color: rgba(251, 191, 36, 0.5); font-weight: 300;">
                        ॐ
                    </div>
                    <!-- Sanskrit -->
                    <div style="text-align: center; margin-bottom: 20px; font-family: 'Noto Serif Devanagari', Georgia, serif; font-size: 19px; line-height: 1.85; color: rgba(146, 64, 14, 0.7); letter-spacing: 0.025em;">
                        {sanskrit_html}
                    </div>
                    <!-- Translation -->
                    <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; text-align: center; font-style: italic;">
                        "{html.escape(translation)}"
                    </p>
                    <!-- Verse Reference (citation at bottom, like app) -->
                    <div style="text-align: center; padding-top: 16px;">
                        <span style="color: rgba(217, 119, 6, 0.7); font-size: 14px; font-family: Georgia, 'Times New Roman', serif; font-weight: 500;">
                            ॥ {verse_ref} ॥
                        </span>
                    </div>
                </div>
    """

    # Build insight section using shared component
    insight_content = f'<p style="color: #57534e; font-size: 15px; line-height: 1.7; margin: 0;">{html.escape(paraphrase)}</p>'
    insight_html = _email_section("Today's Insight", insight_content, accent=True)

    # Build "Selected For You" section
    goal_content = f'<p style="color: #78716c; font-size: 14px; line-height: 1.6; margin: 0;">Based on your journey toward {safe_goal_labels}.</p>'
    goal_html = _email_section("Selected For You", goal_content)

    # Build body content
    body_content = (
        _email_greeting(greeting, safe_name, show_date=True)
        + verse_card_html
        + insight_html
        + milestone_html
        + reflection_html
        + goal_html
        + _email_button("Read Full Verse →", verse_url)
    )

    # Compose final HTML using shared components
    header = _email_header("Daily Wisdom")
    footer = _email_footer([
        ("Visit App", EMAIL_APP_URL),
        ("Preferences", preferences_url),
        ("Unsubscribe", unsubscribe_url),
    ])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
{greeting}, {safe_name}

════════════════════════════════════════

ॐ

{sanskrit_text}

"{translation}"

॥ {verse_ref} ॥

════════════════════════════════════════

TODAY'S INSIGHT

{paraphrase}

Read full verse: {verse_url}
{milestone_text}{reflection_text}
────────────────────────────────────────

SELECTED FOR YOU
Based on your journey toward {goal_labels}.

────────────────────────────────────────

Geetanjali — Wisdom for modern life

Visit App: https://geetanjaliapp.com
Preferences: {preferences_url}
Unsubscribe: {unsubscribe_url}
    """.strip()

    # Subject line - personal, not promotional
    subject = f"Your daily verse · {verse_ref}"

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Newsletter digest email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        # Log with categorized error type for easier debugging
        error = EmailSendError(f"Failed to send newsletter digest email: {e}", cause=e)
        logger.error(str(error))
        return False


# =============================================================================
# Account Email Functions
# =============================================================================


@with_email_retry(max_retries=2, base_delay=1.0)
def send_account_verification_email(
    email: str, name: str, verify_url: str
) -> bool:
    """
    Send email verification for new account signups.

    Uses retry wrapper - user is waiting for this email.

    Args:
        email: User's email address
        name: User's display name
        verify_url: Full URL to verify email address

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - verification email not sent")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - verification email not sent")
        return False

    # HTML-escape name
    safe_name = html.escape(name) if name else ""

    # Build body content using composable components
    body_content = (
        _email_greeting("Hello", safe_name if safe_name else "there")
        + _email_paragraph(
            "Welcome to Geetanjali! Please verify your email address to complete "
            "your account setup and access all features."
        )
        + _email_button("Verify Email Address", verify_url)
        + _email_paragraph(
            "This link will expire in 24 hours. If you didn't create an account, "
            "you can safely ignore this email.",
            muted=True,
        )
        + _email_fallback_link(verify_url)
    )

    header = _email_header("Verify Your Email")
    footer = _email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
Hello{f', {name}' if name else ''},

Welcome to Geetanjali! Please verify your email address to complete your account setup.

Click this link to verify your email:
{verify_url}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.

---
Geetanjali - Wisdom for modern life
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": "Verify Your Geetanjali Account",
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Account verification email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to send account verification email: {e}")
        return False


@with_email_retry(max_retries=2, base_delay=1.0)
def send_password_changed_email(email: str, name: str) -> bool:
    """
    Send confirmation when user's password is changed.

    Uses retry wrapper - important security notification.
    This is a security notification - no action required unless unauthorized.

    Args:
        email: User's email address
        name: User's display name

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - password changed email not sent")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - password changed email not sent")
        return False

    # HTML-escape name
    safe_name = html.escape(name) if name else ""

    # Get current timestamp for the email
    from datetime import datetime
    current_time = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")

    # Build body content using composable components
    body_content = (
        _email_greeting("Hello", safe_name if safe_name else "there")
        + _email_paragraph(
            f"Your Geetanjali account password was successfully changed on {current_time}."
        )
        + _email_paragraph(
            "If you made this change, no further action is needed."
        )
        + _email_paragraph(
            "<strong>If you did not make this change</strong>, please secure your account immediately "
            "by resetting your password and contact us if you need assistance.",
        )
        + _email_button("Visit Geetanjali", EMAIL_APP_URL)
    )

    header = _email_header("Password Changed")
    footer = _email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
Hello{f', {name}' if name else ''},

Your Geetanjali account password was successfully changed on {current_time}.

If you made this change, no further action is needed.

If you did NOT make this change, please secure your account immediately by resetting your password.

---
Geetanjali - Wisdom for modern life
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": "Your Geetanjali Password Was Changed",
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Password changed email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to send password changed email: {e}")
        return False


def send_account_deleted_email(email: str, name: str) -> bool:
    """
    Send confirmation when user's account is deleted.

    This is a goodbye email with option to return.

    Args:
        email: User's email address
        name: User's display name

    Returns:
        True if email sent successfully, False otherwise
    """
    resend = _get_resend()

    if not resend:
        logger.warning("Email service not available - account deleted email not sent")
        return False

    if not settings.CONTACT_EMAIL_FROM:
        logger.warning("CONTACT_EMAIL_FROM not configured - account deleted email not sent")
        return False

    # HTML-escape name
    safe_name = html.escape(name) if name else ""

    # Build body content using composable components
    body_content = (
        _email_greeting("Hello", safe_name if safe_name else "there")
        + _email_paragraph(
            "Your Geetanjali account has been successfully deleted. We're sorry to see you go."
        )
        + _email_paragraph(
            "All your personal data has been removed from our systems. If you subscribed to our "
            "newsletter, that subscription remains separate and can be managed independently."
        )
        + _email_paragraph(
            "If you ever wish to return, you're always welcome to create a new account. "
            "The wisdom of the Bhagavad Geeta will be here waiting for you.",
            muted=True,
        )
        + _email_button("Return to Geetanjali", EMAIL_APP_URL)
    )

    header = _email_header("Account Deleted")
    footer = _email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = _email_html_wrapper(body_content, header, footer)

    # Plain text version
    text_body = f"""
Hello{f', {name}' if name else ''},

Your Geetanjali account has been successfully deleted. We're sorry to see you go.

All your personal data has been removed from our systems. If you subscribed to our newsletter, that subscription remains separate and can be managed independently.

If you ever wish to return, you're always welcome to create a new account. The wisdom of the Bhagavad Geeta will be here waiting for you.

Visit Geetanjali: {EMAIL_APP_URL}

---
Geetanjali - Wisdom for modern life
    """.strip()

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [email],
            "subject": "Your Geetanjali Account Has Been Deleted",
            "html": html_body,
            "text": text_body,
        }

        response = resend.Emails.send(params)
        logger.info(
            f"Account deleted email sent to {email}: {response.get('id', 'unknown')}"
        )
        return True

    except Exception as e:
        logger.error(f"Failed to send account deleted email: {e}")
        return False
