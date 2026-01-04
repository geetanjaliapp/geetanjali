"""Tests for newsletter preferences endpoint, email functions, and model tests."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status

from models import Subscriber

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test."""
    from api.dependencies import limiter

    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()
    yield


class TestPreferences:
    """Tests for GET/PATCH /api/v1/newsletter/preferences/{token}."""

    def test_get_preferences_success(self, client, db_session):
        """Test getting subscription preferences."""
        subscriber = Subscriber(
            email="prefs@example.com",
            name="Test User",
            goal_ids=["inner_peace"],
            send_time="evening",
            verified=True,
            verification_token="prefs-token",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.get("/api/v1/newsletter/preferences/prefs-token")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "prefs@example.com"
        assert data["name"] == "Test User"
        assert data["goal_ids"] == ["inner_peace"]
        assert data["send_time"] == "evening"
        assert data["verified"] is True

    def test_get_preferences_invalid_token(self, client):
        """Test getting preferences with invalid token."""
        response = client.get("/api/v1/newsletter/preferences/invalid-token")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_preferences_success(self, client, db_session):
        """Test updating subscription preferences."""
        subscriber = Subscriber(
            email="updateprefs@example.com",
            name="Old Name",
            goal_ids=["inner_peace"],
            send_time="morning",
            verified=True,
            verification_token="update-token",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.patch(
            "/api/v1/newsletter/preferences/update-token",
            json={
                "name": "New Name",
                "goal_ids": ["resilience", "leadership"],
                "send_time": "evening",
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "New Name"
        assert data["goal_ids"] == ["resilience", "leadership"]
        assert data["send_time"] == "evening"

        db_session.refresh(subscriber)
        assert subscriber.name == "New Name"

    def test_update_preferences_partial(self, client, db_session):
        """Test partial update of preferences."""
        subscriber = Subscriber(
            email="partial@example.com",
            name="Original Name",
            goal_ids=["inner_peace"],
            send_time="morning",
            verified=True,
            verification_token="partial-token",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.patch(
            "/api/v1/newsletter/preferences/partial-token",
            json={"send_time": "afternoon"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Original Name"
        assert data["goal_ids"] == ["inner_peace"]
        assert data["send_time"] == "afternoon"

    def test_update_preferences_invalid_send_time(self, client, db_session):
        """Test updating with invalid send_time."""
        subscriber = Subscriber(
            email="invalidsendtime@example.com",
            verified=True,
            verification_token="invalid-time-token",
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.patch(
            "/api/v1/newsletter/preferences/invalid-time-token",
            json={"send_time": "midnight"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid send_time" in response.json()["detail"].lower()

    def test_update_preferences_unsubscribed_user(self, client, db_session):
        """Test updating preferences for unsubscribed user."""
        subscriber = Subscriber(
            email="unsubprefs@example.com",
            verified=True,
            verification_token="unsub-prefs-token",
            unsubscribed_at=datetime.utcnow(),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.patch(
            "/api/v1/newsletter/preferences/unsub-prefs-token",
            json={"name": "New Name"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "no longer active" in response.json()["detail"].lower()

    def test_update_preferences_invalid_goal_ids(self, client, db_session):
        """Test updating preferences with invalid goal IDs."""
        subscriber = Subscriber(
            email="badgoals@example.com",
            verified=True,
            verification_token="bad-goals-token",
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.patch(
            "/api/v1/newsletter/preferences/bad-goals-token",
            json={"goal_ids": ["invalid_goal"]},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid goal_ids" in response.json()["detail"].lower()

    def test_update_preferences_valid_goal_ids(self, client, db_session):
        """Test updating preferences with valid goal IDs."""
        subscriber = Subscriber(
            email="goodgoals@example.com",
            verified=True,
            verification_token="good-goals-token",
            send_time="morning",
            goal_ids=[],
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.patch(
            "/api/v1/newsletter/preferences/good-goals-token",
            json={"goal_ids": ["inner_peace", "leadership", "resilience"]},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert set(data["goal_ids"]) == {"inner_peace", "leadership", "resilience"}


class TestNewsletterEmails:
    """Tests for newsletter email functions."""

    def test_send_verification_email_success(self):
        """Test verification email sends successfully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "email-123"}

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@geetanjali.app"

                from services.email import send_newsletter_verification_email

                result = send_newsletter_verification_email(
                    email="test@example.com",
                    name="Test User",
                    verify_url="https://example.com/verify/token123",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()
                call_args = mock_resend.Emails.send.call_args[0][0]
                assert call_args["to"] == ["test@example.com"]
                assert "Daily Wisdom" in call_args["subject"]

    def test_send_verification_email_no_service(self):
        """Test verification email returns False when service unavailable."""
        with patch("services.email.service._get_resend", return_value=None):
            from services.email import send_newsletter_verification_email

            result = send_newsletter_verification_email(
                email="test@example.com",
                name=None,
                verify_url="https://example.com/verify/token",
            )

            assert result is False

    def test_send_welcome_email_success(self):
        """Test welcome email sends successfully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "welcome-123"}

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@geetanjali.app"

                from services.email import send_newsletter_welcome_email

                result = send_newsletter_welcome_email(
                    email="test@example.com",
                    name="Test User",
                    unsubscribe_url="https://example.com/unsubscribe/token",
                    preferences_url="https://example.com/preferences/token",
                )

                assert result is True
                mock_resend.Emails.send.assert_called_once()

    def test_send_welcome_email_without_name(self):
        """Test welcome email works without name."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "welcome-456"}

        with patch("services.email.service._get_resend", return_value=mock_resend):
            with patch("services.email.service.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@geetanjali.app"

                from services.email import send_newsletter_welcome_email

                result = send_newsletter_welcome_email(
                    email="test@example.com",
                    name=None,
                    unsubscribe_url="https://example.com/unsubscribe/token",
                    preferences_url="https://example.com/preferences/token",
                )

                assert result is True


class TestSubscriberModel:
    """Tests for Subscriber model properties."""

    def test_is_active_verified_not_unsubscribed(self, db_session):
        """Test is_active returns True for verified, active subscriber."""
        subscriber = Subscriber(
            email="active@example.com",
            verified=True,
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        assert subscriber.is_active is True

    def test_is_active_not_verified(self, db_session):
        """Test is_active returns False for unverified subscriber."""
        subscriber = Subscriber(
            email="unverified@example.com",
            verified=False,
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        assert subscriber.is_active is False

    def test_is_active_unsubscribed(self, db_session):
        """Test is_active returns False for unsubscribed subscriber."""
        subscriber = Subscriber(
            email="unsubscribed@example.com",
            verified=True,
            unsubscribed_at=datetime.utcnow(),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        assert subscriber.is_active is False

    def test_subscriber_repr(self, db_session):
        """Test subscriber string representation."""
        active_sub = Subscriber(
            email="repr@example.com",
            verified=True,
            send_time="morning",
        )
        inactive_sub = Subscriber(
            email="inactive@example.com",
            verified=False,
            send_time="morning",
        )

        assert "active" in repr(active_sub)
        assert "inactive" in repr(inactive_sub)
