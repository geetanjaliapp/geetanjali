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

import json
import os
import uuid
from unittest.mock import patch

# Disable Redis caching before importing app (must be before config import)
os.environ["REDIS_ENABLED"] = "false"
# Skip vector store tests (require ChromaDB infrastructure)
os.environ["SKIP_VECTOR_TESTS"] = "true"
# Disable rate limiting for tests (allow multiple case creation in same test)
os.environ["ANALYZE_RATE_LIMIT"] = "1000/hour"  # Very generous for tests
os.environ["FOLLOW_UP_RATE_LIMIT"] = "1000/hour"  # Very generous for tests
os.environ["DAILY_CONSULT_LIMIT_ENABLED"] = "false"  # Disable daily cap for tests

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db import get_db
from main import app


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
    reason="Test requires PostgreSQL JSONB features (SQLite used in CI)",
)


# Import all models to register them with Base.metadata
# These imports are required to register models with SQLAlchemy Base.metadata
from models import (  # noqa: F401
    Base,  # noqa: F401
    Case,
    DhyanamVerse,
    Feedback,
    Message,
    Output,
    RefreshToken,
    Subscriber,
    User,
    Verse,
)
from models.contact import ContactMessage  # noqa: F401
from models.metadata import BookMetadata, ChapterMetadata  # noqa: F401
from models.multipass import MultiPassConsultation, MultiPassPassResponse  # noqa: F401
from models.principle import Principle, PrincipleGroup  # noqa: F401
from models.seo_page import SeoPage  # noqa: F401
from models.sync_hash import SyncHash  # noqa: F401
from models.user_preferences import UserPreferences  # noqa: F401

# Use in-memory SQLite with StaticPool for single connection across threads
# If DATABASE_URL is set (CI environment), use PostgreSQL
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    # CI mode: use PostgreSQL
    TEST_DATABASE_URL = DATABASE_URL
    engine = create_engine(TEST_DATABASE_URL)
else:
    # Local mode: use SQLite in-memory
    TEST_DATABASE_URL = "sqlite:///:memory:"
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

# Create test session factory
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# In-memory cache for tests (since Redis is disabled)
class InMemoryCache:
    """Simple in-memory cache implementation for tests."""

    def __init__(self) -> None:
        self._store: dict = {}

    def get(self, key: str):
        """Get value from cache."""
        return self._store.get(key)

    def set(self, key: str, value, ttl: int) -> bool:
        """Set value in cache (ignores ttl for simplicity in tests)."""
        self._store[key] = value
        return True

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if key in self._store:
            del self._store[key]
            return True
        return False

    def invalidate_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        import fnmatch
        keys_to_delete = [k for k in self._store.keys() if fnmatch.fnmatch(k, pattern)]
        for key in keys_to_delete:
            del self._store[key]
        return len(keys_to_delete)

    def is_available(self) -> bool:
        """Cache is always available in tests."""
        return True

    def setnx(self, key: str, value, ttl: int) -> bool:
        """Set only if key doesn't exist."""
        if key not in self._store:
            self._store[key] = value
            return True
        return False

    def incr(self, key: str, ttl: int = 0) -> int:
        """Increment counter."""
        current: int = self._store.get(key, 0)  # type: ignore[assignment]
        new_value = current + 1
        self._store[key] = new_value
        return new_value

    def get_int(self, key: str) -> int:
        """Get integer value from cache."""
        value = self._store.get(key)
        if value is None:
            return 0
        return int(value)

    def clear(self) -> None:
        """Clear all cache entries."""
        self._store.clear()


# Global test cache instance
test_cache = InMemoryCache()


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    # Drop all tables first to ensure clean state (important for PostgreSQL CI)
    Base.metadata.drop_all(bind=engine)

    # Create all tables fresh
    Base.metadata.create_all(bind=engine)

    # Create session
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function", autouse=True)
def mock_cache(request):
    """Patch the cache service to use in-memory cache during integration tests.

    Skip this fixture for unit tests that mock the cache directly.
    """
    # Only apply mock cache for integration tests and API tests that use the cache
    # Skip for unit tests that patch Redis client directly
    if "unit" in request.keywords:
        # Unit tests can mock Redis client directly, don't override cache
        yield None
        return

    test_cache.clear()  # Clear cache before each test
    with patch("services.cache.cache", test_cache):
        # Also patch it where it might be imported directly
        with patch("api.follow_up.cache", test_cache):
            yield test_cache


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


@pytest.fixture(autouse=True)
def mock_background_tasks():
    """
    Mock background task execution to prevent tasks from running during tests.

    This prevents both RQ and BackgroundTasks from executing.
    Tests can manually trigger background work if needed.
    """
    def mock_enqueue_task(*args, **kwargs):
        """Return None to indicate RQ is not available."""
        return None

    def mock_add_task(*args, **kwargs):
        """Prevent BackgroundTasks from executing."""
        return None

    with (
        patch("services.tasks.enqueue_task", side_effect=mock_enqueue_task),
        patch("fastapi.BackgroundTasks.add_task", side_effect=mock_add_task),
    ):
        yield


@pytest.fixture(autouse=True)
def mock_email_sending():
    """
    Globally mock all email sending functions to prevent real emails during tests.

    This fixture runs automatically for all tests to ensure no actual emails
    are sent to Resend or any other email service.
    """
    with (
        patch("api.auth.send_account_verification_email", return_value=True),
        patch("api.auth.send_password_changed_email", return_value=True),
        patch("api.auth.send_account_deleted_email", return_value=True),
        patch("api.newsletter.send_newsletter_verification_email", return_value=True),
    ):
        yield


@pytest.fixture(scope="function")
def seeded_principles(db_session):
    """
    Seed principle groups and principles into the test database.

    This fixture must be used by tests that require principle data
    (e.g., taxonomy API tests).
    """
    from data.principles import get_principle_groups, get_principles

    # Seed groups first (required for FK)
    for group_data in get_principle_groups():
        group = PrincipleGroup(
            id=group_data["id"],
            label=group_data["label"],
            sanskrit=group_data["sanskrit"],
            transliteration=group_data["transliteration"],
            description=group_data["description"],
            display_order=group_data.get("display_order") or 0,
        )
        db_session.add(group)

    db_session.flush()

    # Seed principles
    for p_data in get_principles():
        principle = Principle(
            id=p_data["id"],
            label=p_data["label"],
            short_label=p_data["shortLabel"],
            sanskrit=p_data["sanskrit"],
            transliteration=p_data["transliteration"],
            description=p_data["description"],
            leadership_context=p_data["leadershipContext"],
            group_id=p_data["group"],
            keywords=p_data["keywords"],
            chapter_focus=p_data["chapterFocus"],
            display_order=p_data.get("display_order") or 0,
        )
        db_session.add(principle)

    db_session.commit()

    return {"groups": 4, "principles": 16}


@pytest.fixture(scope="function")
def client_with_principles(db_session, seeded_principles):
    """Create a test client with seeded principle data."""

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


@pytest.fixture(scope="function")
def case_with_output(db_session):
    """
    Create a case with a completed consultation output for follow-up tests.

    This fixture creates:
    - A case with basic details and a fixed session_id
    - A completed output with LLM response and verses
    - Allows follow-up endpoint tests to work
    - Tests should provide X-Session-ID header with the session_id from this fixture
    """
    # Use a fixed session ID that tests can use
    session_id = "test-session-follow-up-123"

    # Create case with session_id (allows anonymous user access)
    case = Case(
        id=str(uuid.uuid4()),
        title="Test case for follow-ups",
        description="A test dilemma for follow-up testing",
        status="completed",
        session_id=session_id,
    )
    db_session.add(case)
    db_session.flush()

    # Create output with valid JSON structure
    output_data = {
        "summary": "Test summary",
        "analysis": "Test analysis",
        "verses": [
            {
                "verse_id": "1.1",
                "verse_text": "Test verse",
                "translation": "Test translation",
                "commentary": "Test commentary",
            }
        ],
        "action_items": ["Item 1"],
    }

    output = Output(
        id=str(uuid.uuid4()),
        case_id=case.id,
        result_json=json.dumps(output_data),
    )
    db_session.add(output)
    db_session.commit()

    # Return case with session_id for test access
    case.session_id = session_id
    return case
