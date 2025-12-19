"""Tests for newsletter worker job and scheduler."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from jobs.newsletter import send_subscriber_digest, _mask_email, IDEMPOTENCY_WINDOW_SECONDS
from jobs.newsletter_scheduler import (
    schedule_daily_digests,
    get_active_subscribers,
    _acquire_scheduler_lock,
    _release_scheduler_lock,
)


# =============================================================================
# Test _mask_email helper
# =============================================================================


class TestMaskEmail:
    """Tests for email masking helper."""

    def test_masks_normal_email(self):
        """Test masking a normal email address."""
        assert _mask_email("john.doe@example.com") == "j******e@example.com"

    def test_masks_short_local_part(self):
        """Test masking with short local part."""
        assert _mask_email("ab@example.com") == "**@example.com"

    def test_masks_single_char_local(self):
        """Test masking with single character local part."""
        assert _mask_email("a@example.com") == "*@example.com"

    def test_handles_empty_string(self):
        """Test handling empty string."""
        assert _mask_email("") == "***"

    def test_handles_invalid_email(self):
        """Test handling string without @."""
        assert _mask_email("notanemail") == "***"

    def test_handles_none(self):
        """Test handling None input."""
        assert _mask_email(None) == "***"


# =============================================================================
# Test send_subscriber_digest - Input Validation
# =============================================================================


class TestSendSubscriberDigestValidation:
    """Tests for input validation in worker job."""

    def test_invalid_subscriber_id_format(self):
        """Test rejection of invalid subscriber_id format."""
        result = send_subscriber_digest("not-a-uuid", "morning")

        assert result["status"] == "failed"
        assert "Invalid subscriber_id format" in result["error"]

    def test_empty_subscriber_id(self):
        """Test rejection of empty subscriber_id."""
        result = send_subscriber_digest("", "morning")

        assert result["status"] == "failed"
        assert "Invalid subscriber_id format" in result["error"]

    def test_invalid_send_time(self):
        """Test rejection of invalid send_time."""
        result = send_subscriber_digest(
            "12345678-1234-1234-1234-123456789012",
            "midnight"
        )

        assert result["status"] == "failed"
        assert "Invalid send_time" in result["error"]


# =============================================================================
# Test send_subscriber_digest - Subscriber States
# =============================================================================


class TestSendSubscriberDigestStates:
    """Tests for handling different subscriber states."""

    @patch("jobs.newsletter.SessionLocal")
    def test_subscriber_not_found(self, mock_session):
        """Test handling when subscriber doesn't exist."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_session.return_value = mock_db

        result = send_subscriber_digest(
            "12345678-1234-1234-1234-123456789012",
            "morning"
        )

        assert result["status"] == "skipped"
        assert result["error"] == "Subscriber not found"
        mock_db.close.assert_called_once()

    @patch("jobs.newsletter.SessionLocal")
    def test_subscriber_not_active(self, mock_session):
        """Test handling when subscriber is not active."""
        mock_subscriber = MagicMock()
        mock_subscriber.is_active = False
        mock_subscriber.email = "test@example.com"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_subscriber
        mock_session.return_value = mock_db

        result = send_subscriber_digest(
            "12345678-1234-1234-1234-123456789012",
            "morning"
        )

        assert result["status"] == "skipped"
        assert result["error"] == "Subscriber not active"
        mock_db.close.assert_called_once()

    @patch("jobs.newsletter.SessionLocal")
    def test_idempotency_check_skips_recent(self, mock_session):
        """Test that recently sent subscribers are skipped."""
        mock_subscriber = MagicMock()
        mock_subscriber.is_active = True
        mock_subscriber.last_verse_sent_at = datetime.utcnow() - timedelta(minutes=30)
        mock_subscriber.email = "test@example.com"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_subscriber
        mock_session.return_value = mock_db

        result = send_subscriber_digest(
            "12345678-1234-1234-1234-123456789012",
            "morning"
        )

        assert result["status"] == "skipped"
        assert result["error"] == "Already sent recently"
        mock_db.close.assert_called_once()

    @patch("jobs.newsletter.SessionLocal")
    def test_idempotency_allows_after_window(self, mock_session):
        """Test that subscribers outside idempotency window are processed."""
        mock_subscriber = MagicMock()
        mock_subscriber.is_active = True
        mock_subscriber.id = "12345678-1234-1234-1234-123456789012"
        mock_subscriber.email = "test@example.com"
        mock_subscriber.verses_sent_30d = []
        mock_subscriber.verses_sent_count = 5
        mock_subscriber.goal_ids = []
        mock_subscriber.verification_token = "token123"
        # Sent more than 1 hour ago
        mock_subscriber.last_verse_sent_at = datetime.utcnow() - timedelta(hours=2)

        mock_verse = MagicMock()
        mock_verse.canonical_id = "BG_2_47"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_subscriber
        mock_session.return_value = mock_db

        with patch("jobs.newsletter.select_verse_for_subscriber", return_value=mock_verse):
            with patch("jobs.newsletter.send_newsletter_digest_email", return_value=True):
                result = send_subscriber_digest(
                    "12345678-1234-1234-1234-123456789012",
                    "morning"
                )

        # Should proceed to send (or at least past idempotency check)
        assert result["status"] != "skipped" or result["error"] != "Already sent recently"


# =============================================================================
# Test send_subscriber_digest - Email Sending
# =============================================================================


class TestSendSubscriberDigestEmail:
    """Tests for email sending logic."""

    @patch("jobs.newsletter.SessionLocal")
    @patch("jobs.newsletter.select_verse_for_subscriber")
    @patch("jobs.newsletter.send_newsletter_digest_email")
    def test_email_send_success(self, mock_send, mock_select, mock_session):
        """Test successful email send updates tracking."""
        mock_subscriber = MagicMock()
        mock_subscriber.is_active = True
        mock_subscriber.id = "12345678-1234-1234-1234-123456789012"
        mock_subscriber.email = "test@example.com"
        mock_subscriber.name = "Test User"
        mock_subscriber.verses_sent_30d = []
        mock_subscriber.verses_sent_count = 5
        mock_subscriber.goal_ids = []
        mock_subscriber.verification_token = "token123"
        mock_subscriber.last_verse_sent_at = None

        mock_verse = MagicMock()
        mock_verse.canonical_id = "BG_2_47"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_subscriber
        mock_session.return_value = mock_db

        mock_select.return_value = mock_verse
        mock_send.return_value = True

        result = send_subscriber_digest(
            "12345678-1234-1234-1234-123456789012",
            "morning"
        )

        assert result["status"] == "sent"
        assert result["verse_id"] == "BG_2_47"
        mock_db.commit.assert_called_once()
        mock_db.close.assert_called_once()

    @patch("jobs.newsletter.SessionLocal")
    @patch("jobs.newsletter.select_verse_for_subscriber")
    @patch("jobs.newsletter.send_newsletter_digest_email")
    def test_email_send_failure_raises(self, mock_send, mock_select, mock_session):
        """Test email send failure raises exception for retry."""
        mock_subscriber = MagicMock()
        mock_subscriber.is_active = True
        mock_subscriber.id = "12345678-1234-1234-1234-123456789012"
        mock_subscriber.email = "test@example.com"
        mock_subscriber.name = "Test"
        mock_subscriber.verses_sent_30d = []
        mock_subscriber.verses_sent_count = 0
        mock_subscriber.goal_ids = []
        mock_subscriber.verification_token = "token"
        mock_subscriber.last_verse_sent_at = None

        mock_verse = MagicMock()
        mock_verse.canonical_id = "BG_2_47"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_subscriber
        mock_session.return_value = mock_db

        mock_select.return_value = mock_verse
        mock_send.return_value = False  # Email fails

        with pytest.raises(Exception) as exc_info:
            send_subscriber_digest(
                "12345678-1234-1234-1234-123456789012",
                "morning"
            )

        assert "Email send failed" in str(exc_info.value)
        mock_db.close.assert_called_once()

    @patch("jobs.newsletter.SessionLocal")
    @patch("jobs.newsletter.select_verse_for_subscriber")
    @patch("jobs.newsletter.send_newsletter_digest_email")
    def test_tracking_failure_does_not_retry(self, mock_send, mock_select, mock_session):
        """Test tracking update failure doesn't trigger retry (email was sent)."""
        mock_subscriber = MagicMock()
        mock_subscriber.is_active = True
        mock_subscriber.id = "12345678-1234-1234-1234-123456789012"
        mock_subscriber.email = "test@example.com"
        mock_subscriber.name = "Test"
        mock_subscriber.verses_sent_30d = []
        mock_subscriber.verses_sent_count = 0
        mock_subscriber.goal_ids = []
        mock_subscriber.verification_token = "token"
        mock_subscriber.last_verse_sent_at = None

        mock_verse = MagicMock()
        mock_verse.canonical_id = "BG_2_47"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_subscriber
        mock_db.commit.side_effect = Exception("DB Error")  # Commit fails
        mock_session.return_value = mock_db

        mock_select.return_value = mock_verse
        mock_send.return_value = True  # Email succeeds

        # Should NOT raise (would cause duplicate email on retry)
        result = send_subscriber_digest(
            "12345678-1234-1234-1234-123456789012",
            "morning"
        )

        assert result["status"] == "sent_tracking_failed"
        assert result["error"] == "Tracking update failed"
        mock_db.rollback.assert_called_once()
        mock_db.close.assert_called_once()


# =============================================================================
# Test schedule_daily_digests
# =============================================================================


class TestScheduleDailyDigests:
    """Tests for scheduler function."""

    def test_invalid_send_time_raises(self):
        """Test invalid send_time raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            schedule_daily_digests("midnight")

        assert "Invalid send_time" in str(exc_info.value)

    @patch("jobs.newsletter_scheduler.SessionLocal")
    @patch("jobs.newsletter_scheduler._acquire_scheduler_lock")
    @patch("jobs.newsletter_scheduler.is_rq_available")
    def test_lock_already_held_skips(self, mock_rq, mock_lock, mock_session):
        """Test scheduler skips when lock is held."""
        mock_lock.return_value = False

        stats = schedule_daily_digests("morning")

        assert stats["status"] == "skipped"
        assert stats["error"] == "Lock held by another process"
        mock_session.assert_not_called()

    @patch("jobs.newsletter_scheduler.SessionLocal")
    @patch("jobs.newsletter_scheduler._acquire_scheduler_lock")
    @patch("jobs.newsletter_scheduler._release_scheduler_lock")
    @patch("jobs.newsletter_scheduler.is_rq_available")
    def test_rq_unavailable_returns_error(self, mock_rq, mock_release, mock_lock, mock_session):
        """Test scheduler returns error when RQ unavailable."""
        mock_lock.return_value = True
        mock_rq.return_value = False

        stats = schedule_daily_digests("morning")

        assert stats["error"] == "RQ unavailable"
        mock_release.assert_called_once_with("morning")

    @patch("jobs.newsletter_scheduler.SessionLocal")
    @patch("jobs.newsletter_scheduler._acquire_scheduler_lock")
    @patch("jobs.newsletter_scheduler._release_scheduler_lock")
    @patch("jobs.newsletter_scheduler.is_rq_available")
    @patch("jobs.newsletter_scheduler.get_active_subscribers")
    def test_no_subscribers_returns_early(
        self, mock_get_subs, mock_rq, mock_release, mock_lock, mock_session
    ):
        """Test scheduler returns early when no subscribers found."""
        mock_lock.return_value = True
        mock_rq.return_value = True
        mock_get_subs.return_value = []

        mock_db = MagicMock()
        mock_session.return_value = mock_db

        stats = schedule_daily_digests("morning")

        assert stats["subscribers_found"] == 0
        assert stats["jobs_queued"] == 0

    @patch("jobs.newsletter_scheduler.SessionLocal")
    @patch("jobs.newsletter_scheduler._acquire_scheduler_lock")
    @patch("jobs.newsletter_scheduler._release_scheduler_lock")
    @patch("jobs.newsletter_scheduler.is_rq_available")
    @patch("jobs.newsletter_scheduler.get_active_subscribers")
    @patch("jobs.newsletter_scheduler.enqueue_task")
    def test_enqueues_jobs_for_subscribers(
        self, mock_enqueue, mock_get_subs, mock_rq, mock_release, mock_lock, mock_session
    ):
        """Test scheduler enqueues jobs for each subscriber."""
        mock_lock.return_value = True
        mock_rq.return_value = True

        mock_sub1 = MagicMock()
        mock_sub1.id = "sub-1"
        mock_sub2 = MagicMock()
        mock_sub2.id = "sub-2"
        mock_get_subs.return_value = [mock_sub1, mock_sub2]

        mock_enqueue.return_value = "job-id-123"

        mock_db = MagicMock()
        mock_session.return_value = mock_db

        stats = schedule_daily_digests("morning")

        assert stats["subscribers_found"] == 2
        assert stats["jobs_queued"] == 2
        assert stats["jobs_failed"] == 0
        assert mock_enqueue.call_count == 2

    @patch("jobs.newsletter_scheduler.get_active_subscribers")
    def test_dry_run_does_not_enqueue(self, mock_get_subscribers):
        """Test dry run mode doesn't actually enqueue jobs."""
        mock_sub = MagicMock()
        mock_sub.id = "sub-1"
        mock_get_subscribers.return_value = [mock_sub]

        with patch("jobs.newsletter_scheduler.enqueue_task") as mock_enqueue:
            stats = schedule_daily_digests("morning", dry_run=True)

        # Should NOT call enqueue in dry run
        mock_enqueue.assert_not_called()
        assert stats["jobs_queued"] == 1  # Counted but not actually queued


# =============================================================================
# Test get_active_subscribers
# =============================================================================


@pytest.mark.integration
class TestGetActiveSubscribers:
    """Integration tests for subscriber query."""

    def test_filters_by_verified(self, db_session):
        """Test only verified subscribers are returned."""
        from models import Subscriber

        # Create verified subscriber
        verified = Subscriber(
            email="verified@test.com",
            verified=True,
            send_time="morning",
        )
        # Create unverified subscriber
        unverified = Subscriber(
            email="unverified@test.com",
            verified=False,
            send_time="morning",
        )
        db_session.add_all([verified, unverified])
        db_session.commit()

        result = get_active_subscribers(db_session, "morning")

        emails = [s.email for s in result]
        assert "verified@test.com" in emails
        assert "unverified@test.com" not in emails

    def test_filters_by_send_time(self, db_session):
        """Test only subscribers matching send_time are returned."""
        from models import Subscriber

        morning = Subscriber(
            email="morning@test.com",
            verified=True,
            send_time="morning",
        )
        evening = Subscriber(
            email="evening@test.com",
            verified=True,
            send_time="evening",
        )
        db_session.add_all([morning, evening])
        db_session.commit()

        result = get_active_subscribers(db_session, "morning")

        emails = [s.email for s in result]
        assert "morning@test.com" in emails
        assert "evening@test.com" not in emails

    def test_excludes_unsubscribed(self, db_session):
        """Test unsubscribed users are excluded."""
        from models import Subscriber

        active = Subscriber(
            email="active@test.com",
            verified=True,
            send_time="morning",
        )
        unsub = Subscriber(
            email="unsub@test.com",
            verified=True,
            send_time="morning",
            unsubscribed_at=datetime.utcnow(),
        )
        db_session.add_all([active, unsub])
        db_session.commit()

        result = get_active_subscribers(db_session, "morning")

        emails = [s.email for s in result]
        assert "active@test.com" in emails
        assert "unsub@test.com" not in emails
