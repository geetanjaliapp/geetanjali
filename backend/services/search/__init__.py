"""Search service package.

Provides unified search across Bhagavad Geeta verses using
multiple strategies: canonical, Sanskrit, keyword, principle,
and semantic (vector) search.

Public API:
    - SearchService: Main service class for executing searches
    - SearchResponse: Response dataclass with results and metadata
    - SearchResult: Individual search result with match info
    - get_available_principles: Fetch list of principle filters

Example:
    from services.search import SearchService

    service = SearchService(db)
    response = service.search("karma yoga", limit=10)
    for result in response.results:
        print(f"{result.canonical_id}: {result.match.type}")
"""

from .config import SearchConfig
from .service import SearchService, get_available_principles
from .types import (
    MatchType,
    SearchMatch,
    SearchResponse,
    SearchResult,
    SearchStrategy,
    serialize_search_response,
)

__all__ = [
    # Main service
    "SearchService",
    "get_available_principles",
    # Configuration
    "SearchConfig",
    # Types
    "SearchResponse",
    "SearchResult",
    "SearchMatch",
    "MatchType",
    "SearchStrategy",
    # Serialization
    "serialize_search_response",
]
