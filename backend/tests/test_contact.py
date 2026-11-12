"""Tests for contact form API.

Critical paths:
- Contact form submission (success case)
- Content validation (rejection of spam/gibberish)
- Line breaks folded out of email-header fields
"""

from unittest.mock import patch

import pytest

from api.contact import ContactRequest


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test."""
    from api.dependencies import limiter

    # Clear the in-memory storage to reset rate limits
    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()
    yield


class TestContactFormSubmission:
    """Test contact form submission critical path."""

    def test_submit_contact_success(self, client, db_session):
        """Contact form submission saves to database and returns success."""
        # Mock the email sending to avoid actual email calls
        with patch("api.contact.send_contact_email") as mock_send:
            mock_send.return_value = True

            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Test User",
                    "email": "test@example.com",
                    "message_type": "feedback",
                    "subject": "Test Subject",
                    "message": "This is a valid test message with enough content.",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "Thank you" in data["message"]
            assert data["id"] is not None

    def test_submit_contact_minimal_required_fields(self, client, db_session):
        """Contact form works with only required fields."""
        with patch("api.contact.send_contact_email") as mock_send:
            mock_send.return_value = True

            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "User",
                    "email": "user@example.com",
                    "message": "This is my message which should be valid.",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_submit_contact_missing_required_field(self, client):
        """Contact form requires name, email, and message."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "User",
                "email": "user@example.com",
                # Missing message
            },
        )

        assert response.status_code == 422

    def test_submit_contact_invalid_email(self, client):
        """Contact form validates email format."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "User",
                "email": "not-an-email",
                "message": "This is a valid message with content.",
            },
        )

        assert response.status_code == 422


class TestContactContentValidation:
    """Test content validation for spam/gibberish detection."""

    def test_reject_gibberish_message(self, client, db_session):
        """Gibberish content is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "User",
                "email": "user@example.com",
                "message": "asdfghjkl qwerty zxcvbnm asdfghjkl",
            },
        )

        # Should be rejected with 422 (content policy violation)
        assert response.status_code == 422

    def test_reject_repeated_characters(self, client, db_session):
        """Repeated character spam is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "User",
                "email": "user@example.com",
                "message": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
        )

        assert response.status_code == 422


class TestContactCRLFPrevention:
    """`name` and `subject` go into the email subject line. SafeName/SafeTitle fold every
    whitespace run, line breaks included, into one space: that fold is the only guard."""

    @pytest.mark.parametrize("field", ["name", "subject"])
    @pytest.mark.parametrize(
        "brk",
        ["\n", "\r", "\r\n", "\x0b", "\x0c", "\x1c", "\x1d", "\x1e", "\x85", "\u2028", "\u2029"],
    )
    def test_line_breaks_fold_to_a_space(self, field, brk):
        data = {
            "name": "User",
            "email": "user@example.com",
            "message": "This is a valid message content for the form.",
            field: f"User{brk}Bcc: attacker@evil.com",
        }
        assert getattr(ContactRequest(**data), field) == "User Bcc: attacker@evil.com"


class TestContactMessageTypes:
    """Test different message types are accepted."""

    @pytest.mark.parametrize(
        "message_type",
        ["feedback", "question", "bug_report", "feature_request", "other"],
    )
    def test_valid_message_types(self, client, db_session, message_type):
        """All valid message types are accepted."""
        with patch("api.contact.send_contact_email") as mock_send:
            mock_send.return_value = True

            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "User",
                    "email": "user@example.com",
                    "message_type": message_type,
                    "message": "This is a valid test message content.",
                },
            )

            assert response.status_code == 200

    def test_invalid_message_type(self, client):
        """Invalid message type is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "User",
                "email": "user@example.com",
                "message_type": "invalid_type",
                "message": "This is a valid test message content.",
            },
        )

        assert response.status_code == 422
