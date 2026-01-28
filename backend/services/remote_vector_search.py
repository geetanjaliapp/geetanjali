"""Remote vector search client for worker.

When USE_REMOTE_VECTOR_SEARCH=true, this client calls backend's
internal API instead of loading the embedding model locally.

v1.37.0: Centralize embeddings in backend
- Saves ~400MB per worker container
- Worker delegates all vector search to backend
"""

import logging
from typing import Any

import httpx
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import settings
from utils.circuit_breaker import CircuitBreakerOpen

logger = logging.getLogger(__name__)


class RemoteVectorSearch:
    """Client for backend's internal vector search API.

    Same interface as VectorStore.search() for drop-in compatibility.
    Used by worker when USE_REMOTE_VECTOR_SEARCH=true.
    """

    def __init__(self) -> None:
        self.url = settings.VECTOR_SEARCH_URL
        self.api_key = settings.INTERNAL_API_KEY
        self._client: httpx.Client | None = None

        if not self.url or not self.api_key:
            raise ValueError(
                "VECTOR_SEARCH_URL and INTERNAL_API_KEY required for remote search"
            )

        logger.info(f"RemoteVectorSearch initialized: {self.url}")

    @property
    def client(self) -> httpx.Client:
        """Lazy-initialized HTTP client with connection pooling."""
        if self._client is None:
            # 30s timeout: allows for embedding computation + ChromaDB query
            # Matches ANTHROPIC_TIMEOUT default for consistency
            timeout = 30.0
            # api_key is validated non-None in __init__
            assert self.api_key is not None
            self._client = httpx.Client(
                timeout=timeout,
                headers={"X-Internal-API-Key": self.api_key},
            )
        return self._client

    @retry(
        stop=stop_after_attempt(settings.CHROMA_MAX_RETRIES),
        wait=wait_exponential(
            min=settings.CHROMA_RETRY_MIN_WAIT, max=settings.CHROMA_RETRY_MAX_WAIT
        ),
        retry=retry_if_exception_type(
            (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException)
        ),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def search(self, query: str, top_k: int = 5) -> dict[str, Any]:
        """Search vectors via backend internal API.

        Returns same structure as VectorStore.search() for compatibility:
            {
                "ids": list[str],
                "documents": list[str],
                "distances": list[float],
                "metadatas": list[dict]
            }

        Raises CircuitBreakerOpen on persistent failures for RAGPipeline
        compatibility, which triggers SQL fallback in retrieve_verses().
        """
        try:
            response = self.client.post(
                self.url,
                json={"query": query, "top_k": top_k},
            )
            response.raise_for_status()
            data = response.json()

            return {
                "ids": data["ids"],
                "documents": data["documents"],
                "distances": data["distances"],
                "metadatas": data["metadatas"],
            }
        except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error(f"Remote vector search failed after retries: {e}")
            # Raise CircuitBreakerOpen for RAGPipeline compatibility
            # This triggers SQL fallback in RAGPipeline.retrieve_verses()
            raise CircuitBreakerOpen("remote_vector_search", 60.0) from e

    def cleanup(self) -> None:
        """Close HTTP client to release connections."""
        if self._client:
            self._client.close()
            self._client = None


# Global instance (lazy-initialized)
_remote_vector_search: RemoteVectorSearch | None = None


def get_remote_vector_search() -> RemoteVectorSearch:
    """Get or create remote vector search client singleton."""
    global _remote_vector_search
    if _remote_vector_search is None:
        _remote_vector_search = RemoteVectorSearch()
    return _remote_vector_search


def cleanup_remote_vector_search() -> None:
    """Cleanup remote vector search client on shutdown."""
    global _remote_vector_search
    if _remote_vector_search:
        _remote_vector_search.cleanup()
        _remote_vector_search = None
