"""Email service using Resend for sending emails."""

import html
import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# Lazy import resend to avoid import errors if not installed
_resend_client: Optional[object] = None


def _get_resend():
    """Get or initialize Resend client."""
    global _resend_client
    if _resend_client is None:
        try:
            import resend

            if settings.RESEND_API_KEY:
                resend.api_key = settings.RESEND_API_KEY
                _resend_client = resend
                logger.info("Resend email client initialized")
            else:
                logger.warning(
                    "RESEND_API_KEY not configured - emails will not be sent"
                )
        except ImportError:
            logger.warning("Resend library not installed - emails will not be sent")
    return _resend_client


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
