"""Principle-based search strategy.

Filters verses by consulting principles (topic tags).
Uses PostgreSQL JSONB contains operator for efficient querying.

Principles include: karma_yoga, detachment, duty_focused_action, etc.
"""

from sqlalchemy import cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from models.verse import Verse

from ..config import SearchConfig
from ..types import MatchType, SearchMatch, SearchResult
from ..utils import verse_to_result


def principle_search(
    db: Session,
    principle: str,
    config: SearchConfig,
) -> list[SearchResult]:
    """Search verses by principle/topic tag.

    Uses PostgreSQL JSONB contains operator for efficient array search.

    Args:
        db: Database session
        principle: Principle tag to filter by (e.g., "detachment")
        config: Search configuration with limits

    Returns:
        List of verses tagged with the specified principle
    """
    # Use JSONB contains for efficient array search
    # consulting_principles @> '["detachment"]'::jsonb
    verses = (
        db.query(Verse)
        .filter(Verse.consulting_principles.isnot(None))
        .filter(cast(Verse.consulting_principles, JSONB).contains([principle]))
        .order_by(Verse.chapter, Verse.verse)
        .limit(config.limit)
        .all()
    )

    return [
        verse_to_result(
            verse,
            SearchMatch(
                type=MatchType.PRINCIPLE,
                field="consulting_principles",
                score=0.65,
                highlight=principle,
            ),
        )
        for verse in verses
    ]
