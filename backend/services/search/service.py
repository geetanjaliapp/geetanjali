"""Search service orchestrator.

Coordinates multiple search strategies, applies moderation,
and returns unified results with ranking and transparency.

This is the main entry point for all search operations.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from services.content_filter import check_search_query, ContentCheckResult

from .config import SearchConfig
from .parser import QueryParser
from .ranking import merge_results
from .strategies import (
    canonical_search,
    keyword_search,
    principle_search,
    sanskrit_search,
    semantic_search,
)
from .types import SearchResponse, SearchResult, SearchStrategy

logger = logging.getLogger(__name__)


class SearchService:
    """Unified search service with multiple strategies.

    Orchestrates:
    1. Query parsing and intent detection
    2. Content moderation
    3. Strategy selection and execution
    4. Result merging and ranking
    5. Situational query suggestions
    """

    def __init__(self, db: Session):
        """Initialize search service.

        Args:
            db: Database session for queries
        """
        self.db = db
        self.parser = QueryParser()

    def search(
        self,
        query: str,
        limit: int = 20,
        offset: int = 0,
        chapter: Optional[int] = None,
        principle: Optional[str] = None,
    ) -> SearchResponse:
        """Execute unified search across all strategies.

        Flow:
        1. Parse query for intent (canonical, Sanskrit, situational)
        2. Check content moderation (skip for canonical references)
        3. Execute relevant search strategies in parallel
        4. Merge, deduplicate, and rank results
        5. Add situational suggestions if applicable

        Args:
            query: User search query
            limit: Maximum results to return
            offset: Pagination offset
            chapter: Optional chapter filter
            principle: Optional principle filter

        Returns:
            SearchResponse with results, strategy info, and suggestions
        """
        query = query.strip()

        # Handle empty query early
        if not query:
            return SearchResponse(
                query=query,
                strategy="keyword",
                total=0,
                total_count=0,
                results=[],
            )

        logger.info(
            "Search request",
            extra={
                "query": query,
                "limit": limit,
                "offset": offset,
                "chapter": chapter,
                "principle": principle,
            },
        )

        # Build configuration
        config = SearchConfig(
            limit=limit,
            offset=offset,
            chapter=chapter,
            principle=principle,
        )

        # Parse query intent
        canonical_ref = self.parser.parse_canonical(query)
        is_sanskrit = self.parser.is_sanskrit_query(query)
        is_situational = self.parser.is_situational_query(query)

        # Content moderation (skip for canonical references, Sanskrit, short queries)
        moderation = self._check_moderation(query, canonical_ref, is_sanskrit)
        if moderation and moderation.get("blocked"):
            return SearchResponse(
                query=query,
                strategy="blocked",
                total=0,
                total_count=0,
                results=[],
                moderation=moderation,
            )

        # Execute search strategies
        results_by_strategy = self._execute_strategies(
            query=query,
            config=config,
            canonical_ref=canonical_ref,
            is_sanskrit=is_sanskrit,
        )

        # Merge and rank results
        merged_results, primary_strategy, total_count = merge_results(
            results_by_strategy, config
        )

        # Build situational suggestion if applicable
        # Show suggestion for situational queries even with no results
        suggestion = None
        if is_situational:
            suggestion = {
                "type": "consultation",
                "message": "Looking for guidance? Try our consultation feature for personalized insights.",
                "cta": "Get Guidance",
            }

        logger.info(
            "Search completed",
            extra={
                "query": query,
                "strategy": primary_strategy.value,
                "total_count": total_count,
                "returned": len(merged_results),
            },
        )

        return SearchResponse(
            query=query,
            strategy=primary_strategy.value,
            total=len(merged_results),
            total_count=total_count,
            results=merged_results,
            moderation=moderation,
            suggestion=suggestion,
        )

    def _check_moderation(
        self,
        query: str,
        canonical_ref: Optional[tuple],
        is_sanskrit: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Check query against content moderation.

        Uses search-specific filter that:
        - Blocks explicit content and profanity
        - Allows short spiritual terms (karma, dharma, yoga)
        - Has lenient gibberish detection for search queries

        Skips moderation entirely for:
        - Canonical verse references (e.g., "BG 2.47") - always valid
        - Sanskrit queries (Devanagari text) - can't apply English filters

        Args:
            query: Search query to check
            canonical_ref: Parsed canonical reference if any
            is_sanskrit: Whether query contains Sanskrit/Devanagari

        Returns:
            Moderation result dict or None if passed
        """
        # Skip moderation for canonical references (always valid)
        if canonical_ref:
            return None

        # Skip moderation for Sanskrit queries (Devanagari text)
        if is_sanskrit:
            return None

        # Use search-specific content filter
        result: ContentCheckResult = check_search_query(query)

        if result.is_violation:
            logger.warning(
                "Query blocked by moderation",
                extra={
                    "query": query,
                    "violation_type": (
                        result.violation_type.value
                        if result.violation_type
                        else "unknown"
                    ),
                },
            )
            return {
                "blocked": True,
                "reason": f"Content policy violation: {result.violation_type.value if result.violation_type else 'unknown'}",
                "category": (
                    result.violation_type.value if result.violation_type else "unknown"
                ),
            }

        return None

    def _execute_strategies(
        self,
        query: str,
        config: SearchConfig,
        canonical_ref: Optional[tuple],
        is_sanskrit: bool,
    ) -> Dict[SearchStrategy, List[SearchResult]]:
        """Execute relevant search strategies based on query intent.

        Strategy priority:
        1. Canonical - exact verse reference (BG 2.47)
        2. Sanskrit - Devanagari or IAST text
        3. Principle - topic/principle filter
        4. Keyword - full-text search
        5. Semantic - vector similarity (fallback)

        Args:
            query: Search query
            config: Search configuration
            canonical_ref: Parsed canonical reference
            is_sanskrit: Whether query is Sanskrit text

        Returns:
            Dict mapping strategies to their results
        """
        results: Dict[SearchStrategy, List[SearchResult]] = {}

        # Strategy 1: Canonical reference
        if canonical_ref:
            chapter, verse = canonical_ref
            canonical_results = canonical_search(self.db, chapter, verse)
            if canonical_results:
                results[SearchStrategy.CANONICAL] = canonical_results
                # Canonical matches are definitive - return early
                return results

        # Strategy 2: Sanskrit text search
        if is_sanskrit:
            sanskrit_results = sanskrit_search(self.db, query, config, self.parser)
            if sanskrit_results:
                results[SearchStrategy.SANSKRIT] = sanskrit_results

        # Strategy 3: Principle filter
        if config.principle:
            principle_results = principle_search(self.db, config.principle, config)
            if principle_results:
                results[SearchStrategy.PRINCIPLE] = principle_results

        # Strategy 4: Keyword search (always run for text queries)
        if not canonical_ref:
            keyword_results = keyword_search(self.db, query, config)
            if keyword_results:
                results[SearchStrategy.KEYWORD] = keyword_results

        # Strategy 5: Semantic search (fallback or augmentation)
        # Run semantic if we have few results or no results
        should_run_semantic = (
            not results or sum(len(r) for r in results.values()) < config.limit // 2
        )

        if should_run_semantic:
            semantic_results = semantic_search(query, self.db, config)
            if semantic_results:
                results[SearchStrategy.SEMANTIC] = semantic_results

        return results


def get_available_principles(db: Session) -> List[str]:
    """Get list of all available consulting principles.

    Extracts unique principles from verse consulting_principles arrays.

    Args:
        db: Database session

    Returns:
        Sorted list of principle names
    """
    from sqlalchemy import text

    from models.verse import Verse

    # PostgreSQL-specific: unnest JSONB array
    try:
        result = db.execute(
            text(
                """
                SELECT DISTINCT jsonb_array_elements_text(consulting_principles) as principle
                FROM verses
                WHERE consulting_principles IS NOT NULL
                ORDER BY principle
                """
            )
        )
        return [row[0] for row in result]
    except Exception:
        # Fallback for SQLite in tests
        verses = db.query(Verse).filter(Verse.consulting_principles.isnot(None)).all()
        principles = set()
        for verse in verses:
            if verse.consulting_principles:
                principles.update(verse.consulting_principles)
        return sorted(principles)
