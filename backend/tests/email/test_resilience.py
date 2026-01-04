"""Tests for email circuit breaker and retry decorator."""

import time

import pytest

pytestmark = pytest.mark.unit


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

        cb.record_failure()
        assert cb.state == "closed"
        cb.record_failure()
        assert cb.state == "closed"
        cb.record_failure()
        assert cb.state == "open"
        assert cb.allow_request() is False

    def test_circuit_breaker_resets_on_success(self):
        """Test circuit breaker resets to closed on success."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=3)

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"

        cb.record_success()
        assert cb.state == "closed"

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"

    def test_circuit_breaker_half_open_after_timeout(self):
        """Test circuit breaker transitions to half_open after recovery timeout."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        time.sleep(0.15)

        assert cb.state == "half_open"
        assert cb.allow_request() is True

    def test_circuit_breaker_half_open_success_closes(self):
        """Test successful request in half_open state closes circuit."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        time.sleep(0.15)
        assert cb.state == "half_open"

        cb.record_success()
        assert cb.state == "closed"
        assert cb._failure_count == 0

    def test_circuit_breaker_half_open_failure_reopens(self):
        """Test failed request in half_open state reopens circuit."""
        from services.email import EmailCircuitBreaker

        cb = EmailCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        time.sleep(0.15)
        assert cb.state == "half_open"

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"


class TestEmailRetryDecorator:
    """Tests for email retry decorator."""

    def test_retry_success_on_first_attempt(self):
        """Test successful email send on first attempt."""
        from services.email import get_circuit_breaker, with_email_retry

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
        assert call_count == 2

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
        assert call_count == 3

    def test_circuit_breaker_blocks_requests(self):
        """Test circuit breaker blocks requests when open."""
        from services.email import get_circuit_breaker, with_email_retry

        cb = get_circuit_breaker()
        cb.reset()

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
        assert call_count == 0

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

            if call_count == 2:
                for _ in range(5):
                    cb.record_failure()

            raise Exception("Transient failure")

        result = mock_send_email()
        assert result is False
        assert call_count == 2

        cb.reset()

    def test_retry_records_metrics(self):
        """Test that retry decorator records Prometheus metrics."""
        from services.email import get_circuit_breaker, with_email_retry
        from utils.metrics import email_sends_total

        cb = get_circuit_breaker()
        cb.reset()

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

        after = email_sends_total.labels(
            email_type="test_metrics", result="success"
        )._value.get()
        assert after == initial + 1
