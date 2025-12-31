"""Keyword text search strategy.

Full-text search across:
- Translations (from Translation model) - higher priority
- Primary translation (translation_en on Verse)
- Paraphrases (paraphrase_en on Verse) - lower priority

Uses hybrid OR logic: multi-word queries match verses containing ANY
keyword, ranked by how many keywords match (more matches = higher rank).
"""

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models.verse import Translation, Verse

from ..config import SearchConfig
from ..types import MatchType, SearchMatch, SearchResult
from ..utils import escape_like_pattern, highlight_match, verse_to_result

# Minimum keyword length to search (skip very short words)
MIN_KEYWORD_LENGTH = 2


def _split_query_to_keywords(query: str) -> list[str]:
    """Split query into searchable keywords.

    Filters out very short words that would match too broadly.

    Args:
        query: User search query

    Returns:
        List of keywords to search for
    """
    words = query.lower().split()
    # Filter out very short words (articles, etc.)
    return [w for w in words if len(w) >= MIN_KEYWORD_LENGTH]


def _count_keyword_matches(text: str, keywords: list[str]) -> int:
    """Count how many keywords appear in the text.

    Args:
        text: Text to search in
        keywords: List of keywords to look for

    Returns:
        Number of keywords found in text
    """
    if not text:
        return 0
    text_lower = text.lower()
    return sum(1 for kw in keywords if kw in text_lower)


def _get_best_match_count(verse: Verse, keywords: list[str]) -> tuple[int, str]:
    """Get the best match count across translations and paraphrase.

    Args:
        verse: Verse to check
        keywords: Keywords to count

    Returns:
        Tuple of (best_match_count, field_name)
    """
    best_count = 0
    best_field = "translation"

    # Check translations (includes the text that's copied to translation_en)
    if hasattr(verse, "translations") and verse.translations:
        for trans in verse.translations:
            count = _count_keyword_matches(trans.text, keywords)
            if count > best_count:
                best_count = count
                best_field = "translation"

    # Check paraphrase_en (unique leadership content)
    count = _count_keyword_matches(verse.paraphrase_en or "", keywords)
    if count > best_count:
        best_count = count
        best_field = "paraphrase_en"

    return best_count, best_field


def keyword_search(
    db: Session,
    query: str,
    config: SearchConfig,
) -> list[SearchResult]:
    """Full-text keyword search with hybrid OR logic.

    Multi-word queries use OR logic - verses matching ANY keyword are returned.
    Results are ranked by how many keywords match (more = higher rank).

    Search priority:
    1. Translation model text (scholar translations)
    2. Verse.translation_en (primary translation)
    3. Verse.paraphrase_en (leadership paraphrase)

    Args:
        db: Database session
        query: Keyword search query
        config: Search configuration with filters and limits

    Returns:
        List of matching verses with match counts for ranking
    """
    results: list[SearchResult] = []
    seen_ids: set[str] = set()

    # Split query into keywords
    keywords = _split_query_to_keywords(query)

    # If no valid keywords, fall back to original query as single keyword
    if not keywords:
        keywords = [query.lower().strip()]

    # Create OR patterns for each keyword
    keyword_patterns = [f"%{escape_like_pattern(kw)}%" for kw in keywords]

    # Build base query with optional chapter filter
    base_query = db.query(Verse)
    if config.chapter:
        base_query = base_query.filter(Verse.chapter == config.chapter)

    # Search in Verse.translation_en first (preferred translation, highest priority)
    _search_verse_translation(
        base_query, query, keywords, keyword_patterns, config, results, seen_ids
    )

    # Search in Translation model (other scholar translations)
    _search_translations(
        db, base_query, query, keywords, keyword_patterns, config, results, seen_ids
    )

    # Search in Verse.paraphrase_en (unique leadership content)
    _search_paraphrase(
        base_query, query, keywords, keyword_patterns, config, results, seen_ids
    )

    return results


def _search_translations(
    db: Session,
    base_query,
    query: str,
    keywords: list[str],
    keyword_patterns: list[str],
    config: SearchConfig,
    results: list[SearchResult],
    seen_ids: set[str],
) -> None:
    """Search in Translation model (scholar translations) with OR logic."""
    # Build OR clause for any keyword match
    or_conditions = [Translation.text.ilike(pattern) for pattern in keyword_patterns]

    translation_verses = (
        base_query.join(Verse.translations)
        .filter(or_(*or_conditions))
        .options(joinedload(Verse.translations))
        .limit(config.limit * 2)  # Fetch more to account for deduplication
        .all()
    )

    for verse in translation_verses:
        if verse.canonical_id in seen_ids:
            continue
        seen_ids.add(verse.canonical_id)

        # Count keyword matches across all fields
        match_count, best_field = _get_best_match_count(verse, keywords)

        # Find the best matching translation for highlight
        best_translation_text = ""
        best_trans_count = 0
        for trans in verse.translations:
            count = _count_keyword_matches(trans.text, keywords)
            if count > best_trans_count:
                best_trans_count = count
                best_translation_text = trans.text or ""

        # Score based on match ratio (matches / total keywords)
        match_ratio = match_count / len(keywords) if keywords else 0
        base_score = 0.6 + (0.4 * match_ratio)  # 0.6-1.0 range

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.KEYWORD_TRANSLATION,
                    field=best_field,
                    score=base_score,
                    highlight=highlight_match(best_translation_text, query),
                    match_count=match_count,
                ),
            )
        )


def _search_verse_translation(
    base_query,
    query: str,
    keywords: list[str],
    keyword_patterns: list[str],
    config: SearchConfig,
    results: list[SearchResult],
    seen_ids: set[str],
) -> None:
    """Search in Verse.translation_en (preferred translation) with OR logic."""
    or_conditions = [
        Verse.translation_en.ilike(pattern) for pattern in keyword_patterns
    ]

    verses = base_query.filter(or_(*or_conditions)).limit(config.limit * 2).all()

    for verse in verses:
        if verse.canonical_id in seen_ids:
            continue
        seen_ids.add(verse.canonical_id)

        match_count, best_field = _get_best_match_count(verse, keywords)
        match_ratio = match_count / len(keywords) if keywords else 0
        # Preferred translation gets higher base score (0.7-1.0 vs 0.6-1.0)
        base_score = 0.7 + (0.3 * match_ratio)

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.KEYWORD_TRANSLATION,
                    field="translation_en",
                    score=base_score,
                    highlight=highlight_match(verse.translation_en or "", query),
                    match_count=match_count,
                ),
            )
        )


def _search_paraphrase(
    base_query,
    query: str,
    keywords: list[str],
    keyword_patterns: list[str],
    config: SearchConfig,
    results: list[SearchResult],
    seen_ids: set[str],
) -> None:
    """Search in Verse.paraphrase_en (leadership paraphrase) with OR logic."""
    # Build OR clause for any keyword match
    or_conditions = [Verse.paraphrase_en.ilike(pattern) for pattern in keyword_patterns]

    paraphrase_verses = (
        base_query.filter(or_(*or_conditions)).limit(config.limit * 2).all()
    )

    for verse in paraphrase_verses:
        if verse.canonical_id in seen_ids:
            continue
        seen_ids.add(verse.canonical_id)

        # Count keyword matches
        match_count = _count_keyword_matches(verse.paraphrase_en, keywords)

        # Score based on match ratio (slightly lower base for paraphrase)
        match_ratio = match_count / len(keywords) if keywords else 0
        base_score = 0.5 + (0.4 * match_ratio)  # 0.5-0.9 range

        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.KEYWORD_PARAPHRASE,
                    field="paraphrase_en",
                    score=base_score,
                    highlight=highlight_match(verse.paraphrase_en or "", query),
                    match_count=match_count,
                ),
            )
        )
