"""Verse repository for database operations."""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast
from sqlalchemy.dialects.postgresql import JSONB

from models.verse import Verse
from db.repositories.base import BaseRepository


class VerseRepository(BaseRepository[Verse]):  # type: ignore[type-var]
    """Repository for verse operations."""

    def __init__(self, db: Session):
        super().__init__(Verse, db)

    def get_by_canonical_id(self, canonical_id: str) -> Optional[Verse]:
        """
        Get verse by canonical ID.

        Args:
            canonical_id: Canonical verse ID (e.g., BG_2_47)

        Returns:
            Verse or None if not found
        """
        return self.db.query(Verse).filter(Verse.canonical_id == canonical_id).first()

    def get_by_chapter(self, chapter: int) -> List[Verse]:
        """
        Get all verses in a chapter.

        Args:
            chapter: Chapter number (1-18)

        Returns:
            List of verses
        """
        return (
            self.db.query(Verse)
            .filter(Verse.chapter == chapter)
            .order_by(Verse.verse)
            .all()
        )

    def search_by_principles(self, principles: List[str]) -> List[Verse]:
        """
        Search verses by consulting principles.

        Args:
            principles: List of principle tags

        Returns:
            List of verses matching any of the principles
        """
        if not principles:
            return []

        # Use PostgreSQL JSONB contains operator for efficient querying
        # Each principle check: consulting_principles @> '["principle"]'::jsonb
        conditions = [
            cast(Verse.consulting_principles, JSONB).contains([p])
            for p in principles
        ]

        return (
            self.db.query(Verse)
            .filter(Verse.consulting_principles.isnot(None))
            .filter(or_(*conditions))
            .all()
        )

    def get_seed_verses(self) -> List[Verse]:
        """
        Get all seed verses (high priority).

        Returns:
            List of seed verses
        """
        # For now, return all verses as we only have seed data
        return self.get_all()

    def get_with_translations(self, canonical_id: str) -> Optional[Verse]:
        """
        Get verse with translations eagerly loaded.

        Args:
            canonical_id: Canonical verse ID

        Returns:
            Verse with translations or None if not found
        """
        from sqlalchemy.orm import joinedload

        return (
            self.db.query(Verse)
            .options(joinedload(Verse.translations))
            .filter(Verse.canonical_id == canonical_id)
            .first()
        )

    def get_many_with_translations(self, canonical_ids: List[str]) -> List[Verse]:
        """
        Get multiple verses with translations eagerly loaded.

        Args:
            canonical_ids: List of canonical verse IDs

        Returns:
            List of verses with translations
        """
        from sqlalchemy.orm import joinedload

        return (
            self.db.query(Verse)
            .options(joinedload(Verse.translations))
            .filter(Verse.canonical_id.in_(canonical_ids))
            .all()
        )
