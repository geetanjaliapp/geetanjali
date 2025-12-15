"""Search strategy implementations.

Each strategy is responsible for a specific type of search:
- canonical: Exact verse reference lookup
- sanskrit: Sanskrit/IAST text matching
- keyword: Full-text keyword search
- principle: Topic/principle filtering
- semantic: Vector embedding similarity

Strategies are designed to be composable and can be run
independently or combined by the SearchService.
"""

from .canonical import canonical_search
from .sanskrit import sanskrit_search
from .keyword import keyword_search
from .principle import principle_search
from .semantic import semantic_search

__all__ = [
    "canonical_search",
    "sanskrit_search",
    "keyword_search",
    "principle_search",
    "semantic_search",
]
