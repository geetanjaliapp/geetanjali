"""Case repository for database operations."""

from typing import List
from sqlalchemy.orm import Session

from models.case import Case
from db.repositories.base import BaseRepository


class CaseRepository(BaseRepository[Case]):
    """Repository for case operations."""

    def __init__(self, db: Session):
        super().__init__(Case, db)

    def get_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[Case]:
        """
        Get all cases for a user.

        Args:
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of cases
        """
        return (
            self.db.query(Case)
            .filter(Case.user_id == user_id)
            .order_by(Case.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_session(self, session_id: str, skip: int = 0, limit: int = 100) -> List[Case]:
        """
        Get all cases for an anonymous session.

        Args:
            session_id: Session ID
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of cases
        """
        return (
            self.db.query(Case)
            .filter(Case.session_id == session_id, Case.user_id.is_(None))
            .order_by(Case.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_sensitivity(self, sensitivity: str, skip: int = 0, limit: int = 100) -> List[Case]:
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
            .update({
                "user_id": user_id,
                "session_id": None  # Clear session ID after migration
            })
        )
        self.db.commit()
        return count
