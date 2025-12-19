"""Pytest configuration and fixtures.

Test markers:
- @pytest.mark.unit: Fast isolated tests, no DB/external services
- @pytest.mark.integration: Tests requiring DB or service mocks
- @pytest.mark.slow: Long-running tests (skipped in quick CI)
- @pytest.mark.e2e: End-to-end tests (skipped in CI by default)

Usage:
    pytest -m "unit"                    # Run only unit tests
    pytest -m "not slow"                # Skip slow tests
    pytest -m "unit or integration"     # Run unit and integration
"""

import os

# Disable Redis caching before importing app (must be before config import)
os.environ["REDIS_ENABLED"] = "false"
# Skip vector store tests (require ChromaDB infrastructure)
os.environ["SKIP_VECTOR_TESTS"] = "true"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from db import get_db


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Fast isolated tests, no DB required")
    config.addinivalue_line(
        "markers", "integration: Tests requiring DB or external services"
    )
    config.addinivalue_line("markers", "slow: Long-running tests (skipped in quick CI)")
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests (skipped in CI by default)"
    )
    config.addinivalue_line(
        "markers", "postgresql: Tests requiring PostgreSQL features (skipped on SQLite)"
    )


# Skip marker for PostgreSQL-only tests (JSONB, etc.)
requires_postgresql = pytest.mark.skipif(
    True,  # Always skip in test suite using SQLite
    reason="Test requires PostgreSQL JSONB features (SQLite used in CI)"
)


# Import all models to register them with Base.metadata
# These imports are required to register models with SQLAlchemy Base.metadata
from models import Base  # noqa: F401
from models import User, RefreshToken, Case, Output, Message, Verse, Subscriber  # noqa: F401

# Use in-memory SQLite with StaticPool for single connection across threads
TEST_DATABASE_URL = "sqlite:///:memory:"

# Create test engine with StaticPool to share connection
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Create test session factory
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create session
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with overridden database dependency."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    # Clear overrides
    app.dependency_overrides.clear()
