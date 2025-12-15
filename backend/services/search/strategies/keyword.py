"""Keyword text search strategy.

Full-text search across:
- Translations (from Translation model) - higher priority
- Primary translation (translation_en on Verse)
- Paraphrases (paraphrase_en on Verse) - lower priority

Uses PostgreSQL ILIKE for pattern matching. Future improvement
could use ts_vector for better ranking and stemming.
"""

from typing import List, Set

from sqlalchemy.orm import Session, joinedload

from models.verse import Verse, Translation
from ..config import SearchConfig
from ..types import MatchType, SearchMatch, SearchResult
from ..utils import escape_like_pattern, highlight_match, verse_to_result


def keyword_search(
    db: Session,
    query: str,
    config: SearchConfig,
) -> List[SearchResult]:
    """Full-text keyword search on translations and paraphrases.

    Search priority:
    1. Translation model text (scholar translations)
    2. Verse.translation_en (primary translation)
    3. Verse.paraphrase_en (leadership paraphrase)

    Args:
        db: Database session
        query: Keyword search query
        config: Search configuration with filters and limits

    Returns:
        List of matching verses with deduplication
    """
    results: List[SearchResult] = []
    seen_ids: Set[str] = set()

    # Escape special SQL LIKE characters for security
    escaped_query = escape_like_pattern(query)
    search_pattern = f"%{escaped_query}%"

    # Build base query with optional chapter filter
    base_query = db.query(Verse)
    if config.chapter:
        base_query = base_query.filter(Verse.chapter == config.chapter)

    # Search in Translation model first (higher priority per alignment)
    _search_translations(
        db, base_query, query, search_pattern, config, results, seen_ids
    )

    # Search in Verse.translation_en
    _search_verse_translation(
        base_query, query, search_pattern, config, results, seen_ids
    )

    # Search in Verse.paraphrase_en (lower priority)
    _search_paraphrase(
        base_query, query, search_pattern, config, results, seen_ids
    )

    return results


def _search_translations(
    db: Session,
    base_query,
    query: str,
    search_pattern: str,
    config: SearchConfig,
    results: List[SearchResult],
    seen_ids: Set[str],
) -> None:
    """Search in Translation model (scholar translations)."""
    translation_verses = (
        base_query
        .join(Verse.translations)
        .filter(Translation.text.ilike(search_pattern))
        .options(joinedload(Verse.translations))
        .limit(config.limit)
        .all()
    )

    for verse in translation_verses:
        if verse.canonical_id in seen_ids:
            continue
        seen_ids.add(verse.canonical_id)

        # Find the matching translation for highlight
        matched_translation = None
        for trans in verse.translations:
            if trans.text and query.lower() in trans.text.lower():
                matched_translation = trans
                break

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.KEYWORD_TRANSLATION,
                    field="translation",
                    score=0.8,
                    highlight=highlight_match(
                        matched_translation.text if matched_translation else "",
                        query,
                    ),
                ),
            )
        )


def _search_verse_translation(
    base_query,
    query: str,
    search_pattern: str,
    config: SearchConfig,
    results: List[SearchResult],
    seen_ids: Set[str],
) -> None:
    """Search in Verse.translation_en (primary translation)."""
    direct_translation_verses = (
        base_query
        .filter(Verse.translation_en.ilike(search_pattern))
        .limit(config.limit)
        .all()
    )

    for verse in direct_translation_verses:
        if verse.canonical_id in seen_ids:
            continue
        seen_ids.add(verse.canonical_id)

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.KEYWORD_TRANSLATION,
                    field="translation_en",
                    score=0.8,
                    highlight=highlight_match(verse.translation_en or "", query),
                ),
            )
        )


def _search_paraphrase(
    base_query,
    query: str,
    search_pattern: str,
    config: SearchConfig,
    results: List[SearchResult],
    seen_ids: Set[str],
) -> None:
    """Search in Verse.paraphrase_en (leadership paraphrase)."""
    paraphrase_verses = (
        base_query
        .filter(Verse.paraphrase_en.ilike(search_pattern))
        .limit(config.limit)
        .all()
    )

    for verse in paraphrase_verses:
        if verse.canonical_id in seen_ids:
            continue
        seen_ids.add(verse.canonical_id)

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.KEYWORD_PARAPHRASE,
                    field="paraphrase_en",
                    score=0.7,
                    highlight=highlight_match(verse.paraphrase_en or "", query),
                ),
            )
        )
