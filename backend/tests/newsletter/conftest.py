"""Shared fixtures for newsletter tests."""

import pytest


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test."""
    from api.dependencies import limiter

    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()
    yield
