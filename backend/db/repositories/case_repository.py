"""Case repository for database operations."""

from sqlalchemy import Integer
from sqlalchemy.orm import Session

from db.repositories.base import BaseRepository
from models.case import Case, CaseStatus


class CaseRepository(BaseRepository[Case]):
    """Repository for case operations."""

    def __init__(self, db: Session):
        super().__init__(Case, db)

    def get_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 100,
        status_filter: str | None = None,
    ) -> list[Case]:
        """
        Get all non-deleted cases for a user.

        Args:
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records
            status_filter: Optional filter - "completed", "in-progress", "shared"

        Returns:
            List of cases (excluding soft-deleted)
        """
        query = self.db.query(Case).filter(
            Case.user_id == user_id,
            Case.is_deleted == False,  # noqa: E712
        )
        query = self._apply_status_filter(query, status_filter)
        result: list[Case] = (
            query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()
        )
        return result

    def _apply_status_filter(self, query, status_filter: str | None):
        """Apply status filter to query."""
        if status_filter == "completed":
            # Completed includes: completed, policy_violation, or no status (legacy)
            query = query.filter(
                Case.status.in_(
                    [
                        CaseStatus.COMPLETED.value,
                        CaseStatus.POLICY_VIOLATION.value,
                        None,
                    ]
                )
            )
        elif status_filter == "in-progress":
            # In progress: pending or processing
            query = query.filter(
                Case.status.in_([CaseStatus.PENDING.value, CaseStatus.PROCESSING.value])
            )
        elif status_filter == "failed":
            query = query.filter(Case.status == CaseStatus.FAILED.value)
        elif status_filter == "shared":
            query = query.filter(Case.is_public == True)  # noqa: E712
        # "all" or None = no additional filter
        return query

    def count_by_user(self, user_id: str) -> dict:
        """
        Get counts for all filter categories for a user.

        Args:
            user_id: User ID

        Returns:
            Dict with counts: {all, completed, in_progress, shared}
        """
        from sqlalchemy import func

        base_filter = (Case.user_id == user_id) & (Case.is_deleted == False)  # noqa: E712

        # Single query with conditional aggregation
        result = (
            self.db.query(
                func.count(Case.id).label("all"),
                func.sum(
                    func.cast(
                        Case.status.in_(
                            [
                                CaseStatus.COMPLETED.value,
                                CaseStatus.POLICY_VIOLATION.value,
                            ]
                        )
                        | Case.status.is_(None),
                        Integer,
                    )
                ).label("completed"),
                func.sum(
                    func.cast(
                        Case.status.in_(
                            [CaseStatus.PENDING.value, CaseStatus.PROCESSING.value]
                        ),
                        Integer,
                    )
                ).label("in_progress"),
                func.sum(
                    func.cast(Case.status == CaseStatus.FAILED.value, Integer)
                ).label("failed"),
                func.sum(func.cast(Case.is_public == True, Integer)).label(  # noqa: E712
                    "shared"
                ),
            )
            .filter(base_filter)
            .first()
        )

        if result is None:
            return {
                "all": 0,
                "completed": 0,
                "in_progress": 0,
                "failed": 0,
                "shared": 0,
            }

        return {
            "all": result.all or 0,
            "completed": result.completed or 0,
            "in_progress": result.in_progress or 0,
            "failed": result.failed or 0,
            "shared": result.shared or 0,
        }

    def get_by_session(
        self,
        session_id: str,
        skip: int = 0,
        limit: int = 100,
        status_filter: str | None = None,
    ) -> list[Case]:
        """
        Get all non-deleted cases for an anonymous session.

        Args:
            session_id: Session ID
            skip: Number of records to skip
            limit: Maximum number of records
            status_filter: Optional filter - "completed", "in-progress", "shared"

        Returns:
            List of cases (excluding soft-deleted)
        """
        query = self.db.query(Case).filter(
            Case.session_id == session_id,
            Case.user_id.is_(None),
            Case.is_deleted == False,  # noqa: E712
        )
        query = self._apply_status_filter(query, status_filter)
        result: list[Case] = (
            query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()
        )
        return result

    def count_by_session(self, session_id: str) -> dict:
        """
        Get counts for all filter categories for a session.

        Args:
            session_id: Session ID

        Returns:
            Dict with counts: {all, completed, in_progress, shared}
        """
        from sqlalchemy import func

        base_filter = (
            (Case.session_id == session_id)
            & Case.user_id.is_(None)
            & (Case.is_deleted == False)  # noqa: E712
        )

        result = (
            self.db.query(
                func.count(Case.id).label("all"),
                func.sum(
                    func.cast(
                        Case.status.in_(
                            [
                                CaseStatus.COMPLETED.value,
                                CaseStatus.POLICY_VIOLATION.value,
                            ]
                        )
                        | Case.status.is_(None),
                        Integer,
                    )
                ).label("completed"),
                func.sum(
                    func.cast(
                        Case.status.in_(
                            [CaseStatus.PENDING.value, CaseStatus.PROCESSING.value]
                        ),
                        Integer,
                    )
                ).label("in_progress"),
                func.sum(
                    func.cast(Case.status == CaseStatus.FAILED.value, Integer)
                ).label("failed"),
                func.sum(func.cast(Case.is_public == True, Integer)).label(  # noqa: E712
                    "shared"
                ),
            )
            .filter(base_filter)
            .first()
        )

        if result is None:
            return {
                "all": 0,
                "completed": 0,
                "in_progress": 0,
                "failed": 0,
                "shared": 0,
            }

        return {
            "all": result.all or 0,
            "completed": result.completed or 0,
            "in_progress": result.in_progress or 0,
            "failed": result.failed or 0,
            "shared": result.shared or 0,
        }

    def get_by_sensitivity(
        self, sensitivity: str, skip: int = 0, limit: int = 100
    ) -> list[Case]:
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

    def get_by_public_slug(self, slug: str) -> Case | None:
        """
        Get a case by its public slug.

        Args:
            slug: The public slug (e.g., "abc123xyz")

        Returns:
            Case if found, None otherwise
        """
        return self.db.query(Case).filter(Case.public_slug == slug).first()

    def get_public_cases(self, skip: int = 0, limit: int = 100) -> list[Case]:
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

    def soft_delete(self, case_id: str) -> Case | None:
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
