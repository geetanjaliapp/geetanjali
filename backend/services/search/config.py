"""Search configuration.

Centralized configuration for search behavior. Values can be
overridden via environment variables through settings.py.
"""

from dataclasses import dataclass, field
from typing import Dict, Optional

from .types import MatchType


# Default ranking weights - can be tuned based on user feedback
DEFAULT_MATCH_TYPE_SCORES: Dict[MatchType, float] = {
    MatchType.EXACT_CANONICAL: 1.0,
    MatchType.EXACT_SANSKRIT: 0.95,
    MatchType.KEYWORD_TRANSLATION: 0.8,
    MatchType.KEYWORD_PARAPHRASE: 0.7,
    MatchType.PRINCIPLE: 0.65,
    MatchType.SEMANTIC: 0.5,
}


@dataclass
class SearchConfig:
    """Configuration for search behavior.

    Can be customized per-request or use defaults from settings.

    Attributes:
        limit: Maximum results per page (default: 20)
        offset: Pagination offset (default: 0)
        chapter: Filter by chapter number (optional)
        principle: Filter by principle tag (optional)
        semantic_top_k: Number of semantic results to fetch (default: 10)
        semantic_min_score: Minimum relevance threshold (default: 0.3)
        weight_match_type: Weight for match type in ranking (default: 1.0)
        weight_featured: Boost for featured verses (default: 0.15)
        weight_score: Weight for raw match score (default: 0.5)
    """

    # Pagination
    limit: int = 20
    offset: int = 0

    # Filters
    chapter: Optional[int] = None
    principle: Optional[str] = None

    # Semantic search tuning
    semantic_top_k: int = 10
    semantic_min_score: float = 0.3

    # Ranking weights
    weight_match_type: float = 1.0
    weight_featured: float = 0.15  # Featured verses get this boost
    weight_score: float = 0.5

    # Match type priority scores
    match_type_scores: Dict[MatchType, float] = field(
        default_factory=lambda: DEFAULT_MATCH_TYPE_SCORES.copy()
    )

    @classmethod
    def from_settings(cls) -> "SearchConfig":
        """Create config from application settings.

        Use this for default configuration that respects environment variables.
        """
        # Future: load from settings.py when search config is added there
        return cls()
