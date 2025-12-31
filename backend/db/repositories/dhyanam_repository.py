"""Dhyanam verse repository for database operations."""

from sqlalchemy.orm import Session

from db.repositories.base import BaseRepository
from models import DhyanamVerse


class DhyanamRepository(BaseRepository[DhyanamVerse]):  # type: ignore[type-var]
    """Repository for Geeta Dhyanam verse operations."""

    def __init__(self, db: Session):
        super().__init__(DhyanamVerse, db)

    def get_by_verse_number(self, verse_number: int) -> DhyanamVerse | None:
        """
        Get dhyanam verse by verse number.

        Args:
            verse_number: Verse number (1-9)

        Returns:
            DhyanamVerse or None if not found
        """
        return (
            self.db.query(DhyanamVerse)
            .filter(DhyanamVerse.verse_number == verse_number)
            .first()
        )

    def get_all_ordered(self) -> list[DhyanamVerse]:
        """
        Get all 9 dhyanam verses ordered by verse number.

        Returns:
            List of dhyanam verses in order
        """
        return self.db.query(DhyanamVerse).order_by(DhyanamVerse.verse_number).all()

    def count(self) -> int:
        """
        Get total count of dhyanam verses.

        Returns:
            Count of verses (should be 9)
        """
        from sqlalchemy import func

        result = self.db.query(func.count(DhyanamVerse.id)).scalar()
        return result if result else 0
