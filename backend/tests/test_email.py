"""Tests for email service."""

import pytest
from unittest.mock import patch, MagicMock

# Mark all tests in this module as unit tests (fast, mocked externals)
pytestmark = pytest.mark.unit


class TestEmailService:
    """Tests for email service functions."""

    def test_get_resend_without_api_key(self):
        """Test _get_resend returns None when API key not configured."""
        with patch("services.email.settings") as mock_settings:
            mock_settings.RESEND_API_KEY = None

            # Reset global client
            import services.email

            services.email._resend_client = None

            result = services.email._get_resend()
            assert result is None

    def test_send_contact_email_no_service(self):
        """Test contact email returns False when service unavailable."""
        with patch("services.email._get_resend", return_value=None):
            from services.email import send_contact_email

            result = send_contact_email(
                name="Test User",
                email="test@example.com",
                message_type="feedback",
                subject="Test Subject",
                message="Test message content",
            )

            assert result is False

    def test_send_contact_email_missing_config(self):
        """Test contact email returns False when email config incomplete."""
        mock_resend = MagicMock()

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_TO = None
                mock_settings.CONTACT_EMAIL_FROM = None

                from services.email import send_contact_email

                result = send_contact_email(
                    name="Test User",
                    email="test@example.com",
                    message_type="feedback",
                    subject=None,
                    message="Test message content",
                )

                assert result is False

    def test_send_contact_email_success(self):
        """Test contact email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "test-email-id"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_TO = "admin@example.com"
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_contact_email

                result = send_contact_email(
                    name="Test User",
                    email="test@example.com",
                    message_type="question",
                    subject="Test Question",
                    message="This is a test question message.",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_password_reset_email_no_service(self):
        """Test password reset email returns False when service unavailable."""
        with patch("services.email._get_resend", return_value=None):
            from services.email import send_password_reset_email

            result = send_password_reset_email(
                email="user@example.com",
                reset_url="https://example.com/reset?token=abc123",
            )

            assert result is False

    def test_send_password_reset_email_success(self):
        """Test password reset email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "reset-email-id"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_password_reset_email

                result = send_password_reset_email(
                    email="user@example.com",
                    reset_url="https://example.com/reset?token=abc123",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_alert_email_success(self):
        """Test alert email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "alert-email-id"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_TO = "admin@example.com"
                mock_settings.CONTACT_EMAIL_FROM = "alerts@example.com"

                from services.email import send_alert_email

                result = send_alert_email(
                    subject="Test Alert",
                    message="Something happened that needs attention.",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_contact_email_exception_handling(self):
        """Test contact email handles exceptions gracefully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.side_effect = Exception("API Error")

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_TO = "admin@example.com"
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_contact_email

                result = send_contact_email(
                    name="Test User",
                    email="test@example.com",
                    message_type="feedback",
                    subject="Test",
                    message="Test message",
                )

                assert result is False


class TestEmailExceptions:
    """Tests for email service exception types."""

    def test_exception_hierarchy(self):
        """Test that all exceptions inherit from EmailError."""
        from services.email import (
            EmailError,
            EmailConfigurationError,
            EmailServiceUnavailable,
            EmailSendError,
        )

        assert issubclass(EmailConfigurationError, EmailError)
        assert issubclass(EmailServiceUnavailable, EmailError)
        assert issubclass(EmailSendError, EmailError)

    def test_email_send_error_with_cause(self):
        """Test EmailSendError preserves underlying cause."""
        from services.email import EmailSendError

        original_error = ValueError("Original error")
        error = EmailSendError("Send failed", cause=original_error)

        assert str(error) == "Send failed"
        assert error.cause is original_error

    def test_get_resend_or_raise_configuration_error(self):
        """Test _get_resend_or_raise raises EmailConfigurationError when not configured."""
        import services.email
        from services.email import EmailConfigurationError

        # Save original state
        original_client = services.email._resend_client
        original_error = services.email._resend_init_error

        # Reset global state to simulate unconfigured
        services.email._resend_client = None
        services.email._resend_init_error = "RESEND_API_KEY not configured"

        try:
            with pytest.raises(EmailConfigurationError) as exc_info:
                services.email._get_resend_or_raise()
            assert "not configured" in str(exc_info.value)
        finally:
            # Restore original state
            services.email._resend_client = original_client
            services.email._resend_init_error = original_error

    def test_get_resend_or_raise_unavailable_error(self):
        """Test _get_resend_or_raise raises EmailServiceUnavailable when library missing."""
        import services.email
        from services.email import EmailServiceUnavailable

        # Save original state
        original_client = services.email._resend_client
        original_error = services.email._resend_init_error

        # Reset global state to simulate library not installed
        services.email._resend_client = None
        services.email._resend_init_error = "Resend library not installed"

        try:
            with pytest.raises(EmailServiceUnavailable) as exc_info:
                services.email._get_resend_or_raise()
            assert "not installed" in str(exc_info.value)
        finally:
            # Restore original state
            services.email._resend_client = original_client
            services.email._resend_init_error = original_error


class TestDigestEmailFailures:
    """Tests for digest email failure scenarios."""

    def test_digest_email_configuration_error(self):
        """Test digest email returns False when not configured."""
        from services.email import send_newsletter_digest_email, EmailConfigurationError

        with patch(
            "services.email._get_resend_or_raise",
            side_effect=EmailConfigurationError("API key not set"),
        ):
            result = send_newsletter_digest_email(
                email="test@example.com",
                name="Test User",
                greeting="Good morning",
                verse=MagicMock(
                    chapter=1,
                    verse=1,
                    canonical_id="1.1",
                    sanskrit_devanagari="धृतराष्ट्र उवाच",
                    translation_en="Dhritarashtra said",
                    paraphrase_en="King spoke",
                ),
                goal_labels="Inner Peace",
                milestone_message=None,
                reflection_prompt=None,
                verse_url="https://example.com/verses/1.1",
                unsubscribe_url="https://example.com/unsubscribe",
                preferences_url="https://example.com/preferences",
            )

            assert result is False

    def test_digest_email_service_unavailable(self):
        """Test digest email returns False when service unavailable."""
        from services.email import send_newsletter_digest_email, EmailServiceUnavailable

        with patch(
            "services.email._get_resend_or_raise",
            side_effect=EmailServiceUnavailable("Service down"),
        ):
            result = send_newsletter_digest_email(
                email="test@example.com",
                name="Test User",
                greeting="Good morning",
                verse=MagicMock(
                    chapter=1,
                    verse=1,
                    canonical_id="1.1",
                    sanskrit_devanagari="धृतराष्ट्र उवाच",
                    translation_en="Dhritarashtra said",
                    paraphrase_en="King spoke",
                ),
                goal_labels="Inner Peace",
                milestone_message=None,
                reflection_prompt=None,
                verse_url="https://example.com/verses/1.1",
                unsubscribe_url="https://example.com/unsubscribe",
                preferences_url="https://example.com/preferences",
            )

            assert result is False

    def test_digest_email_api_error(self):
        """Test digest email returns False on API error."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.side_effect = Exception("Rate limited")

        with patch("services.email._get_resend_or_raise", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_newsletter_digest_email

                result = send_newsletter_digest_email(
                    email="test@example.com",
                    name="Test User",
                    greeting="Good morning",
                    verse=MagicMock(
                        chapter=1,
                        verse=1,
                        canonical_id="1.1",
                        sanskrit_devanagari="धृतराष्ट्र उवाच",
                        translation_en="Dhritarashtra said",
                        paraphrase_en="King spoke",
                    ),
                    goal_labels="Inner Peace",
                    milestone_message=None,
                    reflection_prompt=None,
                    verse_url="https://example.com/verses/1.1",
                    unsubscribe_url="https://example.com/unsubscribe",
                    preferences_url="https://example.com/preferences",
                )

                assert result is False

    def test_digest_email_success(self):
        """Test digest email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "digest-email-id"}

        with patch("services.email._get_resend_or_raise", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_newsletter_digest_email

                result = send_newsletter_digest_email(
                    email="test@example.com",
                    name="Test User",
                    greeting="Good morning",
                    verse=MagicMock(
                        chapter=1,
                        verse=1,
                        canonical_id="1.1",
                        sanskrit_devanagari="धृतराष्ट्र उवाच",
                        translation_en="Dhritarashtra said",
                        paraphrase_en="King spoke",
                    ),
                    goal_labels="Inner Peace",
                    milestone_message="Day 7 milestone!",
                    reflection_prompt="How are you feeling?",
                    verse_url="https://example.com/verses/1.1",
                    unsubscribe_url="https://example.com/unsubscribe",
                    preferences_url="https://example.com/preferences",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()


class TestAccountVerificationEmail:
    """Tests for account verification email."""

    def test_send_account_verification_email_no_service(self):
        """Test verification email returns False when service unavailable."""
        with patch("services.email._get_resend", return_value=None):
            from services.email import send_account_verification_email

            result = send_account_verification_email(
                email="user@example.com",
                name="Test User",
                verify_url="https://example.com/verify-email/abc123",
            )

            assert result is False

    def test_send_account_verification_email_success(self):
        """Test verification email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "verify-email-id"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_account_verification_email

                result = send_account_verification_email(
                    email="user@example.com",
                    name="Test User",
                    verify_url="https://example.com/verify-email/abc123",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_account_verification_email_exception(self):
        """Test verification email handles exceptions gracefully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.side_effect = Exception("API Error")

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_account_verification_email

                result = send_account_verification_email(
                    email="user@example.com",
                    name="Test User",
                    verify_url="https://example.com/verify-email/abc123",
                )

                assert result is False


class TestPasswordChangedEmail:
    """Tests for password changed confirmation email."""

    def test_send_password_changed_email_no_service(self):
        """Test password changed email returns False when service unavailable."""
        with patch("services.email._get_resend", return_value=None):
            from services.email import send_password_changed_email

            result = send_password_changed_email(
                email="user@example.com",
                name="Test User",
            )

            assert result is False

    def test_send_password_changed_email_success(self):
        """Test password changed email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "password-changed-id"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_password_changed_email

                result = send_password_changed_email(
                    email="user@example.com",
                    name="Test User",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_password_changed_email_exception(self):
        """Test password changed email handles exceptions gracefully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.side_effect = Exception("API Error")

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_password_changed_email

                result = send_password_changed_email(
                    email="user@example.com",
                    name="Test User",
                )

                assert result is False


class TestAccountDeletedEmail:
    """Tests for account deleted confirmation email."""

    def test_send_account_deleted_email_no_service(self):
        """Test account deleted email returns False when service unavailable."""
        with patch("services.email._get_resend", return_value=None):
            from services.email import send_account_deleted_email

            result = send_account_deleted_email(
                email="user@example.com",
                name="Test User",
            )

            assert result is False

    def test_send_account_deleted_email_success(self):
        """Test account deleted email returns True on success."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "account-deleted-id"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_account_deleted_email

                result = send_account_deleted_email(
                    email="user@example.com",
                    name="Test User",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_account_deleted_email_exception(self):
        """Test account deleted email handles exceptions gracefully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.side_effect = Exception("API Error")

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_account_deleted_email

                result = send_account_deleted_email(
                    email="user@example.com",
                    name="Test User",
                )

                assert result is False
