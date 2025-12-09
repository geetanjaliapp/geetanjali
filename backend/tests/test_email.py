"""Tests for email service."""

from unittest.mock import patch, MagicMock


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
