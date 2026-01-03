"""Output repository for database operations."""

from sqlalchemy.orm import Session

from db.repositories.base import BaseRepository
from models.output import Output


class OutputRepository(BaseRepository[Output]):
    """Repository for output operations."""

    def __init__(self, db: Session):
        super().__init__(Output, db)

    def get_by_case_id(self, case_id: str) -> list[Output]:
        """
        Get all outputs for a case, ordered by creation date (newest first).

        Args:
            case_id: Case ID

        Returns:
            List of outputs
        """
        return (
            self.db.query(Output)
            .filter(Output.case_id == case_id)
            .order_by(Output.created_at.desc())
            .all()
        )

    def get_by_case_id_ascending(self, case_id: str) -> list[Output]:
        """
        Get all outputs for a case, ordered by creation date (oldest first).

        Args:
            case_id: Case ID

        Returns:
            List of outputs
        """
        return (
            self.db.query(Output)
            .filter(Output.case_id == case_id)
            .order_by(Output.created_at.asc())
            .all()
        )

    def get_flagged_for_review(self, skip: int = 0, limit: int = 100) -> list[Output]:
        """
        Get outputs flagged for scholar review.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of flagged outputs
        """
        return (
            self.db.query(Output)
            .filter(Output.scholar_flag == True)  # noqa: E712
            .order_by(Output.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_unreviewed(self, skip: int = 0, limit: int = 100) -> list[Output]:
        """
        Get outputs that are flagged but not yet reviewed.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            List of unreviewed outputs
        """
        return (
            self.db.query(Output)
            .filter(
                Output.scholar_flag == True,  # noqa: E712
                Output.reviewed_at.is_(None),
            )
            .order_by(Output.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
