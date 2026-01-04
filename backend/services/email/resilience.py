"""Email service resilience: circuit breaker and retry decorator."""

import logging
import time
from collections.abc import Callable
from functools import wraps

from config import settings
from utils.circuit_breaker import CircuitBreaker
from utils.metrics_events import (
    email_circuit_breaker_state,
    email_send_duration_seconds,
    email_sends_total,
)

from .exceptions import EmailConfigurationError, EmailServiceUnavailable

logger = logging.getLogger(__name__)


# =============================================================================
# Circuit Breaker
# =============================================================================


class EmailCircuitBreaker(CircuitBreaker):
    """
    Circuit breaker for email service resilience.

    Extends the base CircuitBreaker with email-specific Prometheus metrics.

    States:
    - CLOSED: Normal operation, emails sent normally
    - OPEN: Too many failures, emails rejected immediately
    - HALF_OPEN: Testing if service recovered (one request allowed)
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
    ):
        """
        Initialize email circuit breaker.

        Args:
            failure_threshold: Consecutive failures before opening circuit
            recovery_timeout: Seconds to wait before testing recovery
        """
        super().__init__(
            name="email",
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )

    def _update_metric(self, state: str) -> None:
        """Update Prometheus metric for email circuit breaker state."""
        email_circuit_breaker_state.set(self.STATE_VALUES.get(state, 0))


# Global circuit breaker instance (uses config settings)
_email_circuit_breaker: EmailCircuitBreaker | None = None


def get_circuit_breaker() -> EmailCircuitBreaker:
    """Get the global email circuit breaker instance (lazy initialization)."""
    global _email_circuit_breaker
    if _email_circuit_breaker is None:
        _email_circuit_breaker = EmailCircuitBreaker(
            failure_threshold=settings.CB_EMAIL_FAILURE_THRESHOLD,
            recovery_timeout=float(settings.CB_EMAIL_RECOVERY_TIMEOUT),
        )
    return _email_circuit_breaker


# =============================================================================
# Retry Decorator
# =============================================================================


def with_email_retry(
    max_retries: int = 2,
    base_delay: float = 1.0,
    use_circuit_breaker: bool = True,
) -> Callable[[Callable[..., bool]], Callable[..., bool]]:
    """
    Decorator for email functions with retry and circuit breaker.

    Features:
    - Exponential backoff: delay doubles each retry (1s, 2s, 4s...)
    - Circuit breaker integration: stops retrying when service is down
    - Prometheus metrics for monitoring
    - Logs retry attempts with context

    Args:
        max_retries: Maximum retry attempts (default 2, so 3 total tries)
        base_delay: Initial delay in seconds (default 1.0)
        use_circuit_breaker: Whether to use circuit breaker (default True)

    Returns:
        Decorated function

    Example:
        @with_email_retry(max_retries=2)
        def send_important_email(email: str) -> bool:
            ...
    """

    def decorator(func: Callable[..., bool]) -> Callable[..., bool]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> bool:
            circuit = get_circuit_breaker() if use_circuit_breaker else None
            # Extract email type from function name (e.g., send_password_reset_email -> password_reset)
            email_type = func.__name__.replace("send_", "").replace("_email", "")

            # Check circuit breaker before attempting
            if circuit and not circuit.allow_request():
                logger.warning(f"Email circuit breaker OPEN - skipping {func.__name__}")
                email_sends_total.labels(
                    email_type=email_type, result="circuit_open"
                ).inc()
                return False

            start_time = time.time()

            for attempt in range(max_retries + 1):
                try:
                    result = func(*args, **kwargs)

                    # Record duration for all completed sends (success or config failure)
                    email_send_duration_seconds.labels(email_type=email_type).observe(
                        time.time() - start_time
                    )

                    # Record success if we got True
                    if result:
                        if circuit:
                            circuit.record_success()
                        email_sends_total.labels(
                            email_type=email_type, result="success"
                        ).inc()
                    else:
                        # Function returned False (e.g., not configured)
                        email_sends_total.labels(
                            email_type=email_type, result="failure"
                        ).inc()

                    return result

                except (EmailConfigurationError, EmailServiceUnavailable):
                    # Non-retryable errors - don't retry
                    email_sends_total.labels(
                        email_type=email_type, result="failure"
                    ).inc()
                    raise

                except Exception as e:
                    # Record failure for circuit breaker
                    if circuit:
                        circuit.record_failure()

                    # Check if more retries available
                    if attempt < max_retries:
                        delay = base_delay * (2**attempt)  # Exponential backoff
                        logger.warning(
                            f"Email send failed (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {delay:.1f}s: {e}"
                        )
                        time.sleep(delay)

                        # Re-check circuit breaker after delay
                        if circuit and not circuit.allow_request():
                            logger.warning(
                                "Email circuit breaker opened during retry - aborting"
                            )
                            email_sends_total.labels(
                                email_type=email_type, result="circuit_open"
                            ).inc()
                            return False
                    else:
                        logger.error(
                            f"Email send failed after {max_retries + 1} attempts: {e}"
                        )
                        email_sends_total.labels(
                            email_type=email_type, result="failure"
                        ).inc()

            return False

        return wrapper

    return decorator
