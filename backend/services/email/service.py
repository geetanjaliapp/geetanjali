"""Email sending service using Resend."""

import html
import logging
import re
from typing import TYPE_CHECKING

from config import settings

from .exceptions import (
    EmailConfigurationError,
    EmailSendError,
    EmailServiceUnavailable,
)
from .resilience import with_email_retry
from .templates import (
    EMAIL_APP_URL,
    email_button,
    email_fallback_link,
    email_footer,
    email_greeting,
    email_header,
    email_html_wrapper,
    email_paragraph,
    email_section,
)

if TYPE_CHECKING:
    from models import Verse

logger = logging.getLogger(__name__)


# =============================================================================
# Resend Client Initialization
# =============================================================================

# Lazy import resend to avoid import errors if not installed
_resend_client: object | None = None
_resend_init_error: str | None = None


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
# Helper Functions
# =============================================================================


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


# =============================================================================
# Send Functions
# =============================================================================


@with_email_retry(max_retries=2, base_delay=1.0)
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
    body_content = email_section("Alert Details", message_html, accent=True)

    header = email_header("System Alert")
    footer = email_footer([("Dashboard", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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


@with_email_retry(max_retries=2, base_delay=1.0)
def send_contact_email(
    name: str, email: str, message_type: str, subject: str | None, message: str
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
    body_content = email_section("Contact Details", contact_html) + email_section(
        "Message", message_html, accent=True
    )

    header = email_header("Contact Form")
    footer = email_footer([("Dashboard", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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
        email_paragraph(
            "You requested to reset your password for your Geetanjali account. "
            "Click the button below to set a new password."
        )
        + email_button("Reset Password", reset_url)
        + email_paragraph(
            "This link will expire in 1 hour. If you didn't request this, "
            "you can safely ignore this email.",
            muted=True,
        )
        + email_fallback_link(reset_url)
    )

    header = email_header("Account Security")
    footer = email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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


@with_email_retry(max_retries=2, base_delay=1.0)
def send_newsletter_verification_email(
    email: str, name: str | None, verify_url: str
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
        logger.warning(
            "CONTACT_EMAIL_FROM not configured - verification email not sent"
        )
        return False

    # HTML-escape name as defense-in-depth (regex already sanitizes, but be safe)
    safe_name = html.escape(name) if name else ""
    greeting_text = f"Hello, {safe_name}" if safe_name else "Hello"

    # Build body content using composable components
    body_content = (
        email_greeting("Hello", safe_name if safe_name else "there")
        + email_paragraph(
            "Thank you for subscribing to <strong>Daily Wisdom</strong> from Geetanjali! "
            "Please confirm your email address to start receiving daily verses from the Bhagavad Geeta."
        )
        + email_button("Confirm Subscription", verify_url)
        + email_paragraph(
            "This link will expire in 24 hours. If you didn't request this, "
            "you can safely ignore this email.",
            muted=True,
        )
        + email_fallback_link(verify_url)
    )

    header = email_header("Daily Wisdom")
    footer = email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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


@with_email_retry(max_retries=2, base_delay=1.0)
def send_newsletter_welcome_email(
    email: str,
    name: str | None,
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
        email_greeting("Hello", safe_name if safe_name else "there")
        + email_paragraph(
            "Your subscription is now confirmed! You'll receive a daily verse from the Bhagavad Geeta "
            "at your preferred time, personalized based on your learning goals."
        )
        + email_section("What to Expect", expectations_html)
        + email_button("Explore Geetanjali", app_url)
    )

    header = email_header("Daily Wisdom")
    footer = email_footer(
        [
            ("Visit App", EMAIL_APP_URL),
            ("Preferences", preferences_url),
            ("Unsubscribe", unsubscribe_url),
        ]
    )
    html_body = email_html_wrapper(body_content, header, footer)

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


@with_email_retry(max_retries=2, base_delay=1.0)
def send_newsletter_digest_email(
    email: str,
    name: str,
    greeting: str,
    verse: "Verse",
    goal_labels: str,
    milestone_message: str | None,
    reflection_prompt: str | None,
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
    insight_html = email_section("Today's Insight", insight_content, accent=True)

    # Build "Selected For You" section
    goal_content = f'<p style="color: #78716c; font-size: 14px; line-height: 1.6; margin: 0;">Based on your journey toward {safe_goal_labels}.</p>'
    goal_html = email_section("Selected For You", goal_content)

    # Build body content
    body_content = (
        email_greeting(greeting, safe_name, show_date=True)
        + verse_card_html
        + insight_html
        + milestone_html
        + reflection_html
        + goal_html
        + email_button("Read Full Verse →", verse_url)
    )

    # Compose final HTML using shared components
    header = email_header("Daily Wisdom")
    footer = email_footer(
        [
            ("Visit App", EMAIL_APP_URL),
            ("Preferences", preferences_url),
            ("Unsubscribe", unsubscribe_url),
        ]
    )
    html_body = email_html_wrapper(body_content, header, footer)

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
def send_account_verification_email(email: str, name: str, verify_url: str) -> bool:
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
        logger.warning(
            "CONTACT_EMAIL_FROM not configured - verification email not sent"
        )
        return False

    # HTML-escape name
    safe_name = html.escape(name) if name else ""

    # Build body content using composable components
    body_content = (
        email_greeting("Hello", safe_name if safe_name else "there")
        + email_paragraph(
            "Welcome to Geetanjali! Please verify your email address to complete "
            "your account setup and access all features."
        )
        + email_button("Verify Email Address", verify_url)
        + email_paragraph(
            "This link will expire in 24 hours. If you didn't create an account, "
            "you can safely ignore this email.",
            muted=True,
        )
        + email_fallback_link(verify_url)
    )

    header = email_header("Verify Your Email")
    footer = email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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
        logger.warning(
            "CONTACT_EMAIL_FROM not configured - password changed email not sent"
        )
        return False

    # HTML-escape name
    safe_name = html.escape(name) if name else ""

    # Get current timestamp for the email
    from datetime import datetime

    current_time = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")

    # Build body content using composable components
    body_content = (
        email_greeting("Hello", safe_name if safe_name else "there")
        + email_paragraph(
            f"Your Geetanjali account password was successfully changed on {current_time}."
        )
        + email_paragraph("If you made this change, no further action is needed.")
        + email_paragraph(
            "<strong>If you did not make this change</strong>, please secure your account immediately "
            "by resetting your password and contact us if you need assistance.",
        )
        + email_button("Visit Geetanjali", EMAIL_APP_URL)
    )

    header = email_header("Password Changed")
    footer = email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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


@with_email_retry(max_retries=2, base_delay=1.0)
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
        logger.warning(
            "CONTACT_EMAIL_FROM not configured - account deleted email not sent"
        )
        return False

    # HTML-escape name
    safe_name = html.escape(name) if name else ""

    # Build body content using composable components
    body_content = (
        email_greeting("Hello", safe_name if safe_name else "there")
        + email_paragraph(
            "Your Geetanjali account has been successfully deleted. We're sorry to see you go."
        )
        + email_paragraph(
            "All your personal data has been removed from our systems. If you subscribed to our "
            "newsletter, that subscription remains separate and can be managed independently."
        )
        + email_paragraph(
            "If you ever wish to return, you're always welcome to create a new account. "
            "The wisdom of the Bhagavad Geeta will be here waiting for you.",
            muted=True,
        )
        + email_button("Return to Geetanjali", EMAIL_APP_URL)
    )

    header = email_header("Account Deleted")
    footer = email_footer([("Visit App", EMAIL_APP_URL)])
    html_body = email_html_wrapper(body_content, header, footer)

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
