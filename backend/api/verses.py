"""Verse query endpoints."""

import logging
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db import get_db
from db.repositories.verse_repository import VerseRepository
from api.schemas import VerseResponse
from models.verse import Verse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/verses")


@router.get("", response_model=List[VerseResponse])
async def search_verses(
    q: Optional[str] = Query(None, description="Search by canonical ID or principle"),
    chapter: Optional[int] = Query(None, ge=1, le=18, description="Filter by chapter"),
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
        principles: Comma-separated consulting principles
        skip: Number of records to skip
        limit: Maximum number of records
        db: Database session

    Returns:
        List of matching verses
    """
    repo = VerseRepository(db)

    # Search by canonical ID if query looks like one
    if q and q.startswith("BG_"):
        verse = repo.get_by_canonical_id(q)
        return [verse] if verse else []

    # Filter by chapter
    if chapter:
        return repo.get_by_chapter(chapter)

    # Search by principles
    if principles:
        principle_list = [p.strip() for p in principles.split(",")]
        return repo.search_by_principles(principle_list)

    # Default: return all verses
    return repo.get_all(skip=skip, limit=limit)


@router.get("/random", response_model=VerseResponse)
async def get_random_verse(db: Session = Depends(get_db)):
    """
    Get a random verse from the Bhagavad Gita.

    Args:
        db: Database session

    Returns:
        Random verse

    Raises:
        HTTPException: If no verses found
    """
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

    Uses day of year to deterministically select the same verse for a given day.
    This ensures all users see the same "verse of the day".

    Args:
        db: Database session

    Returns:
        Verse of the day

    Raises:
        HTTPException: If no verses found
    """
    today = date.today()
    day_of_year = today.timetuple().tm_yday

    # Get total verse count
    total_verses = db.query(func.count(Verse.id)).scalar()

    if not total_verses or total_verses == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No verses found in database"
        )

    # Use day of year modulo total verses to get deterministic index
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
