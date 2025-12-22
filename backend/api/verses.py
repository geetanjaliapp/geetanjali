"""Verse query endpoints."""

import logging
import random
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.dependencies import limiter
from api.errors import ERR_NO_VERSES_IN_DB, ERR_VERSE_NOT_FOUND
from db import get_db
from db.repositories.verse_repository import VerseRepository
from api.schemas import VerseResponse, TranslationResponse
from models.verse import Verse, Translation
from services.cache import (
    cache,
    verse_key,
    verse_list_key,
    daily_verse_key,
    featured_count_key,
    featured_verse_ids_key,
    all_verse_ids_key,
    calculate_midnight_ttl,
)
from config import settings

# Use centralized cache TTL from config
VERSE_IDS_CACHE_TTL = settings.CACHE_TTL_VERSE_LIST

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/verses")


@router.get("/count")
@limiter.limit("60/minute")
async def get_verses_count(
    request: Request,
    chapter: Optional[int] = Query(None, ge=1, le=18, description="Filter by chapter"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    principles: Optional[str] = Query(None, description="Comma-separated principle tags"),
    db: Session = Depends(get_db),
):
    """
    Get total count of verses matching filters.

    Args:
        chapter: Filter by chapter number
        featured: Filter by featured status (true/false)
        principles: Comma-separated consulting principles
        db: Database session

    Returns:
        Count of matching verses
    """
    from sqlalchemy import or_
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import cast

    query = db.query(func.count(Verse.id))

    if chapter:
        query = query.filter(Verse.chapter == chapter)

    if featured is not None:
        query = query.filter(Verse.is_featured == featured)

    if principles:
        principle_list = [p.strip() for p in principles.split(",")]
        conditions = [
            cast(Verse.consulting_principles, JSONB).contains([p]) for p in principle_list
        ]
        query = query.filter(Verse.consulting_principles.isnot(None))
        query = query.filter(or_(*conditions))

    count = query.scalar()
    return {"count": count}


@router.get("", response_model=List[VerseResponse])
@limiter.limit("60/minute")
async def search_verses(
    request: Request,
    q: Optional[str] = Query(
        None, max_length=200, description="Search by canonical ID or principle"
    ),
    chapter: Optional[int] = Query(None, ge=1, le=18, description="Filter by chapter"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    principles: Optional[str] = Query(
        None, description="Comma-separated principle tags"
    ),
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        default=20, ge=1, le=50, description="Maximum number of records (1-50)"
    ),
    db: Session = Depends(get_db),
):
    """
    Search and filter verses.

    Args:
        q: Search query (canonical ID or principle)
        chapter: Filter by chapter number
        featured: Filter by featured status (true/false)
        principles: Comma-separated consulting principles
        skip: Number of records to skip
        limit: Maximum number of records
        db: Database session

    Returns:
        List of matching verses sorted by chapter and verse number
    """
    repo = VerseRepository(db)

    from sqlalchemy import or_
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import cast

    # Search by canonical ID if query looks like one (not cached - specific lookups)
    if q and q.startswith("BG_"):
        verse = repo.get_by_canonical_id(q)
        return [verse] if verse else []

    # Build query with filters
    query = db.query(Verse)

    # Filter by principles (with pagination support)
    if principles:
        principle_list = [p.strip() for p in principles.split(",")]
        conditions = [
            cast(Verse.consulting_principles, JSONB).contains([p]) for p in principle_list
        ]
        query = query.filter(Verse.consulting_principles.isnot(None))
        query = query.filter(or_(*conditions))

    # Filter by chapter
    if chapter:
        query = query.filter(Verse.chapter == chapter)

    # Filter by featured status
    if featured is not None:
        query = query.filter(Verse.is_featured == featured)

    # P2.3 FIX: Cache filtered verse list queries (including principle queries)
    cache_key = verse_list_key(
        chapter=chapter, featured=featured, principles=principles, skip=skip, limit=limit
    )
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result

    # Always sort by chapter, then verse number
    query = query.order_by(Verse.chapter, Verse.verse)

    # Apply pagination
    result = query.offset(skip).limit(limit).all()

    # Cache the result
    cache.set(
        cache_key,
        [VerseResponse.model_validate(v).model_dump() for v in result],
        settings.CACHE_TTL_VERSE_LIST,
    )

    return result


@router.get("/random", response_model=VerseResponse)
@limiter.limit("30/minute")
async def get_random_verse(
    request: Request,
    featured_only: bool = Query(
        True, description="If true, only return from curated showcase-worthy verses"
    ),
    db: Session = Depends(get_db),
):
    """
    Get a random verse from the Bhagavad Geeta.

    By default, returns only from curated "featured" verses (~180 showcase-worthy
    verses selected for their universal recognition and applicability).

    Set featured_only=false to get any random verse from all 701.

    Args:
        featured_only: Limit to featured/showcase-worthy verses (default: true)
        db: Database session

    Returns:
        Random verse

    Raises:
        HTTPException: If no verses found
    """
    # OPTIMIZATION: Cache verse IDs instead of loading all verse objects
    # Reduces memory usage from ~5MB (701 full verses) to ~20KB (701 IDs)
    # Then load single verse by ID (uses existing verse cache)

    if featured_only:
        cache_key = featured_verse_ids_key()
        verse_ids = cache.get(cache_key)

        if verse_ids is None:
            # Load only canonical_ids (lightweight query)
            verse_ids = [
                row[0]
                for row in db.query(Verse.canonical_id)
                .filter(Verse.is_featured.is_(True))
                .all()
            ]
            if verse_ids:
                cache.set(cache_key, verse_ids, VERSE_IDS_CACHE_TTL)

        if not verse_ids:
            # Fallback: load all verse IDs
            logger.warning("No featured verses found, falling back to any verse")
            cache_key = all_verse_ids_key()
            verse_ids = cache.get(cache_key)
            if verse_ids is None:
                verse_ids = [row[0] for row in db.query(Verse.canonical_id).all()]
                if verse_ids:
                    cache.set(cache_key, verse_ids, VERSE_IDS_CACHE_TTL)
    else:
        cache_key = all_verse_ids_key()
        verse_ids = cache.get(cache_key)

        if verse_ids is None:
            verse_ids = [row[0] for row in db.query(Verse.canonical_id).all()]
            if verse_ids:
                cache.set(cache_key, verse_ids, VERSE_IDS_CACHE_TTL)

    if not verse_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERR_NO_VERSES_IN_DB
        )

    # Pick random ID and load single verse
    selected_id = random.choice(verse_ids)

    # Try verse cache first
    verse_cache_key = verse_key(selected_id)
    cached_verse = cache.get(verse_cache_key)
    if cached_verse:
        return cached_verse

    # Load from database
    repo = VerseRepository(db)
    verse = repo.get_by_canonical_id(selected_id)

    if not verse:
        # Rare race condition: ID cached but verse deleted
        # Invalidate ID cache and return error (next request will rebuild)
        cache.delete(cache_key)
        logger.warning(f"Cached verse ID {selected_id} not found in DB, cache invalidated")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERR_VERSE_NOT_FOUND
        )

    # Cache the verse for future requests
    verse_data = VerseResponse.model_validate(verse).model_dump()
    cache.set(verse_cache_key, verse_data, settings.CACHE_TTL_VERSE)

    return verse


@router.get("/daily", response_model=VerseResponse)
@limiter.limit("60/minute")
async def get_verse_of_the_day(request: Request, db: Session = Depends(get_db)):
    """
    Get deterministic verse of the day based on current date.

    Uses day of year to deterministically select the same verse for a given day
    from the curated featured verses. This ensures all users see the same
    "verse of the day" and it's always a showcase-worthy verse.

    Args:
        db: Database session

    Returns:
        Verse of the day

    Raises:
        HTTPException: If no verses found
    """
    # Try cache first (cached until midnight UTC)
    cache_key = daily_verse_key()
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Cache hit for daily verse")
        return cached

    today = date.today()
    day_of_year = today.timetuple().tm_yday

    # Get featured verses count (cached since it rarely changes)
    count_cache_key = featured_count_key()
    featured_count = cache.get(count_cache_key)
    if featured_count is None:
        featured_count = (
            db.query(func.count(Verse.id)).filter(Verse.is_featured.is_(True)).scalar()
        )
        cache.set(count_cache_key, featured_count, settings.CACHE_TTL_FEATURED_COUNT)

    if featured_count and featured_count > 0:
        # Use featured verses only
        verse_index = day_of_year % featured_count
        verse = (
            db.query(Verse)
            .filter(Verse.is_featured.is_(True))
            .offset(verse_index)
            .first()
        )
    else:
        # Fallback to all verses if no featured ones
        total_verses = db.query(func.count(Verse.id)).scalar()

        if not total_verses or total_verses == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ERR_NO_VERSES_IN_DB,
            )

        verse_index = day_of_year % total_verses
        verse = db.query(Verse).offset(verse_index).first()

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERR_VERSE_NOT_FOUND
        )

    # Cache until midnight UTC
    verse_data = VerseResponse.model_validate(verse).model_dump()
    ttl = calculate_midnight_ttl()
    cache.set(cache_key, verse_data, ttl)

    logger.info(f"Verse of the day ({today}): {verse.canonical_id}")
    return verse


@router.get("/batch", response_model=List[VerseResponse])
@limiter.limit("30/minute")
async def get_verses_batch(
    request: Request,
    ids: str = Query(..., description="Comma-separated canonical IDs (e.g., BG_2_47,BG_3_35)"),
    db: Session = Depends(get_db),
):
    """
    Get multiple verses by canonical IDs in a single request.

    More efficient than N individual requests for favorites/bookmarks.
    Returns verses in the same order as requested, skipping any not found.

    Args:
        ids: Comma-separated canonical IDs (max 100)
        db: Database session

    Returns:
        List of verses in requested order (missing IDs are omitted)
    """
    canonical_ids = [id.strip() for id in ids.split(",") if id.strip()]

    if not canonical_ids:
        return []

    # Limit to prevent abuse
    if len(canonical_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 verse IDs per request",
        )

    # Check cache for each ID
    results = {}
    uncached_ids = []

    for cid in canonical_ids:
        cache_key = verse_key(cid)
        cached = cache.get(cache_key)
        if cached:
            results[cid] = cached
        else:
            uncached_ids.append(cid)

    # Batch load uncached verses from DB
    if uncached_ids:
        repo = VerseRepository(db)
        verses = (
            db.query(Verse)
            .filter(Verse.canonical_id.in_(uncached_ids))
            .all()
        )

        for verse in verses:
            verse_data = VerseResponse.model_validate(verse).model_dump()
            # Cache for future requests
            cache.set(verse_key(verse.canonical_id), verse_data, settings.CACHE_TTL_VERSE)
            results[verse.canonical_id] = verse_data

    # Return in requested order, skipping missing
    return [results[cid] for cid in canonical_ids if cid in results]


@router.get("/{canonical_id}", response_model=VerseResponse)
@limiter.limit("60/minute")
async def get_verse(request: Request, canonical_id: str, db: Session = Depends(get_db)):
    """
    Get a verse by canonical ID.

    Args:
        canonical_id: Canonical verse ID (e.g., BG_2_47)
        db: Database session

    Returns:
        Verse details

    Raises:
        HTTPException: If verse not found
    """
    # Try cache first
    cache_key = verse_key(canonical_id)
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache hit for verse {canonical_id}")
        return cached

    repo = VerseRepository(db)
    verse = repo.get_by_canonical_id(canonical_id)

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Verse {canonical_id} not found",
        )

    # Cache the result
    verse_data = VerseResponse.model_validate(verse).model_dump()
    cache.set(cache_key, verse_data, settings.CACHE_TTL_VERSE)

    return verse


@router.get("/{canonical_id}/translations", response_model=List[TranslationResponse])
@limiter.limit("60/minute")
async def get_verse_translations(
    request: Request, canonical_id: str, db: Session = Depends(get_db)
):
    """
    Get all translations for a verse by canonical ID.

    Args:
        canonical_id: Canonical verse ID (e.g., BG_2_47)
        db: Database session

    Returns:
        List of translations for the verse

    Raises:
        HTTPException: If verse not found
    """
    # First verify the verse exists
    repo = VerseRepository(db)
    verse = repo.get_by_canonical_id(canonical_id)

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Verse {canonical_id} not found",
        )

    # Get all translations for this verse
    translations = (
        db.query(Translation)
        .filter(Translation.verse_id == verse.id)
        .order_by(Translation.translator)
        .all()
    )

    logger.info(f"Found {len(translations)} translations for {canonical_id}")

    return translations
