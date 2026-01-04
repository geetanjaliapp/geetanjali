"""Tests for email service core functionality, exceptions, and email types."""

from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.unit


class TestEmailService:
    """Tests for email service functions."""

    def test_get_resend_without_api_key(self):
        """Test _get_resend returns None when API key not configured."""
        with patch("services.email.service.settings") as mock_settings:
            mock_settings.RESEND_API_KEY = None

            import services.email.service as email_service

            email_service._resend_client = None

            result = email_service._get_resend()
            assert result is None

    def test_send_contact_email_no_service(self):
        """Test contact email returns False when service unavailable."""
        with patch("services.email.service._get_resend", return_value=None):
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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
        with patch("services.email.service._get_resend", return_value=None):
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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
            EmailConfigurationError,
            EmailError,
            EmailSendError,
            EmailServiceUnavailable,
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
        import services.email.service as email_service
        from services.email import EmailConfigurationError

        original_client = email_service._resend_client
        original_error = email_service._resend_init_error

        email_service._resend_client = None
        email_service._resend_init_error = "RESEND_API_KEY not configured"

        try:
            with pytest.raises(EmailConfigurationError) as exc_info:
                email_service._get_resend_or_raise()
            assert "not configured" in str(exc_info.value)
        finally:
            email_service._resend_client = original_client
            email_service._resend_init_error = original_error

    def test_get_resend_or_raise_unavailable_error(self):
        """Test _get_resend_or_raise raises EmailServiceUnavailable when library missing."""
        import services.email.service as email_service
        from services.email import EmailServiceUnavailable

        original_client = email_service._resend_client
        original_error = email_service._resend_init_error

        email_service._resend_client = None
        email_service._resend_init_error = "Resend library not installed"

        try:
            with pytest.raises(EmailServiceUnavailable) as exc_info:
                email_service._get_resend_or_raise()
            assert "not installed" in str(exc_info.value)
        finally:
            email_service._resend_client = original_client
            email_service._resend_init_error = original_error


class TestAccountVerificationEmail:
    """Tests for account verification email."""

    def test_send_account_verification_email_no_service(self):
        """Test verification email returns False when service unavailable."""
        with patch("services.email.service._get_resend", return_value=None):
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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
        with patch("services.email.service._get_resend", return_value=None):
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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
        with patch("services.email.service._get_resend", return_value=None):
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@example.com"

                from services.email import send_account_deleted_email

                result = send_account_deleted_email(
                    email="user@example.com",
                    name="Test User",
                )

                assert result is False
