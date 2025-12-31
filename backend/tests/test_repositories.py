"""Tests for database repositories."""

import uuid
from datetime import datetime, timedelta

import pytest

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration

from db.repositories.case_repository import CaseRepository
from db.repositories.user_repository import UserRepository
from models.case import Case, CaseStatus


class TestCaseRepository:
    """Tests for CaseRepository."""

    def test_create_case(self, db_session):
        """Test creating a case."""
        repo = CaseRepository(db_session)

        case_data = {
            "id": str(uuid.uuid4()),
            "title": "Test Case",
            "description": "Test description",
            "status": CaseStatus.DRAFT.value,
        }

        case = repo.create(case_data)

        assert case is not None
        assert case.title == "Test Case"
        assert case.description == "Test description"
        assert case.status == CaseStatus.DRAFT.value

    def test_get_case_by_id(self, db_session):
        """Test getting a case by ID."""
        repo = CaseRepository(db_session)

        case_id = str(uuid.uuid4())
        case_data = {
            "id": case_id,
            "title": "Test Case",
            "description": "Test description",
        }

        repo.create(case_data)
        retrieved_case = repo.get(case_id)

        assert retrieved_case is not None
        assert retrieved_case.id == case_id
        assert retrieved_case.title == "Test Case"

    def test_get_by_session(self, db_session):
        """Test getting cases by session ID."""
        repo = CaseRepository(db_session)

        session_id = str(uuid.uuid4())

        # Create case for session
        repo.create(
            {
                "id": str(uuid.uuid4()),
                "title": "Session Case",
                "description": "Test",
                "session_id": session_id,
                "user_id": None,
            }
        )

        cases = repo.get_by_session(session_id)

        assert len(cases) == 1
        assert cases[0].session_id == session_id

    def test_get_by_public_slug(self, db_session):
        """Test getting case by public slug."""
        repo = CaseRepository(db_session)

        slug = "test123abc"
        repo.create(
            {
                "id": str(uuid.uuid4()),
                "title": "Public Case",
                "description": "Test",
                "public_slug": slug,
                "is_public": True,
            }
        )

        case = repo.get_by_public_slug(slug)

        assert case is not None
        assert case.public_slug == slug
        assert case.is_public is True

    def test_soft_delete(self, db_session):
        """Test soft deleting a case."""
        repo = CaseRepository(db_session)

        case_id = str(uuid.uuid4())
        repo.create(
            {
                "id": case_id,
                "title": "To Delete",
                "description": "Test",
                "is_public": True,
            }
        )

        deleted_case = repo.soft_delete(case_id)

        assert deleted_case.is_deleted is True
        assert deleted_case.is_public is False

    def test_migrate_session_to_user(self, db_session):
        """Test migrating session cases to user."""
        case_repo = CaseRepository(db_session)
        user_repo = UserRepository(db_session)

        # Create user
        user_id = str(uuid.uuid4())
        user_repo.create(
            {
                "id": user_id,
                "email": "test@example.com",
                "name": "Test User",
                "password_hash": "hash123",
            }
        )

        # Create session case
        session_id = str(uuid.uuid4())
        case_repo.create(
            {
                "id": str(uuid.uuid4()),
                "title": "Session Case",
                "description": "Test",
                "session_id": session_id,
                "user_id": None,
            }
        )

        # Migrate
        count = case_repo.migrate_session_to_user(session_id, user_id)

        assert count == 1

        # Verify migration
        user_cases = case_repo.get_by_user(user_id)
        assert len(user_cases) == 1
        assert user_cases[0].user_id == user_id
        assert user_cases[0].session_id is None

    def test_mark_stale_processing_as_failed(self, db_session):
        """Test marking stale processing cases as failed."""
        repo = CaseRepository(db_session)

        # Create a case that's been processing for too long
        case_id = str(uuid.uuid4())
        case = Case(
            id=case_id,
            title="Stuck Case",
            description="Test",
            status=CaseStatus.PROCESSING.value,
        )
        db_session.add(case)
        db_session.commit()

        # Manually set updated_at to 15 minutes ago
        case.updated_at = datetime.utcnow() - timedelta(minutes=15)
        db_session.commit()

        # Mark stale as failed (10 min timeout)
        count = repo.mark_stale_processing_as_failed(timeout_minutes=10)

        assert count == 1

        # Verify case is now failed
        updated_case = repo.get(case_id)
        assert updated_case.status == CaseStatus.FAILED.value


class TestUserRepository:
    """Tests for UserRepository."""

    def test_create_user(self, db_session):
        """Test creating a user."""
        repo = UserRepository(db_session)

        user_data = {
            "id": str(uuid.uuid4()),
            "email": "test@example.com",
            "name": "Test User",
            "password_hash": "hashed_password_123",
        }

        user = repo.create(user_data)

        assert user is not None
        assert user.email == "test@example.com"

    def test_get_by_email(self, db_session):
        """Test getting user by email."""
        repo = UserRepository(db_session)

        email = "unique@example.com"
        repo.create(
            {
                "id": str(uuid.uuid4()),
                "email": email,
                "name": "Unique User",
                "password_hash": "hash",
            }
        )

        user = repo.get_by_email(email)

        assert user is not None
        assert user.email == email

    def test_get_by_email_not_found(self, db_session):
        """Test getting non-existent user by email returns None."""
        repo = UserRepository(db_session)

        user = repo.get_by_email("nonexistent@example.com")

        assert user is None
