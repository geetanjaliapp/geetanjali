"""Verse query endpoints."""

import logging
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db import get_db
from db.repositories.verse_repository import VerseRepository
from api.schemas import VerseResponse, TranslationResponse
from models.verse import Verse, Translation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/verses")


@router.get("/count")
async def get_verses_count(
    chapter: Optional[int] = Query(None, ge=1, le=18, description="Filter by chapter"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    db: Session = Depends(get_db)
):
    """
    Get total count of verses matching filters.

    Args:
        chapter: Filter by chapter number
        featured: Filter by featured status (true/false)
        db: Database session

    Returns:
        Count of matching verses
    """
    query = db.query(func.count(Verse.id))

    if chapter:
        query = query.filter(Verse.chapter == chapter)

    if featured is not None:
        query = query.filter(Verse.is_featured == featured)

    count = query.scalar()
    return {"count": count}


@router.get("", response_model=List[VerseResponse])
async def search_verses(
    q: Optional[str] = Query(None, description="Search by canonical ID or principle"),
    chapter: Optional[int] = Query(None, ge=1, le=18, description="Filter by chapter"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    principles: Optional[str] = Query(None, description="Comma-separated principle tags"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
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

    # Search by canonical ID if query looks like one
    if q and q.startswith("BG_"):
        verse = repo.get_by_canonical_id(q)
        return [verse] if verse else []

    # Search by principles
    if principles:
        principle_list = [p.strip() for p in principles.split(",")]
        return repo.search_by_principles(principle_list)

    # Build query with filters
    query = db.query(Verse)

    # Filter by chapter
    if chapter:
        query = query.filter(Verse.chapter == chapter)

    # Filter by featured status
    if featured is not None:
        query = query.filter(Verse.is_featured == featured)

    # Always sort by chapter, then verse number
    query = query.order_by(Verse.chapter, Verse.verse)

    # Apply pagination
    return query.offset(skip).limit(limit).all()


@router.get("/random", response_model=VerseResponse)
async def get_random_verse(
    featured_only: bool = Query(
        True,
        description="If true, only return from curated showcase-worthy verses"
    ),
    db: Session = Depends(get_db)
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
    query = db.query(Verse)

    if featured_only:
        query = query.filter(Verse.is_featured == True)

    verse = query.order_by(func.random()).first()

    if not verse:
        # Fallback to any verse if no featured verses found
        if featured_only:
            logger.warning("No featured verses found, falling back to any verse")
            verse = db.query(Verse).order_by(func.random()).first()

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No verses found in database"
        )

    return verse


@router.get("/daily", response_model=VerseResponse)
async def get_verse_of_the_day(db: Session = Depends(get_db)):
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
    today = date.today()
    day_of_year = today.timetuple().tm_yday

    # Get featured verses count first, fallback to all if none featured
    featured_count = db.query(func.count(Verse.id)).filter(
        Verse.is_featured == True
    ).scalar()

    if featured_count and featured_count > 0:
        # Use featured verses only
        verse_index = day_of_year % featured_count
        verse = db.query(Verse).filter(
            Verse.is_featured == True
        ).offset(verse_index).first()
    else:
        # Fallback to all verses if no featured ones
        total_verses = db.query(func.count(Verse.id)).scalar()

        if not total_verses or total_verses == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No verses found in database"
            )

        verse_index = day_of_year % total_verses
        verse = db.query(Verse).offset(verse_index).first()

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verse not found"
        )

    logger.info(f"Verse of the day ({today}): {verse.canonical_id}")
    return verse


@router.get("/{canonical_id}", response_model=VerseResponse)
async def get_verse(
    canonical_id: str,
    db: Session = Depends(get_db)
):
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
    repo = VerseRepository(db)
    verse = repo.get_by_canonical_id(canonical_id)

    if not verse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Verse {canonical_id} not found"
        )

    return verse


@router.get("/{canonical_id}/translations", response_model=List[TranslationResponse])
async def get_verse_translations(
    canonical_id: str,
    db: Session = Depends(get_db)
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
            detail=f"Verse {canonical_id} not found"
        )

    # Get all translations for this verse
    translations = db.query(Translation).filter(
        Translation.verse_id == verse.id
    ).order_by(Translation.translator).all()

    logger.info(f"Found {len(translations)} translations for {canonical_id}")

    return translations
