"""Sanskrit text search strategy.

Handles searches in:
- Devanagari script (कर्म)
- IAST transliteration (karmaṇy)
- ASCII approximations (karmany)

Supports partial matching and diacritic normalization.
"""

from typing import List

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models.verse import Verse
from ..config import SearchConfig
from ..parser import QueryParser
from ..types import MatchType, SearchMatch, SearchResult
from ..utils import escape_like_pattern, highlight_match, verse_to_result


def sanskrit_search(
    db: Session,
    query: str,
    config: SearchConfig,
    parser: QueryParser,
) -> List[SearchResult]:
    """Search by Sanskrit text (Devanagari or IAST).

    Searches in both sanskrit_iast and sanskrit_devanagari fields.
    Also tries normalized ASCII matching for IAST queries.

    Args:
        db: Database session
        query: Sanskrit search query
        config: Search configuration
        parser: Query parser instance for normalization

    Returns:
        List of matching verses sorted by relevance
    """
    results: List[SearchResult] = []

    # Escape special SQL LIKE characters
    escaped_query = escape_like_pattern(query)
    search_pattern = f"%{escaped_query}%"

    # Normalize query for fuzzy IAST matching
    query_normalized = parser.normalize_iast(query)

    # Build filter with multiple match conditions
    verses = (
        db.query(Verse)
        .filter(
            or_(
                # Exact substring match in IAST
                Verse.sanskrit_iast.ilike(search_pattern),
                # Exact substring match in Devanagari
                Verse.sanskrit_devanagari.ilike(search_pattern),
                # Normalized match (ā → a, etc.)
                func.lower(Verse.sanskrit_iast).contains(query_normalized),
            )
        )
        .order_by(Verse.chapter, Verse.verse)
        .limit(config.limit)
        .all()
    )

    for verse in verses:
        # Determine which field matched for highlight
        matched_field = "sanskrit_iast"
        matched_text = verse.sanskrit_iast or ""

        if verse.sanskrit_devanagari and query in (verse.sanskrit_devanagari or ""):
            matched_field = "sanskrit_devanagari"
            matched_text = verse.sanskrit_devanagari

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.EXACT_SANSKRIT,
                    field=matched_field,
                    score=0.95,
                    highlight=highlight_match(matched_text, query),
                ),
            )
        )

    return results
