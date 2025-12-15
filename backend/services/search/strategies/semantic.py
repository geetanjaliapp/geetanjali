"""Semantic vector search strategy.

Uses ChromaDB embeddings for meaning-based similarity search.
Queries are embedded using all-MiniLM-L6-v2 and matched against
pre-computed verse embeddings.

This is the most flexible but slowest strategy.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.verse import Verse
from services.vector_store import get_vector_store
from ..config import SearchConfig
from ..types import MatchType, SearchMatch, SearchResult
from ..utils import verse_to_result

logger = logging.getLogger(__name__)


def semantic_search(
    query: str,
    db: Session,
    config: SearchConfig,
) -> List[SearchResult]:
    """Semantic search using vector embeddings.

    Uses ChromaDB for similarity search, then enriches results
    with full verse data from PostgreSQL.

    Args:
        query: Search query (will be embedded)
        db: Database session for verse enrichment
        config: Search configuration

    Returns:
        List of semantically similar verses
    """
    # Get vector store (may fail if ChromaDB unavailable)
    try:
        vector_store = get_vector_store()
    except Exception as e:
        logger.warning(f"Vector store unavailable for semantic search: {e}")
        return []

    # Build metadata filter for ChromaDB
    where_filter: Optional[Dict[str, Any]] = None
    if config.chapter:
        where_filter = {"chapter": config.chapter}

    # Execute vector search
    try:
        vector_results = vector_store.search(
            query=query,
            top_k=config.semantic_top_k,
            where=where_filter,
        )
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        return []

    if not vector_results.get("ids"):
        return []

    # Map canonical IDs to relevance scores
    id_to_score = _compute_relevance_scores(
        vector_results,
        config.semantic_min_score,
    )

    if not id_to_score:
        return []

    # Fetch full verse data from database
    return _enrich_with_verse_data(db, id_to_score)


def _compute_relevance_scores(
    vector_results: Dict[str, Any],
    min_score: float,
) -> Dict[str, float]:
    """Convert ChromaDB distances to relevance scores.

    ChromaDB returns distances (lower = more similar).
    We convert to relevance (higher = more similar).

    Args:
        vector_results: ChromaDB query results
        min_score: Minimum relevance threshold

    Returns:
        Mapping of canonical_id to relevance score
    """
    id_to_score: Dict[str, float] = {}

    for canonical_id, distance in zip(
        vector_results["ids"],
        vector_results["distances"],
    ):
        # Convert distance to relevance (1.0 - distance for cosine)
        relevance = 1.0 - distance

        # Only include results above threshold
        if relevance >= min_score:
            id_to_score[canonical_id] = relevance

    return id_to_score


def _enrich_with_verse_data(
    db: Session,
    id_to_score: Dict[str, float],
) -> List[SearchResult]:
    """Fetch full verse data and create SearchResults.

    Args:
        db: Database session
        id_to_score: Mapping of canonical_id to relevance score

    Returns:
        List of SearchResult with full verse data
    """
    verses = (
        db.query(Verse).filter(Verse.canonical_id.in_(list(id_to_score.keys()))).all()
    )

    results = []
    for verse in verses:
        relevance = id_to_score.get(verse.canonical_id, 0.0)
        results.append(
            verse_to_result(
                verse,
                SearchMatch(
                    type=MatchType.SEMANTIC,
                    field="embedding",
                    score=relevance,
                    highlight=None,  # No text highlight for semantic
                ),
            )
        )

    return results
