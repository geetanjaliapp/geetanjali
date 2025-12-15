"""Search result ranking and merging.

Implements the ranking algorithm that combines results from
multiple strategies into a single sorted list.

Ranking factors:
1. Match type priority (exact > keyword > semantic)
2. Featured verse boost
3. Raw match score
"""

from typing import Dict, List, Optional, Set, Tuple

from .config import SearchConfig
from .types import SearchResult, SearchStrategy


def compute_rank_score(result: SearchResult, config: SearchConfig) -> float:
    """Compute final ranking score for a search result.

    Combines:
    - Match type priority (from config.match_type_scores)
    - Raw match quality score
    - Featured verse boost

    Args:
        result: Search result to score
        config: Search configuration with weights

    Returns:
        Final ranking score (higher = more relevant)
    """
    # Base score from match type (determines category priority)
    type_score = config.match_type_scores.get(result.match.type, 0.5)

    # Raw match quality (how well it matched within its category)
    raw_score = result.match.score

    # Featured boost (curated verses rank higher)
    featured_boost = config.weight_featured if result.is_featured else 0.0

    # Weighted combination
    rank_score = (
        config.weight_match_type * type_score
        + config.weight_score * raw_score
        + featured_boost
    )

    return rank_score


def merge_results(
    results_by_strategy: Dict[SearchStrategy, List[SearchResult]],
    config: SearchConfig,
) -> Tuple[List[SearchResult], SearchStrategy, int]:
    """Merge results from multiple strategies with deduplication and ranking.

    Processes strategies in priority order, deduplicates by canonical_id,
    computes ranking scores, and applies pagination.

    Args:
        results_by_strategy: Results keyed by strategy
        config: Search configuration with pagination

    Returns:
        Tuple of:
        - Paginated merged results
        - Primary strategy (first with results)
        - Total count (before pagination)
    """
    seen_ids: Set[str] = set()
    all_results: List[SearchResult] = []
    primary_strategy: Optional[SearchStrategy] = None

    # Process strategies in priority order
    strategy_priority = [
        SearchStrategy.CANONICAL,
        SearchStrategy.SANSKRIT,
        SearchStrategy.KEYWORD,
        SearchStrategy.PRINCIPLE,
        SearchStrategy.SEMANTIC,
    ]

    for strategy in strategy_priority:
        strategy_results = results_by_strategy.get(strategy, [])

        # Set primary strategy to first one with results
        if strategy_results and primary_strategy is None:
            primary_strategy = strategy

        for result in strategy_results:
            # Deduplicate by canonical_id
            if result.canonical_id in seen_ids:
                continue
            seen_ids.add(result.canonical_id)

            # Compute ranking score
            result.rank_score = compute_rank_score(result, config)
            all_results.append(result)

    # Sort by rank score descending
    all_results.sort(key=lambda r: r.rank_score, reverse=True)

    # Track total before pagination
    total_count = len(all_results)

    # Apply pagination
    paginated = all_results[config.offset : config.offset + config.limit]

    return paginated, primary_strategy or SearchStrategy.KEYWORD, total_count
