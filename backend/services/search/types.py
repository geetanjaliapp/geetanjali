"""Search type definitions.

Centralized types for the search service. All dataclasses and enums
used across search modules are defined here for consistency.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class MatchType(str, Enum):
    """Type of search match - determines ranking priority.

    Order matters: higher priority types should rank better.
    """

    EXACT_CANONICAL = "exact_canonical"  # Highest priority
    EXACT_SANSKRIT = "exact_sanskrit"
    KEYWORD_TRANSLATION = "keyword_translation"
    KEYWORD_PARAPHRASE = "keyword_paraphrase"
    PRINCIPLE = "principle"
    SEMANTIC = "semantic"  # Lowest priority (but most flexible)


class SearchStrategy(str, Enum):
    """Search strategy identifier.

    Used to track which strategy produced results and for logging.
    """

    CANONICAL = "canonical"
    SANSKRIT = "sanskrit"
    KEYWORD = "keyword"
    PRINCIPLE = "principle"
    SEMANTIC = "semantic"


@dataclass
class SearchMatch:
    """Information about how a verse matched the query.

    Provides transparency by showing users why each result appeared.
    """

    type: MatchType
    field: str  # canonical_id, sanskrit_iast, translation_en, etc.
    score: float  # 0.0 to 1.0
    highlight: Optional[str] = None  # Matched text with <mark> tags


@dataclass
class SearchResult:
    """A single search result with verse data and match context.

    Contains both the verse data and metadata about the match.
    """

    canonical_id: str
    chapter: int
    verse: int
    sanskrit_devanagari: Optional[str]
    sanskrit_iast: Optional[str]
    translation_en: Optional[str]
    paraphrase_en: Optional[str]
    principles: List[str]
    is_featured: bool
    match: SearchMatch
    rank_score: float = 0.0  # Computed by ranking algorithm


@dataclass
class SearchResponse:
    """Complete search response with metadata.

    The full response returned by SearchService.search().
    """

    query: str
    strategy: str  # Primary strategy that produced results
    total: int  # Results in this page
    total_count: int  # Total matching results (for pagination)
    results: List[SearchResult]
    moderation: Optional[Dict[str, Any]] = None
    suggestion: Optional[Dict[str, Any]] = None  # e.g., consultation CTA


@dataclass
class ModerationResult:
    """Content moderation check result."""

    blocked: bool
    message: Optional[str] = None


@dataclass
class SearchSuggestion:
    """Suggestion for alternative actions."""

    type: str  # "consultation"
    message: str
    cta: str
    prefill: Optional[str] = None


def serialize_search_response(response: SearchResponse) -> Dict[str, Any]:
    """Convert SearchResponse to API-compatible dict.

    Handles dataclass serialization including nested objects.

    Args:
        response: SearchResponse dataclass

    Returns:
        Dict suitable for JSON serialization
    """
    return {
        "query": response.query,
        "strategy": response.strategy,
        "total": response.total,
        "total_count": response.total_count,
        "results": [
            {
                "canonical_id": r.canonical_id,
                "chapter": r.chapter,
                "verse": r.verse,
                "sanskrit_devanagari": r.sanskrit_devanagari,
                "sanskrit_iast": r.sanskrit_iast,
                "translation_en": r.translation_en,
                "paraphrase_en": r.paraphrase_en,
                "principles": r.principles,
                "is_featured": r.is_featured,
                "match": {
                    "type": r.match.type.value,
                    "field": r.match.field,
                    "score": r.match.score,
                    "highlight": r.match.highlight,
                },
                "rank_score": r.rank_score,
            }
            for r in response.results
        ],
        "moderation": (
            {"blocked": True, "message": response.moderation.get("reason", "Content blocked")}
            if response.moderation and response.moderation.get("blocked")
            else None
        ),
        "suggestion": response.suggestion,
    }
