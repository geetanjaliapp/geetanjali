"""
Circuit Breaker pattern implementation for service resilience.

This module provides a reusable circuit breaker base class that can be
extended for different services (email, LLM, database, etc.).

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Too many failures, requests rejected immediately
- HALF_OPEN: Testing recovery, limited requests allowed

Usage:
    class MyServiceCircuitBreaker(CircuitBreaker):
        def _update_metric(self, state: str) -> None:
            my_metric.set({"closed": 0, "half_open": 1, "open": 2}[state])

    breaker = MyServiceCircuitBreaker(name="my-service", failure_threshold=5)
    if breaker.allow_request():
        try:
            result = call_service()
            breaker.record_success()
        except Exception:
            breaker.record_failure()
            raise
"""

import logging
import time
from abc import ABC, abstractmethod
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)


class CircuitBreakerOpen(Exception):
    """
    Circuit breaker is open - service temporarily disabled.

    Raised when too many consecutive failures have occurred.
    The circuit will automatically close after the recovery timeout.
    """

    def __init__(self, name: str, recovery_timeout: float):
        self.name = name
        self.recovery_timeout = recovery_timeout
        super().__init__(
            f"Circuit breaker '{name}' is open. "
            f"Will retry in {recovery_timeout:.0f}s"
        )


class CircuitBreaker(ABC):
    """
    Abstract base class for circuit breaker implementations.

    Thread-safe state machine that prevents hammering failing services.
    Subclasses must implement _update_metric() to record state changes.

    Attributes:
        name: Identifier for logging and metrics
        failure_threshold: Consecutive failures before opening
        recovery_timeout: Seconds before testing recovery
    """

    # State constants
    STATE_CLOSED = "closed"
    STATE_OPEN = "open"
    STATE_HALF_OPEN = "half_open"

    # Numeric values for metrics
    STATE_VALUES = {
        STATE_CLOSED: 0,
        STATE_HALF_OPEN: 1,
        STATE_OPEN: 2,
    }

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
    ):
        """
        Initialize circuit breaker.

        Args:
            name: Identifier for logging and metrics (e.g., "email", "llm-anthropic")
            failure_threshold: Consecutive failures before opening circuit
            recovery_timeout: Seconds to wait before testing recovery
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._state = self.STATE_CLOSED
        self._lock = Lock()

    @property
    def state(self) -> str:
        """Get current circuit state (closed, open, half_open)."""
        with self._lock:
            self._check_recovery_timeout()
            return self._state

    @property
    def failure_count(self) -> int:
        """Get current failure count."""
        with self._lock:
            return self._failure_count

    def _check_recovery_timeout(self) -> None:
        """
        Check if recovery timeout has passed and transition to half_open.

        Must be called while holding self._lock.
        """
        if self._state == self.STATE_OPEN:
            if (
                self._last_failure_time
                and time.time() - self._last_failure_time >= self.recovery_timeout
            ):
                logger.info(
                    f"Circuit breaker '{self.name}' transitioning to HALF_OPEN "
                    f"after {self.recovery_timeout:.0f}s recovery timeout"
                )
                self._state = self.STATE_HALF_OPEN
                self._update_metric(self._state)

    def record_success(self) -> None:
        """Record successful request - reset circuit to closed."""
        with self._lock:
            was_half_open = self._state == self.STATE_HALF_OPEN
            self._failure_count = 0
            self._state = self.STATE_CLOSED
            self._update_metric(self._state)
            if was_half_open:
                logger.info(
                    f"Circuit breaker '{self.name}' CLOSED after successful probe"
                )

    def record_failure(self) -> None:
        """Record failed request - may open circuit."""
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == self.STATE_HALF_OPEN:
                # Failed during probe - reopen immediately
                logger.warning(
                    f"Circuit breaker '{self.name}' OPEN after failed probe"
                )
                self._state = self.STATE_OPEN
            elif self._failure_count >= self.failure_threshold:
                if self._state != self.STATE_OPEN:
                    logger.warning(
                        f"Circuit breaker '{self.name}' OPEN after "
                        f"{self._failure_count} consecutive failures. "
                        f"Will retry in {self.recovery_timeout:.0f}s"
                    )
                self._state = self.STATE_OPEN

            self._update_metric(self._state)

    def allow_request(self) -> bool:
        """
        Check if request should be allowed through.

        Thread-safe: all state checks and transitions happen under lock.

        Returns:
            True if request should proceed, False if circuit is open

        Note:
            In half_open state, we allow multiple concurrent requests rather
            than a single probe. This is a simplification acceptable for
            services with reasonable request rates.
        """
        with self._lock:
            self._check_recovery_timeout()
            return self._state in (self.STATE_CLOSED, self.STATE_HALF_OPEN)

    def reset(self) -> None:
        """Manually reset circuit to closed state (primarily for testing)."""
        with self._lock:
            self._failure_count = 0
            self._last_failure_time = None
            self._state = self.STATE_CLOSED
            self._update_metric(self._state)

    @abstractmethod
    def _update_metric(self, state: str) -> None:
        """
        Update Prometheus metric for circuit breaker state.

        Subclasses must implement this to update their specific metrics.

        Args:
            state: Current state to record (passed explicitly for thread safety)
        """
        pass

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"name='{self.name}', "
            f"state='{self._state}', "
            f"failures={self._failure_count}/{self.failure_threshold})"
        )
