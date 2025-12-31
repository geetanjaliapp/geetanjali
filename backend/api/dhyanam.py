"""Geeta Dhyanam API endpoints.

The 9 sacred invocation verses traditionally recited before studying the Bhagavad Geeta.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.dependencies import limiter
from api.schemas import GeetaDhyanamVerseResponse
from config import settings
from db import get_db
from db.repositories import DhyanamRepository
from services.cache import cache, dhyanam_all_key, dhyanam_verse_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dhyanam")


@router.get("", response_model=list[GeetaDhyanamVerseResponse])
@limiter.limit("60/minute")
async def get_all_dhyanam_verses(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Get all 9 Geeta Dhyanam (invocation) verses.

    These traditional verses are recited before studying the Bhagavad Geeta.
    Returns all 9 verses with Sanskrit, IAST, English, and Hindi translations.

    Returns:
        List of 9 Geeta Dhyanam verses ordered by verse number
    """
    # Check cache first
    cache_key = dhyanam_all_key()
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Cache hit for all Dhyanam verses")
        return cached

    # Query from database
    repo = DhyanamRepository(db)
    verses = repo.get_all_ordered()

    if not verses:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geeta Dhyanam verses not available.",
        )

    # Convert to response format
    verses_data = [
        GeetaDhyanamVerseResponse.model_validate(v).model_dump() for v in verses
    ]

    # Cache the result
    cache.set(cache_key, verses_data, settings.CACHE_TTL_METADATA)

    return verses_data


@router.get("/count")
@limiter.limit("60/minute")
async def get_dhyanam_count(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Get count of Geeta Dhyanam verses.

    Returns:
        Count of dhyanam verses (should be 9)
    """
    # Cache count (static - always 9 after sync)
    cache_key = "dhyanam:count"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    repo = DhyanamRepository(db)
    count = repo.count()
    result = {"count": count}

    # Cache for 24 hours (static content)
    cache.set(cache_key, result, settings.CACHE_TTL_METADATA)

    return result


@router.get("/{verse_number}", response_model=GeetaDhyanamVerseResponse)
@limiter.limit("60/minute")
async def get_dhyanam_verse(
    request: Request,
    verse_number: int,
    db: Session = Depends(get_db),
):
    """
    Get a single Geeta Dhyanam verse by number.

    Args:
        verse_number: Verse number (1-9)

    Returns:
        Single dhyanam verse with all translations

    Raises:
        HTTPException: If verse number invalid or not found
    """
    if verse_number < 1 or verse_number > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verse number must be between 1 and 9",
        )

    # Check cache first
    cache_key = dhyanam_verse_key(verse_number)
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache hit for Dhyanam verse {verse_number}")
        return cached

    # Query from database
    repo = DhyanamRepository(db)
    verse = repo.get_by_verse_number(verse_number)

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dhyanam verse {verse_number} not found.",
        )

    # Convert to response and cache
    verse_data = GeetaDhyanamVerseResponse.model_validate(verse).model_dump()
    cache.set(cache_key, verse_data, settings.CACHE_TTL_METADATA)

    return verse_data
