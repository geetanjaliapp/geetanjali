"""Tests for digest email failure scenarios."""

from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.unit


class TestDigestEmailFailures:
    """Tests for digest email failure scenarios."""

    def test_digest_email_configuration_error(self):
        """Test digest email returns False when not configured."""
        from services.email import EmailConfigurationError, send_newsletter_digest_email

        with patch(
            "services.email.service._get_resend_or_raise",
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
        from services.email import EmailServiceUnavailable, send_newsletter_digest_email

        with patch(
            "services.email.service._get_resend_or_raise",
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

        with patch("services.email.service._get_resend_or_raise", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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

        with patch("services.email.service._get_resend_or_raise", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
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
