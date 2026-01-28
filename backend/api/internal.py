"""Internal API endpoints for service-to-service communication.

These endpoints are NOT exposed publicly. They're used by worker
to communicate with backend without loading the embedding model.

v1.37.0: Centralize embeddings in backend
"""

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from prometheus_client import Counter
from pydantic import BaseModel

from config import settings
from services.vector_store import get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal", tags=["internal"])

# Metrics
internal_search_total = Counter(
    "geetanjali_internal_search_total",
    "Total internal vector search requests",
    ["status"],  # success, error
)


def verify_internal_api_key(x_internal_api_key: str = Header(...)) -> bool:
    """Verify internal API key for service-to-service auth.

    Uses constant-time comparison to prevent timing attacks.
    """
    if not settings.INTERNAL_API_KEY:
        raise HTTPException(503, "Internal API not configured")
    # Use secrets.compare_digest for timing-attack-safe comparison
    if not secrets.compare_digest(x_internal_api_key, settings.INTERNAL_API_KEY):
        raise HTTPException(401, "Invalid internal API key")
    return True


class VectorSearchRequest(BaseModel):
    """Request model for internal vector search."""

    query: str
    top_k: int = 5


class VectorSearchResponse(BaseModel):
    """Response model for internal vector search.

    Mirrors VectorStore.search() return format for compatibility.
    """

    ids: list[str]
    documents: list[str]
    distances: list[float]
    metadatas: list[dict]


@router.post("/search", response_model=VectorSearchResponse)
async def internal_vector_search(
    request: VectorSearchRequest,
    _auth: bool = Depends(verify_internal_api_key),
) -> VectorSearchResponse:
    """Internal vector search endpoint for worker.

    Worker calls this instead of loading embedding model locally.
    Reduces worker memory by ~400MB.
    """
    logger.debug(f"Internal vector search: query length={len(request.query)}")

    try:
        vector_store = get_vector_store()
        results = vector_store.search(request.query, top_k=request.top_k)

        internal_search_total.labels(status="success").inc()
        return VectorSearchResponse(
            ids=results["ids"],
            documents=results["documents"],
            distances=results["distances"],
            metadatas=results["metadatas"],
        )
    except Exception as e:
        internal_search_total.labels(status="error").inc()
        logger.error(f"Internal vector search failed: {e}")
        raise HTTPException(500, f"Vector search failed: {str(e)}")
