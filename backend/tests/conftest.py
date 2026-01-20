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
from models.user_preferences import UserPreferences  # noqa: F401

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
