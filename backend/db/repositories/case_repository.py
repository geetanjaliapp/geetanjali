"""Case repository for database operations."""

from typing import List, Optional
from sqlalchemy.orm import Session

from models.case import Case
from db.repositories.base import BaseRepository


class CaseRepository(BaseRepository[Case]):  # type: ignore[type-var]
    """Repository for case operations."""

    def __init__(self, db: Session):
        super().__init__(Case, db)

    def get_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[Case]:
        """
        Get all non-deleted cases for a user.

        Args:
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of cases (excluding soft-deleted)
        """
        return (
            self.db.query(Case)
            .filter(Case.user_id == user_id, Case.is_deleted == False)  # noqa: E712
            .order_by(Case.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_session(
        self, session_id: str, skip: int = 0, limit: int = 100
    ) -> List[Case]:
        """
        Get all non-deleted cases for an anonymous session.

        Args:
            session_id: Session ID
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of cases (excluding soft-deleted)
        """
        return (
            self.db.query(Case)
            .filter(
                Case.session_id == session_id,
                Case.user_id.is_(None),
                Case.is_deleted == False,  # noqa: E712
            )
            .order_by(Case.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_sensitivity(
        self, sensitivity: str, skip: int = 0, limit: int = 100
    ) -> List[Case]:
        """
        Get cases by sensitivity level.

        Args:
            sensitivity: Sensitivity level (low/medium/high)
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of cases
        """
        return (
            self.db.query(Case)
            .filter(Case.sensitivity == sensitivity)
            .order_by(Case.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def migrate_session_to_user(self, session_id: str, user_id: str) -> int:
        """
        Migrate all anonymous session cases to a user account.

        This is called when an anonymous user signs up or logs in,
        transferring ownership of their session-based consultations.

        Args:
            session_id: The session ID to migrate from
            user_id: The target user ID

        Returns:
            Number of cases migrated
        """
        count = (
            self.db.query(Case)
            .filter(Case.session_id == session_id, Case.user_id.is_(None))
            .update(
                {
                    "user_id": user_id,
                    "session_id": None,  # Clear session ID after migration
                }
            )
        )
        self.db.commit()
        return count

    def get_by_public_slug(self, slug: str) -> Optional[Case]:
        """
        Get a case by its public slug.

        Args:
            slug: The public slug (e.g., "abc123xyz")

        Returns:
            Case if found, None otherwise
        """
        return self.db.query(Case).filter(Case.public_slug == slug).first()

    def get_public_cases(self, skip: int = 0, limit: int = 100) -> List[Case]:
        """
        Get all public cases.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of public cases
        """
        return (
            self.db.query(Case)
            .filter(Case.is_public == True)  # noqa: E712
            .order_by(Case.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def soft_delete(self, case_id: str) -> Optional[Case]:
        """
        Soft delete a case by setting is_deleted=True.

        Also makes the case private (is_public=False) to prevent
        continued access via public slug.

        Args:
            case_id: Case ID to soft delete

        Returns:
            Updated case if found, None otherwise
        """
        case = self.get(case_id)
        if case:
            case.is_deleted = True
            case.is_public = False  # Make private on delete
            self.db.commit()
            self.db.refresh(case)
        return case

    def mark_stale_processing_as_failed(self, timeout_minutes: int = 10) -> int:
        """
        Mark cases stuck in 'processing' status as 'failed'.

        Cases that have been in 'processing' status longer than timeout
        are considered stuck and should be marked as failed so users can retry.

        Args:
            timeout_minutes: Minutes after which processing is considered stale

        Returns:
            Number of cases marked as failed
        """
        from datetime import datetime, timedelta
        from models.case import CaseStatus

        cutoff = datetime.utcnow() - timedelta(minutes=timeout_minutes)

        count = (
            self.db.query(Case)
            .filter(
                Case.status == CaseStatus.PROCESSING.value,
                Case.updated_at < cutoff,
            )
            .update({"status": CaseStatus.FAILED.value})
        )
        self.db.commit()
        return count
