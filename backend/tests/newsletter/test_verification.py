"""Tests for newsletter verify and unsubscribe endpoints."""

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi import status

from models import Subscriber

pytestmark = pytest.mark.integration


class TestVerify:
    """Tests for POST /api/v1/newsletter/verify/{token}."""

    def test_verify_success(self, client, db_session):
        """Test successful email verification."""
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
