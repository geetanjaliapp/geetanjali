"""Canonical verse reference search strategy.

Handles exact lookups by verse reference:
- BG_2_47, BG-2-47
- 2.47, 2:47, 2-47
- chapter 2 verse 47

This is the fastest and most precise search strategy.
"""

from typing import List

from sqlalchemy.orm import Session

from models.verse import Verse
from ..types import MatchType, SearchMatch, SearchResult
from ..utils import verse_to_result


def canonical_search(
    db: Session,
    chapter: int,
    verse: int,
) -> List[SearchResult]:
    """Search by exact canonical verse reference.

    Args:
        db: Database session
        chapter: Chapter number (1-18)
        verse: Verse number within chapter

    Returns:
        List with single result if found, empty list otherwise
    """
    canonical_id = f"BG_{chapter}_{verse}"

    verse_obj = db.query(Verse).filter(Verse.canonical_id == canonical_id).first()

    if not verse_obj:
        return []

    return [
        verse_to_result(
            verse_obj,
            SearchMatch(
                type=MatchType.EXACT_CANONICAL,
                field="canonical_id",
                score=1.0,
                highlight=canonical_id,
            ),
        )
    ]
