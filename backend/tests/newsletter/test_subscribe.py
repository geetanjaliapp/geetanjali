"""Tests for newsletter subscribe endpoint."""

from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import status

from models import Subscriber

pytestmark = pytest.mark.integration


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

            db_session.refresh(subscriber)
            assert subscriber.verification_token != old_token
            assert subscriber.name == "Updated Name"
            assert subscriber.send_time == "evening"

    def test_subscribe_reactivate_unsubscribed(self, client, db_session):
        """Test resubscribing after unsubscribe."""
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

            db_session.refresh(subscriber)
            assert subscriber.unsubscribed_at is None
            assert subscriber.verified is False
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
            assert subscriber.send_time == "morning"
            assert subscriber.goal_ids == []

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
                "goal_ids": ["inner_peace", "fake_goal"],
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
                    "goal_ids": ["inner_peace", "resilience"],
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
        """Test race condition handling when IntegrityError occurs on duplicate email."""
        from sqlalchemy.exc import IntegrityError
        from sqlalchemy.orm import Session

        email = "race@example.com"

        existing_subscriber = Subscriber(
            email=email,
            verified=True,
            verification_token="existing-token",
            send_time="morning",
        )
        db_session.add(existing_subscriber)
        db_session.commit()

        original_commit = Session.commit
        call_count = [0]

        def mock_commit(self):
            call_count[0] += 1
            if call_count[0] == 1:
                raise IntegrityError(
                    statement="INSERT INTO subscribers",
                    params={},
                    orig=Exception("duplicate key value violates unique constraint"),
                )
            return original_commit(self)

        with patch("api.newsletter.send_newsletter_verification_email"):
            with patch.object(Session, "commit", mock_commit):
                response = client.post(
                    "/api/v1/newsletter/subscribe",
                    json={"email": email, "send_time": "morning"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["requires_verification"] is False
        assert "already subscribed" in data["message"].lower()

    def test_subscribe_sequential_requests_same_email(self, client, db_session):
        """Test sequential subscribe requests for same email work correctly."""
        email = "sequential@example.com"

        with patch("api.newsletter.send_newsletter_verification_email"):
            response1 = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": email, "send_time": "morning"},
            )
            assert response1.status_code == 200
            assert response1.json()["requires_verification"] is True

            response2 = client.post(
                "/api/v1/newsletter/subscribe",
                json={"email": email, "send_time": "morning"},
            )
            assert response2.status_code == 200
            assert response2.json()["requires_verification"] is True

        count = db_session.query(Subscriber).filter(Subscriber.email == email).count()
        assert count == 1
