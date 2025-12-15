"""Search utility functions.

Helper functions for highlighting, escaping, and text processing.
"""

import re
from typing import List

from models.verse import Verse
from .types import SearchMatch, SearchResult


def escape_like_pattern(query: str) -> str:
    """Escape special characters for SQL LIKE patterns.

    Prevents SQL injection by escaping %, _, and \\ characters
    that have special meaning in LIKE clauses.

    Args:
        query: Raw user query string

    Returns:
        Escaped string safe for use in LIKE patterns
    """
    # Order matters: escape backslash first
    return (
        query
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def highlight_match(
    text: str,
    query: str,
    max_context: int = 100,
) -> str:
    """Create highlighted excerpt with query terms marked.

    Finds all occurrences of query words and wraps them in <mark> tags.
    Returns a truncated excerpt centered on the first match.

    Args:
        text: Full text to search in
        query: Search query (can be multiple words)
        max_context: Characters to show before/after match

    Returns:
        Highlighted excerpt with <mark> tags
    """
    if not text or not query:
        return text or ""

    # Split query into words for multi-word highlighting
    query_words = query.lower().split()
    if not query_words:
        return text[:max_context * 2] + "..." if len(text) > max_context * 2 else text

    text_lower = text.lower()

    # Find first occurrence of any query word
    first_pos = len(text)
    for word in query_words:
        pos = text_lower.find(word)
        if pos != -1 and pos < first_pos:
            first_pos = pos

    if first_pos == len(text):
        # No match found, return truncated text
        return text[:max_context * 2] + "..." if len(text) > max_context * 2 else text

    # Extract context around first match
    start = max(0, first_pos - max_context)
    end = min(len(text), first_pos + max_context + len(query_words[0]))
    excerpt = text[start:end]

    # Add ellipsis if truncated
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""

    # Highlight all query words (case-insensitive)
    for word in query_words:
        if len(word) < 2:  # Skip very short words to avoid over-highlighting
            continue
        # Use regex for case-insensitive replacement while preserving case
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        excerpt = pattern.sub(lambda m: f"<mark>{m.group()}</mark>", excerpt)

    return prefix + excerpt + suffix


def highlight_single_match(
    text: str,
    query: str,
    max_context: int = 100,
) -> str:
    """Highlight a single match (original behavior).

    Use this when you want to highlight only the first exact match
    rather than all query words.

    Args:
        text: Full text to search in
        query: Exact string to highlight
        max_context: Characters to show before/after match

    Returns:
        Highlighted excerpt with <mark> tags around first match
    """
    if not text or not query:
        return text or ""

    lower_text = text.lower()
    lower_query = query.lower()
    pos = lower_text.find(lower_query)

    if pos == -1:
        return text[:max_context * 2] + "..." if len(text) > max_context * 2 else text

    start = max(0, pos - max_context)
    end = min(len(text), pos + len(query) + max_context)
    excerpt = text[start:end]

    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""

    # Re-find in excerpt and wrap in <mark>
    excerpt_lower = excerpt.lower()
    match_pos = excerpt_lower.find(lower_query)
    if match_pos != -1:
        matched_text = excerpt[match_pos:match_pos + len(query)]
        excerpt = (
            excerpt[:match_pos]
            + f"<mark>{matched_text}</mark>"
            + excerpt[match_pos + len(query):]
        )

    return prefix + excerpt + suffix


def verse_to_result(verse: Verse, match: SearchMatch) -> SearchResult:
    """Convert a Verse model to SearchResult.

    Args:
        verse: SQLAlchemy Verse model instance
        match: SearchMatch describing how it matched

    Returns:
        SearchResult dataclass
    """
    return SearchResult(
        canonical_id=verse.canonical_id,
        chapter=verse.chapter,
        verse=verse.verse,
        sanskrit_devanagari=verse.sanskrit_devanagari,
        sanskrit_iast=verse.sanskrit_iast,
        translation_en=verse.translation_en,
        paraphrase_en=verse.paraphrase_en,
        principles=verse.consulting_principles or [],
        is_featured=verse.is_featured,
        match=match,
    )
