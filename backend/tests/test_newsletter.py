"""Tests for newsletter subscription endpoints."""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status

from models import Subscriber

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test."""
    from api.dependencies import limiter

    # Clear the in-memory storage to reset rate limits
    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()
    yield


# =============================================================================
# Subscribe Endpoint Tests
# =============================================================================


class TestSubscribe:
    """Tests for POST /api/v1/newsletter/subscribe."""

    def test_subscribe_new_user_success(self, client, db_session):
        """Test successful new subscription."""
        with patch("api.newsletter.send_newsletter_verification_email") as mock_send:
            mock_send.return_value = True

            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={
                    "email": "new@example.com",
                    "name": "Test User",
                    "goal_ids": ["inner_peace", "resilience"],
                    "send_time": "morning",
                },
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["requires_verification"] is True
            assert "check your email" in data["message"].lower()

            # Verify subscriber created in database
            subscriber = (
                db_session.query(Subscriber)
                .filter(Subscriber.email == "new@example.com")
                .first()
            )
            assert subscriber is not None
            assert subscriber.name == "Test User"
            assert subscriber.goal_ids == ["inner_peace", "resilience"]
            assert subscriber.send_time == "morning"
            assert subscriber.verified is False
            assert subscriber.verification_token is not None

    def test_subscribe_email_normalized_to_lowercase(self, client, db_session):
        """Test email is normalized to lowercase."""
        with patch("api.newsletter.send_newsletter_verification_email"):
            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": "TEST@EXAMPLE.COM", "send_time": "morning"},
            )

            assert response.status_code == status.HTTP_200_OK

            subscriber = (
                db_session.query(Subscriber)
                .filter(Subscriber.email == "test@example.com")
                .first()
            )
            assert subscriber is not None

    def test_subscribe_already_verified(self, client, db_session):
        """Test subscribing when already verified returns appropriate message."""
        # Create verified subscriber
        subscriber = Subscriber(
            email="verified@example.com",
            verified=True,
            verified_at=datetime.utcnow(),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.post(
            "/api/v1/newsletter/subscribe",
            json={"email": "verified@example.com", "send_time": "morning"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["requires_verification"] is False
        assert "already subscribed" in data["message"].lower()

    def test_subscribe_pending_verification_resends(self, client, db_session):
        """Test subscribing with pending verification resends email."""
        # Create unverified subscriber
        old_token = "old-token-123"
        subscriber = Subscriber(
            email="pending@example.com",
            verified=False,
            verification_token=old_token,
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        with patch("api.newsletter.send_newsletter_verification_email") as mock_send:
            mock_send.return_value = True

            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={
                    "email": "pending@example.com",
                    "name": "Updated Name",
                    "send_time": "evening",
                },
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["requires_verification"] is True

            # Verify token was regenerated
            db_session.refresh(subscriber)
            assert subscriber.verification_token != old_token
            assert subscriber.name == "Updated Name"
            assert subscriber.send_time == "evening"

    def test_subscribe_reactivate_unsubscribed(self, client, db_session):
        """Test resubscribing after unsubscribe."""
        # Create unsubscribed subscriber
        subscriber = Subscriber(
            email="unsub@example.com",
            verified=True,
            unsubscribed_at=datetime.utcnow(),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        with patch("api.newsletter.send_newsletter_verification_email") as mock_send:
            mock_send.return_value = True

            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": "unsub@example.com", "send_time": "afternoon"},
            )

            assert response.status_code == status.HTTP_200_OK

            # Verify reactivated
            db_session.refresh(subscriber)
            assert subscriber.unsubscribed_at is None
            assert subscriber.verified is False  # Must re-verify
            assert subscriber.send_time == "afternoon"

    def test_subscribe_invalid_send_time(self, client):
        """Test subscribing with invalid send_time returns error."""
        response = client.post(
            "/api/v1/newsletter/subscribe",
            json={"email": "test@example.com", "send_time": "midnight"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid send_time" in response.json()["detail"].lower()

    def test_subscribe_invalid_email(self, client):
        """Test subscribing with invalid email format."""
        response = client.post(
            "/api/v1/newsletter/subscribe",
            json={"email": "not-an-email", "send_time": "morning"},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_subscribe_default_values(self, client, db_session):
        """Test subscription uses default values when not provided."""
        with patch("api.newsletter.send_newsletter_verification_email"):
            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": "defaults@example.com"},
            )

            assert response.status_code == status.HTTP_200_OK

            subscriber = (
                db_session.query(Subscriber)
                .filter(Subscriber.email == "defaults@example.com")
                .first()
            )
            assert subscriber.send_time == "morning"  # default
            assert subscriber.goal_ids == []  # default empty list

    def test_subscribe_invalid_goal_ids(self, client):
        """Test subscribing with invalid goal IDs returns error."""
        response = client.post(
            "/api/v1/newsletter/subscribe",
            json={
                "email": "goals@example.com",
                "goal_ids": ["invalid_goal", "also_invalid"],
                "send_time": "morning",
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid goal_ids" in response.json()["detail"].lower()

    def test_subscribe_mixed_valid_invalid_goals(self, client):
        """Test subscribing with mix of valid and invalid goals."""
        response = client.post(
            "/api/v1/newsletter/subscribe",
            json={
                "email": "mixgoals@example.com",
                "goal_ids": ["inner_peace", "fake_goal"],  # "inner_peace" is valid
                "send_time": "morning",
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "fake_goal" in response.json()["detail"]

    def test_subscribe_valid_goal_ids(self, client, db_session):
        """Test subscribing with valid goal IDs succeeds."""
        with patch("api.newsletter.send_newsletter_verification_email"):
            response = client.post(
                "/api/v1/newsletter/subscribe",
                json={
                    "email": "validgoals@example.com",
                    "goal_ids": [
                        "inner_peace",
                        "resilience",
                    ],  # Valid goals from taxonomy
                    "send_time": "morning",
                },
            )

            assert response.status_code == status.HTTP_200_OK

            subscriber = (
                db_session.query(Subscriber)
                .filter(Subscriber.email == "validgoals@example.com")
                .first()
            )
            assert set(subscriber.goal_ids) == {"inner_peace", "resilience"}

    def test_subscribe_race_condition_integrity_error(self, client, db_session):
        """Test race condition handling when IntegrityError occurs on duplicate email.

        When two requests simultaneously try to create a subscriber with the same email,
        the second commit will raise IntegrityError. This tests that the error is handled
        gracefully by re-fetching the existing subscriber.
        """
        from sqlalchemy.exc import IntegrityError
        from sqlalchemy.orm import Session

        email = "race@example.com"

        # First, create the subscriber that will exist when we retry
        existing_subscriber = Subscriber(
            email=email,
            verified=True,
            verification_token="existing-token",
            send_time="morning",
        )
        db_session.add(existing_subscriber)
        db_session.commit()

        # Track commit calls to simulate race condition
        original_commit = Session.commit
        call_count = [0]

        def mock_commit(self):
            call_count[0] += 1
            # On the first commit (creating new subscriber), raise IntegrityError
            # to simulate another request having just created it
            if call_count[0] == 1:
                # Create a mock SQL error with proper format
                raise IntegrityError(
                    statement="INSERT INTO subscribers",
                    params={},
                    orig=Exception("duplicate key value violates unique constraint"),
                )
            return original_commit(self)

        with patch("api.newsletter.send_newsletter_verification_email"):
            with patch.object(Session, "commit", mock_commit):
                # This request should:
                # 1. Try to create new subscriber
                # 2. Get IntegrityError on commit
                # 3. Rollback and re-fetch existing subscriber
                # 4. Return "already subscribed" message
                response = client.post(
                    "/api/v1/newsletter/subscribe",
                    json={"email": email, "send_time": "morning"},
                )

        # Should return 200 with "already subscribed" message
        assert response.status_code == 200
        data = response.json()
        assert data["requires_verification"] is False
        assert "already subscribed" in data["message"].lower()

    def test_subscribe_sequential_requests_same_email(self, client, db_session):
        """Test sequential subscribe requests for same email work correctly."""
        email = "sequential@example.com"

        with patch("api.newsletter.send_newsletter_verification_email"):
            # First request - creates new subscriber
            response1 = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": email, "send_time": "morning"},
            )
            assert response1.status_code == 200
            assert response1.json()["requires_verification"] is True

            # Second request - finds pending subscriber and resends
            response2 = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": email, "send_time": "morning"},
            )
            assert response2.status_code == 200
            assert response2.json()["requires_verification"] is True

        # Only one subscriber should exist
        count = db_session.query(Subscriber).filter(Subscriber.email == email).count()
        assert count == 1


# =============================================================================
# Verify Endpoint Tests
# =============================================================================


class TestVerify:
    """Tests for POST /api/v1/newsletter/verify/{token}."""

    def test_verify_success(self, client, db_session):
        """Test successful email verification."""
        # Create unverified subscriber with token
        subscriber = Subscriber(
            email="toverify@example.com",
            verified=False,
            verification_token="valid-token-123",
            verification_expires_at=datetime.utcnow() + timedelta(hours=24),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        with patch("api.newsletter.send_newsletter_welcome_email") as mock_send:
            mock_send.return_value = True

            response = client.post("/api/v1/newsletter/verify/valid-token-123")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["verified"] is True
            assert data["email"] == "toverify@example.com"
            assert "confirmed" in data["message"].lower()

            # Verify database updated
            db_session.refresh(subscriber)
            assert subscriber.verified is True
            assert subscriber.verified_at is not None

    def test_verify_invalid_token(self, client):
        """Test verification with invalid token."""
        response = client.post("/api/v1/newsletter/verify/invalid-token")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "invalid" in response.json()["detail"].lower()

    def test_verify_expired_token(self, client, db_session):
        """Test verification with expired token."""
        subscriber = Subscriber(
            email="expired@example.com",
            verified=False,
            verification_token="expired-token",
            verification_expires_at=datetime.utcnow() - timedelta(hours=1),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.post("/api/v1/newsletter/verify/expired-token")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "expired" in response.json()["detail"].lower()

    def test_verify_already_verified(self, client, db_session):
        """Test verification when already verified."""
        subscriber = Subscriber(
            email="alreadyverified@example.com",
            verified=True,
            verified_at=datetime.utcnow(),
            verification_token="some-token",
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.post("/api/v1/newsletter/verify/some-token")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["verified"] is True
        assert "already" in data["message"].lower()


# =============================================================================
# Unsubscribe Endpoint Tests
# =============================================================================


class TestUnsubscribe:
    """Tests for POST /api/v1/newsletter/unsubscribe/{token}."""

    def test_unsubscribe_success(self, client, db_session):
        """Test successful unsubscribe."""
        subscriber = Subscriber(
            email="tounsub@example.com",
            verified=True,
            verification_token="unsub-token",
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.post("/api/v1/newsletter/unsubscribe/unsub-token")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "tounsub@example.com"
        assert "unsubscribed" in data["message"].lower()

        # Verify soft delete
        db_session.refresh(subscriber)
        assert subscriber.unsubscribed_at is not None

    def test_unsubscribe_invalid_token(self, client):
        """Test unsubscribe with invalid token."""
        response = client.post("/api/v1/newsletter/unsubscribe/invalid-token")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unsubscribe_already_unsubscribed(self, client, db_session):
        """Test unsubscribing when already unsubscribed."""
        subscriber = Subscriber(
            email="alreadyunsub@example.com",
            verified=True,
            verification_token="already-unsub-token",
            unsubscribed_at=datetime.utcnow(),
            send_time="morning",
        )
        db_session.add(subscriber)
        db_session.commit()

        response = client.post("/api/v1/newsletter/unsubscribe/already-unsub-token")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "already" in data["message"].lower()


# =============================================================================
# Preferences Endpoint Tests
# =============================================================================


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

        # Verify database updated
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

        # Only update send_time
        response = client.patch(
            "/api/v1/newsletter/preferences/partial-token",
            json={"send_time": "afternoon"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Original Name"  # unchanged
        assert data["goal_ids"] == ["inner_peace"]  # unchanged
        assert data["send_time"] == "afternoon"  # updated

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


# =============================================================================
# Email Service Mock Tests
# =============================================================================


class TestNewsletterEmails:
    """Tests for newsletter email functions."""

    def test_send_verification_email_success(self):
        """Test verification email sends successfully."""
        mock_resend = MagicMock()
        mock_resend.Emails.send.return_value = {"id": "email-123"}

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
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
        with patch("services.email._get_resend", return_value=None):
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

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
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

        with patch("services.email._get_resend", return_value=mock_resend):
            with patch("services.email.settings") as mock_settings:
                mock_settings.CONTACT_EMAIL_FROM = "noreply@geetanjali.app"

                from services.email import send_newsletter_welcome_email

                result = send_newsletter_welcome_email(
                    email="test@example.com",
                    name=None,
                    unsubscribe_url="https://example.com/unsubscribe/token",
                    preferences_url="https://example.com/preferences/token",
                )

                assert result is True


# =============================================================================
# Subscriber Model Tests
# =============================================================================


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
