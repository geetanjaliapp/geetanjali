"""Email service using Resend for sending emails."""

import html
import logging
from typing import Optional, TYPE_CHECKING

from config import settings

if TYPE_CHECKING:
    from models import Verse

logger = logging.getLogger(__name__)


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

    try:
        params = {
            "from": settings.CONTACT_EMAIL_FROM,
            "to": [settings.CONTACT_EMAIL_TO],
            "subject": f"[Geetanjali Alert] {subject}",
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

    # Build HTML email body
    html_body = f"""
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Message</h1>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 100px;">From:</td>
                    <td style="padding: 8px 0; color: #111827; font-weight: 500;">{name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                    <td style="padding: 8px 0;"><a href="mailto:{email}" style="color: #f97316;">{email}</a></td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Type:</td>
                    <td style="padding: 8px 0; color: #111827;">{message_type.replace('_', ' ').title()}</td>
                </tr>
                {f'<tr><td style="padding: 8px 0; color: #6b7280;">Subject:</td><td style="padding: 8px 0; color: #111827;">{subject}</td></tr>' if subject else ''}
            </table>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <div style="color: #374151; line-height: 1.6; white-space: pre-wrap;">{message}</div>
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
            Sent from Geetanjali Contact Form
        </div>
    </div>
    """

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


def send_password_reset_email(email: str, reset_url: str) -> bool:
    """
    Send password reset email to user.

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

    # Build HTML email body
    html_body = """
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                You requested to reset your password for your Geetanjali account.
                Click the button below to set a new password.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{reset_url}"
                   style="display: inline-block; background: #f97316; color: white; padding: 12px 32px;
                          text-decoration: none; border-radius: 8px; font-weight: 500;">
                    Reset Password
                </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 16px 0 0 0;">
                This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{reset_url}" style="color: #f97316; word-break: break-all;">{reset_url}</a>
            </p>
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
            Geetanjali - Ethical Guidance from the Bhagavad Geeta
        </div>
    </div>
    """.format(
        reset_url=reset_url
    )

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
    greeting = f"Hello {html.escape(name)}" if name else "Hello"

    # Build HTML email body
    html_body = f"""
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🙏 Confirm Your Subscription</h1>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                {greeting},
            </p>
            <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                Thank you for subscribing to <strong>Daily Wisdom</strong> from Geetanjali!
                Please confirm your email address to start receiving daily verses from the Bhagavad Geeta.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{verify_url}"
                   style="display: inline-block; background: #f97316; color: white; padding: 12px 32px;
                          text-decoration: none; border-radius: 8px; font-weight: 500;">
                    Confirm Subscription
                </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 16px 0 0 0;">
                This link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{verify_url}" style="color: #f97316; word-break: break-all;">{verify_url}</a>
            </p>
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
            Geetanjali - Ethical Guidance from the Bhagavad Geeta
        </div>
    </div>
    """

    # Plain text version
    text_body = f"""
{greeting},

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
    greeting = f"Hello {html.escape(name)}" if name else "Hello"

    # Build HTML email body
    html_body = f"""
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Welcome to Daily Wisdom!</h1>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                {greeting},
            </p>
            <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                Your subscription is now confirmed! You'll receive a daily verse from the Bhagavad Geeta
                at your preferred time, personalized based on your learning goals.
            </p>
            <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">
                <strong>What to expect:</strong>
            </p>
            <ul style="color: #374151; line-height: 1.8; margin: 0 0 16px 0; padding-left: 24px;">
                <li>A carefully selected verse from the Geeta</li>
                <li>Sanskrit text with English translation</li>
                <li>Practical wisdom for modern life</li>
            </ul>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{app_url}"
                   style="display: inline-block; background: #f97316; color: white; padding: 12px 32px;
                          text-decoration: none; border-radius: 8px; font-weight: 500;">
                    Explore Geetanjali
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                <a href="{preferences_url}" style="color: #f97316;">Manage Preferences</a> |
                <a href="{unsubscribe_url}" style="color: #f97316;">Unsubscribe</a>
            </p>
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
            Geetanjali - Ethical Guidance from the Bhagavad Geeta
        </div>
    </div>
    """

    # Plain text version
    text_body = f"""
{greeting},

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
            "subject": "Welcome to Daily Wisdom! 🙏",
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

    # Get current date for display
    from datetime import datetime

    current_date = datetime.utcnow().strftime("%B %d, %Y")

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

    # Build HTML email body - Editorial Library design
    html_body = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #fefce8; font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif;">
        <!-- Wrapper -->
        <div style="max-width: 600px; margin: 0 auto;">

            <!-- HEADER -->
            <div style="background: linear-gradient(to bottom, #fffbeb, #fef3c7); padding: 28px 24px; text-align: center; border-bottom: 1px solid #fde68a;">
                <!-- Logo -->
                <img src="https://geetanjaliapp.com/logo.svg" alt="" width="48" height="48" style="margin-bottom: 10px;">
                <!-- Brand name -->
                <h1 style="color: #78350f; font-size: 20px; margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-weight: 500; letter-spacing: 0.5px;">
                    Geetanjali
                </h1>
                <p style="color: #92400e; font-size: 11px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">
                    Daily Wisdom
                </p>
            </div>

            <!-- BODY -->
            <div style="background: #fffbeb; padding: 28px 24px;">

                <!-- Greeting -->
                <p style="color: #57534e; font-size: 16px; margin: 0 0 4px 0;">
                    {html.escape(greeting)}, {safe_name}
                </p>
                <p style="color: #a8a29e; font-size: 13px; margin: 0 0 24px 0;">
                    {current_date}
                </p>

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

                <!-- Insight Section -->
                <div style="margin-bottom: 24px; padding: 20px; background: #fefce8; border-radius: 12px; border-left: 3px solid #f59e0b;">
                    <h2 style="color: #b45309; font-size: 11px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                        Today's Insight
                    </h2>
                    <p style="color: #57534e; font-size: 15px; line-height: 1.7; margin: 0;">
                        {html.escape(paraphrase)}
                    </p>
                </div>

                {milestone_html}

                {reflection_html}

                <!-- Why This Verse -->
                <div style="padding: 16px 20px; background: rgba(254, 243, 199, 0.5); border-radius: 10px; margin-bottom: 24px;">
                    <h2 style="color: #92400e; font-size: 11px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                        Selected For You
                    </h2>
                    <p style="color: #78716c; font-size: 14px; line-height: 1.6; margin: 0;">
                        Based on your journey toward {safe_goal_labels}.
                    </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center;">
                    <a href="{verse_url}"
                       style="display: inline-block; background: #ea580c; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 500; font-size: 14px;">
                        Read Full Verse →
                    </a>
                </div>
            </div>

            <!-- FOOTER -->
            <div style="background: #292524; padding: 24px; text-align: center;">
                <p style="color: #d6d3d1; font-size: 13px; margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif;">
                    Geetanjali
                </p>
                <p style="color: #78716c; font-size: 12px; margin: 0 0 16px 0;">
                    Wisdom for modern life
                </p>
                <p style="margin: 0;">
                    <a href="https://geetanjaliapp.com" style="color: #a8a29e; font-size: 12px; text-decoration: none;">Visit App</a>
                    <span style="color: #525252; margin: 0 8px;">·</span>
                    <a href="{preferences_url}" style="color: #a8a29e; font-size: 12px; text-decoration: none;">Preferences</a>
                    <span style="color: #525252; margin: 0 8px;">·</span>
                    <a href="{unsubscribe_url}" style="color: #a8a29e; font-size: 12px; text-decoration: none;">Unsubscribe</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text version
    text_body = f"""
{greeting}, {safe_name}
{current_date}

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
