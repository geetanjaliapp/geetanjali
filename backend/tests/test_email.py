"""Tests for email service."""

from unittest.mock import MagicMock, patch

import pytest

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
        from services.email import EmailConfigurationError, send_newsletter_digest_email

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
        from services.email import EmailServiceUnavailable, send_newsletter_digest_email

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


class TestEmailCircuitBreaker:
    """Tests for email circuit breaker functionality."""

    def test_circuit_breaker_initial_state(self):
        """Test circuit breaker starts in closed state."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker()
        assert cb.state == "closed"
        assert cb.allow_request() is True

    def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker opens after threshold failures."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=3, recovery_timeout=60)

        # Record failures up to threshold
        cb.record_failure()
        assert cb.state == "closed"
        cb.record_failure()
        assert cb.state == "closed"
        cb.record_failure()  # Third failure should open circuit
        assert cb.state == "open"
        assert cb.allow_request() is False

    def test_circuit_breaker_resets_on_success(self):
        """Test circuit breaker resets to closed on success."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=3)

        # Accumulate some failures
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"

        # Success should reset counter
        cb.record_success()
        assert cb.state == "closed"

        # Need full threshold again to open
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"

    def test_circuit_breaker_half_open_after_timeout(self):
        """Test circuit breaker transitions to half_open after recovery timeout."""
        import time

        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for recovery timeout
        time.sleep(0.15)

        # Should be half_open now
        assert cb.state == "half_open"
        assert cb.allow_request() is True

    def test_circuit_breaker_half_open_success_closes(self):
        """Test successful request in half_open state closes circuit."""
        import time

        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for half-open
        time.sleep(0.15)
        assert cb.state == "half_open"

        # Success should close circuit
        cb.record_success()
        assert cb.state == "closed"
        assert cb._failure_count == 0

    def test_circuit_breaker_half_open_failure_reopens(self):
        """Test failed request in half_open state reopens circuit."""
        import time

        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for half-open
        time.sleep(0.15)
        assert cb.state == "half_open"

        # Failures in half-open should reopen (need threshold failures)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"


class TestEmailRetryDecorator:
    """Tests for email retry decorator."""

    def test_retry_success_on_first_attempt(self):
        """Test successful email send on first attempt."""
        from services.email import get_circuit_breaker, with_email_retry

        # Reset circuit breaker
        get_circuit_breaker().reset()

        call_count = 0

        @with_email_retry(max_retries=2, use_circuit_breaker=False)
        def mock_send_email() -> bool:
            nonlocal call_count
            call_count += 1
            return True

        result = mock_send_email()
        assert result is True
        assert call_count == 1

    def test_retry_success_after_failure(self):
        """Test successful email send after transient failure."""
        from services.email import get_circuit_breaker, with_email_retry

        get_circuit_breaker().reset()

        call_count = 0

        @with_email_retry(max_retries=2, base_delay=0.01, use_circuit_breaker=False)
        def mock_send_email() -> bool:
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise Exception("Transient error")
            return True

        result = mock_send_email()
        assert result is True
        assert call_count == 2  # First failed, second succeeded

    def test_retry_exhausted(self):
        """Test email fails after all retries exhausted."""
        from services.email import get_circuit_breaker, with_email_retry

        get_circuit_breaker().reset()

        call_count = 0

        @with_email_retry(max_retries=2, base_delay=0.01, use_circuit_breaker=False)
        def mock_send_email() -> bool:
            nonlocal call_count
            call_count += 1
            raise Exception("Persistent error")

        result = mock_send_email()
        assert result is False
        assert call_count == 3  # Initial + 2 retries

    def test_circuit_breaker_blocks_requests(self):
        """Test circuit breaker blocks requests when open."""
        from services.email import get_circuit_breaker, with_email_retry

        cb = get_circuit_breaker()
        cb.reset()

        # Open the circuit manually
        for _ in range(5):
            cb.record_failure()

        assert cb.state == "open"

        call_count = 0

        @with_email_retry(max_retries=2, use_circuit_breaker=True)
        def mock_send_email() -> bool:
            nonlocal call_count
            call_count += 1
            return True

        result = mock_send_email()
        assert result is False
        assert call_count == 0  # Never called due to open circuit

        # Reset for other tests
        cb.reset()

    def test_retry_aborts_when_circuit_opens_during_retry(self):
        """Test retry aborts if circuit opens between attempts."""
        from services.email import get_circuit_breaker, with_email_retry

        cb = get_circuit_breaker()
        cb.reset()

        call_count = 0

        @with_email_retry(max_retries=3, base_delay=0.01, use_circuit_breaker=True)
        def mock_send_email() -> bool:
            nonlocal call_count
            call_count += 1

            # Open circuit on second attempt by simulating external failures
            if call_count == 2:
                for _ in range(5):
                    cb.record_failure()

            raise Exception("Transient failure")

        result = mock_send_email()
        assert result is False
        # Should have stopped after attempt 2 when circuit opened
        assert call_count == 2

        # Reset for other tests
        cb.reset()

    def test_retry_records_metrics(self):
        """Test that retry decorator records Prometheus metrics."""
        from services.email import get_circuit_breaker, with_email_retry
        from utils.metrics import email_sends_total

        cb = get_circuit_breaker()
        cb.reset()

        # Get initial metric value (may not exist yet)
        try:
            initial = email_sends_total.labels(
                email_type="test_metrics", result="success"
            )._value.get()
        except Exception:
            initial = 0

        @with_email_retry(max_retries=0, use_circuit_breaker=False)
        def send_test_metrics_email() -> bool:
            return True

        send_test_metrics_email()

        # Check metric was incremented
        after = email_sends_total.labels(
            email_type="test_metrics", result="success"
        )._value.get()
        assert after == initial + 1
