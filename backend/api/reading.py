"""Reading Mode metadata endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.dependencies import limiter
from api.schemas import (
    BookMetadataResponse,
    ChapterMetadataResponse,
)
from config import settings
from db import get_db
from models.metadata import BookMetadata, ChapterMetadata
from services.cache import (
    book_metadata_key,
    cache,
    chapter_metadata_key,
    chapters_metadata_key,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reading")


@router.get("/book", response_model=BookMetadataResponse)
@limiter.limit("60/minute")
async def get_book_metadata(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Get book metadata for the cover page.

    Returns cover page content: title, tagline, intro text, and stats.
    Currently only supports Bhagavad Geeta (book_key='bhagavad_geeta').

    Returns:
        Book metadata for the cover page

    Raises:
        HTTPException: If book metadata not found
    """
    # Try cache first (book metadata is static)
    cache_key = book_metadata_key()
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Cache hit for book metadata")
        return cached

    book = (
        db.query(BookMetadata).filter(BookMetadata.book_key == "bhagavad_geeta").first()
    )

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book metadata not found. Run sync-metadata to populate.",
        )

    # Cache the result
    book_data = BookMetadataResponse.model_validate(book).model_dump()
    cache.set(cache_key, book_data, settings.CACHE_TTL_METADATA)

    return book


@router.get("/chapters", response_model=list[ChapterMetadataResponse])
@limiter.limit("60/minute")
async def get_all_chapters(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Get metadata for all 18 chapters.

    Returns chapter intro content for all chapters, ordered by chapter number.

    Returns:
        List of all chapter metadata
    """
    # Try cache first (chapter metadata is static)
    cache_key = chapters_metadata_key()
    cached = cache.get(cache_key)
    if cached:
        logger.debug("Cache hit for all chapters metadata")
        return cached

    chapters = db.query(ChapterMetadata).order_by(ChapterMetadata.chapter_number).all()

    # Cache the result
    chapters_data = [
        ChapterMetadataResponse.model_validate(ch).model_dump() for ch in chapters
    ]
    cache.set(cache_key, chapters_data, settings.CACHE_TTL_METADATA)

    return chapters


@router.get("/chapters/{chapter_number}", response_model=ChapterMetadataResponse)
@limiter.limit("60/minute")
async def get_chapter_metadata(
    request: Request,
    chapter_number: int,
    db: Session = Depends(get_db),
):
    """
    Get metadata for a specific chapter.

    Args:
        chapter_number: Chapter number (1-18)

    Returns:
        Chapter metadata (intro content)

    Raises:
        HTTPException: If chapter number invalid or metadata not found
    """
    if chapter_number < 1 or chapter_number > 18:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chapter number must be between 1 and 18",
        )

    # Try cache first (chapter metadata is static)
    cache_key = chapter_metadata_key(chapter_number)
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache hit for chapter {chapter_number} metadata")
        return cached

    chapter = (
        db.query(ChapterMetadata)
        .filter(ChapterMetadata.chapter_number == chapter_number)
        .first()
    )

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {chapter_number} metadata not found. Run sync-metadata to populate.",
        )

    # Cache the result
    chapter_data = ChapterMetadataResponse.model_validate(chapter).model_dump()
    cache.set(cache_key, chapter_data, settings.CACHE_TTL_METADATA)

    return chapter
