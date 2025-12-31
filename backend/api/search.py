"""Unified Hybrid Search API endpoint.

Provides transparent, multi-strategy search across verses with intelligent ranking.
"""

import logging
from typing import Any, cast

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from api.dependencies import limiter
from config import settings
from db import get_db
from services.cache import cache, principles_key, search_key
from services.search import SearchService, serialize_search_response
from utils.sanitization import strip_angle_brackets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/search")


# =============================================================================
# Response Schemas
# =============================================================================


class SearchMatchResponse(BaseModel):
    """Match information showing why a verse appeared in results."""

    type: str = Field(
        ...,
        description="Match type: exact_canonical, keyword_translation, semantic, etc.",
    )
    field: str = Field(
        ..., description="Field that matched: canonical_id, translation_en, etc."
    )
    score: float = Field(..., description="Match quality score (0.0 to 1.0)")
    highlight: str | None = Field(
        None, description="Matched text excerpt with <mark> tags"
    )


class SearchResultResponse(BaseModel):
    """A single search result with verse data and match context."""

    canonical_id: str = Field(..., description="Verse identifier (e.g., BG_2_47)")
    chapter: int = Field(..., description="Chapter number (1-18)")
    verse: int = Field(..., description="Verse number within chapter")
    sanskrit_devanagari: str | None = Field(
        None, description="Sanskrit in Devanagari script"
    )
    sanskrit_iast: str | None = Field(
        None, description="Sanskrit in IAST transliteration"
    )
    translation_en: str | None = Field(None, description="Primary English translation")
    paraphrase_en: str | None = Field(None, description="Leadership-focused paraphrase")
    principles: list[str] = Field(
        default_factory=list, description="Associated consulting principles"
    )
    is_featured: bool = Field(False, description="Whether verse is featured/curated")
    match: SearchMatchResponse = Field(
        ..., description="Information about how this verse matched"
    )
    rank_score: float = Field(
        ..., description="Final ranking score (higher = more relevant)"
    )
    audio_url: str | None = Field(
        None, description="URL to audio recitation if available"
    )

    @model_validator(mode="after")
    def compute_audio_url(self) -> "SearchResultResponse":
        """Compute audio_url based on canonical_id if audio file exists."""
        if self.audio_url is None and self.canonical_id:
            from services.audio import get_audio_url

            self.audio_url = get_audio_url(self.canonical_id)
        return self


class SearchModerationResponse(BaseModel):
    """Content moderation result for blocked queries."""

    blocked: bool = Field(..., description="Whether query was blocked")
    message: str = Field(..., description="User-friendly message")


class SearchSuggestionResponse(BaseModel):
    """Suggestion for alternative actions (e.g., consultation CTA)."""

    type: str = Field(..., description="Suggestion type: consultation")
    message: str = Field(..., description="Suggestion message")
    cta: str = Field(..., description="Call-to-action button text")
    prefill: str | None = Field(
        None, description="Text to prefill in consultation form"
    )


class SearchResponse(BaseModel):
    """Complete search response with results and metadata."""

    query: str = Field(..., description="Original search query")
    strategy: str = Field(
        ...,
        description="Primary search strategy used: canonical, keyword, semantic, etc.",
    )
    total: int = Field(..., description="Number of results in this response")
    total_count: int = Field(..., description="Total matching results (for pagination)")
    results: list[SearchResultResponse] = Field(
        default_factory=list, description="Ranked search results"
    )
    moderation: SearchModerationResponse | None = Field(
        None, description="Moderation result if query was blocked"
    )
    suggestion: SearchSuggestionResponse | None = Field(
        None, description="Alternative action suggestion"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "query": "duty without attachment",
                "strategy": "keyword",
                "total": 3,
                "results": [
                    {
                        "canonical_id": "BG_2_47",
                        "chapter": 2,
                        "verse": 47,
                        "sanskrit_devanagari": "कर्मण्येवाधिकारस्ते...",
                        "sanskrit_iast": "karmaṇy evādhikāras te...",
                        "translation_en": "You have the right to work only...",
                        "paraphrase_en": "Focus on your duty without attachment to outcomes.",
                        "principles": ["karma_yoga", "detachment"],
                        "is_featured": True,
                        "match": {
                            "type": "keyword_paraphrase",
                            "field": "paraphrase_en",
                            "score": 0.8,
                            "highlight": "Focus on your <mark>duty</mark> <mark>without</mark> <mark>attachment</mark> to outcomes.",
                        },
                        "rank_score": 0.95,
                    }
                ],
                "moderation": None,
                "suggestion": None,
            }
        }


# =============================================================================
# Endpoints
# =============================================================================


@router.get("", response_model=SearchResponse)
@limiter.limit("60/minute")
async def search_verses(
    request: Request,
    q: str = Query(
        ...,
        min_length=1,
        max_length=500,
        description="Search query: verse reference (2.47, BG_2_47), Sanskrit text, keywords, or meaning",
    ),
    chapter: int | None = Query(
        None,
        ge=1,
        le=18,
        description="Filter results to specific chapter (1-18)",
    ),
    principle: str | None = Query(
        None,
        max_length=100,
        description="Filter by consulting principle/topic",
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=50,
        description="Maximum results to return (1-50)",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of results to skip (for pagination)",
    ),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Search verses using unified hybrid search.

    Automatically detects query intent and uses appropriate strategy:

    - **Reference lookup**: "2.47", "BG_2_47", "chapter 2 verse 47"
    - **Sanskrit search**: Devanagari or IAST text
    - **Keyword search**: "duty without attachment", "fear of death"
    - **Semantic search**: "How to handle failure", "leadership advice"

    Results are ranked by:
    1. Match type (exact > keyword > semantic)
    2. Match field (sanskrit > translation > paraphrase)
    3. Featured status (featured verses get boost)
    4. Match quality score

    The response shows **why** each verse matched (transparency).

    **Examples:**
    - `/search?q=2.47` → Exact canonical lookup
    - `/search?q=duty` → Keyword search across translations
    - `/search?q=How%20to%20overcome%20fear` → Semantic similarity search
    - `/search?q=कर्म` → Sanskrit text search
    """
    # Sanitize query to prevent XSS (strip HTML tags and angle brackets)
    q = strip_angle_brackets(q)
    if not q:
        # If query becomes empty after sanitization, return empty results
        return {
            "query": "",
            "results": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
        }

    # Try cache first (short TTL for burst protection)
    cache_key = search_key(q, chapter, principle, limit, offset)
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache hit for search: {q}")
        return cast(dict[str, Any], cached)

    # Execute search with individual parameters
    search_service = SearchService(db)
    response = search_service.search(
        query=q,
        limit=limit,
        offset=offset,
        chapter=chapter,
        principle=principle,
    )

    # Serialize for API response
    result = serialize_search_response(response)

    # Cache the result (short TTL to prevent Redis bloat)
    cache.set(cache_key, result, settings.CACHE_TTL_SEARCH)

    return result


@router.get("/principles", response_model=list[str])
@limiter.limit("60/minute")
async def get_available_principles(
    request: Request,
    db: Session = Depends(get_db),
) -> list[str]:
    """
    Get all available consulting principles for filtering.

    Returns a deduplicated list of all principles used across verses.
    Useful for building filter UIs.
    """
    # Try cache first (principles rarely change)
    cache_key = principles_key()
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Cache hit for principles list")
        return cast(list[str], cached)

    from sqlalchemy import text

    from models.verse import Verse

    # Get all unique principles from JSON array
    # PostgreSQL: unnest the JSON array and get distinct values (cast to JSONB for function)
    # For SQLite (tests): fall back to fetching all and processing in Python
    try:
        result = db.execute(
            text(
                """
                SELECT DISTINCT jsonb_array_elements_text(consulting_principles::jsonb) as principle
                FROM verses
                WHERE consulting_principles IS NOT NULL
                ORDER BY principle
            """
            )
        )
        principles = [row[0] for row in result.fetchall()]
    except Exception:
        # Rollback the failed transaction before fallback query
        db.rollback()
        # Fallback for SQLite (used in tests) which doesn't have jsonb_array_elements_text
        # OPTIMIZATION: Only load consulting_principles column, not entire verse objects
        # Reduces memory usage significantly for 701 verses
        result = (
            db.query(Verse.consulting_principles)
            .filter(Verse.consulting_principles.isnot(None))
            .all()
        )
        principles_set: set[str] = set()
        for (principles_json,) in result:
            if principles_json:
                principles_set.update(principles_json)
        principles = sorted(principles_set)

    # Cache the result
    cache.set(cache_key, principles, settings.CACHE_TTL_PRINCIPLES)

    return principles
