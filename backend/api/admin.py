"""Admin endpoints for data management."""

import logging
import threading
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import verify_admin_api_key
from data.featured_verses import get_featured_verse_ids
from db.connection import get_db
from models import Verse
from services.email import send_alert_email
from services.ingestion.pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin")


class IngestionRequest(BaseModel):
    """Request model for data ingestion."""

    source_type: str | None = (
        None  # sanskrit, translations, commentaries, or None for all
    )
    force_refresh: bool = False


class IngestionStatus(BaseModel):
    """Response model for ingestion status."""

    status: str
    message: str
    verse_count: int
    ingestion_running: bool = False


# Thread-safe ingestion state management
# Uses a lock to prevent race conditions when checking/setting ingestion status
_ingestion_lock = threading.Lock()
_ingestion_running = False


@router.get("/status", response_model=IngestionStatus)
def get_status(db: Session = Depends(get_db)):
    """
    Get current data ingestion status.

    Returns:
        Current verse count and ingestion status
    """
    try:
        verse_count = db.query(Verse).count()

        if verse_count == 0:
            status = "empty"
            message = (
                "No data ingested yet. Use POST /api/v1/admin/ingest to load data."
            )
        elif verse_count < 100:
            status = "incomplete"
            message = (
                f"Only {verse_count} verses found. Full Bhagavad Geeta has 700 verses."
            )
        else:
            status = "ready"
            message = f"Database contains {verse_count} verses."

        return IngestionStatus(
            status=status,
            message=message,
            verse_count=verse_count,
            ingestion_running=_ingestion_running,
        )

    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve status")


@router.post("/ingest", response_model=IngestionStatus)
def trigger_ingestion(
    request: IngestionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Trigger data ingestion manually.

    This endpoint fetches and stores verse data from configured sources.
    Use /api/v1/admin/enrich afterwards to add LLM-generated content.

    This endpoint allows you to:
    - Load initial data if database is empty
    - Refresh data from sources (with force_refresh=true)
    - Load specific source types only

    Note: Ingestion runs in the background to avoid request timeouts.
    Check /api/v1/admin/status to monitor progress.

    Args:
        request: Ingestion configuration
        background_tasks: FastAPI background tasks handler
        db: Database session

    Returns:
        Current status after queuing ingestion
    """
    global _ingestion_running

    # Atomically check and set the flag to prevent race conditions
    with _ingestion_lock:
        if _ingestion_running:
            raise HTTPException(
                status_code=409,
                detail="Ingestion is already running. Please wait for it to complete.",
            )
        _ingestion_running = True

    try:
        verse_count = db.query(Verse).count()

        # Queue ingestion in background
        background_tasks.add_task(
            run_ingestion_task,
            source_type=request.source_type,
            force_refresh=request.force_refresh,
        )

        return IngestionStatus(
            status="queued",
            message="Ingestion queued and running in background. Check /api/v1/admin/status for progress.",
            verse_count=verse_count,
            ingestion_running=True,
        )

    except HTTPException:
        raise
    except Exception as e:
        # Reset flag on error since ingestion didn't start
        with _ingestion_lock:
            _ingestion_running = False
        logger.error(f"Failed to queue ingestion: {e}")
        raise HTTPException(status_code=500, detail="Failed to queue ingestion")


def run_ingestion_task(source_type: str | None = None, force_refresh: bool = False):
    """
    Background task to run data ingestion.

    Args:
        source_type: Type of sources to ingest (None for all)
        force_refresh: Whether to force refresh from sources
    """
    global _ingestion_running

    from db.connection import SessionLocal

    db = SessionLocal()
    try:
        logger.info("=" * 80)
        logger.info("BACKGROUND INGESTION STARTED")
        logger.info(f"Source type: {source_type or 'all'}")
        logger.info(f"Force refresh: {force_refresh}")
        logger.info("=" * 80)

        pipeline = IngestionPipeline(db)

        source_types = [source_type] if source_type else None

        stats = pipeline.ingest_all_sources(
            source_types=source_types,
            force_refresh=force_refresh,
            enrich=False,
            dry_run=False,
        )

        # Log results
        total_created = sum(s.get("created", 0) for s in stats.values())
        total_updated = sum(s.get("updated", 0) for s in stats.values())
        total_errors = sum(s.get("errors", 0) for s in stats.values())

        logger.info("=" * 80)
        logger.info("BACKGROUND INGESTION COMPLETED")
        logger.info(f"Created: {total_created}")
        logger.info(f"Updated: {total_updated}")
        logger.info(f"Errors: {total_errors}")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Background ingestion failed: {e}", exc_info=True)

    finally:
        db.close()
        with _ingestion_lock:
            _ingestion_running = False


class SyncFeaturedResponse(BaseModel):
    """Response model for featured verses sync."""

    status: str
    message: str
    total_featured: int
    synced: int
    not_found: int


def sync_featured_verses(db: Session) -> dict:
    """
    Sync featured verses from static list to database.

    This updates the is_featured column based on the curated list in code.
    Should be called after ingestion or on startup.

    OPTIMIZATION: Uses bulk UPDATE with IN clause instead of N individual updates.
    Reduces 180+ queries to 2 queries.

    Args:
        db: Database session

    Returns:
        Stats dict with synced/not_found counts
    """
    featured_ids = get_featured_verse_ids()

    # Step 1: Reset all to not featured (1 query)
    db.query(Verse).update({"is_featured": False})

    # Step 2: Bulk update all featured verses in one query
    # Uses canonical_id IN (...) instead of loop
    synced = (
        db.query(Verse)
        .filter(Verse.canonical_id.in_(featured_ids))
        .update({"is_featured": True}, synchronize_session="fetch")
    )

    # Step 3: Find which IDs weren't found (only if needed for logging)
    not_found = []
    if synced < len(featured_ids):
        found_ids = {
            row[0]
            for row in db.query(Verse.canonical_id)
            .filter(Verse.canonical_id.in_(featured_ids))
            .all()
        }
        not_found = [cid for cid in featured_ids if cid not in found_ids]

    db.commit()

    if not_found:
        logger.warning(
            f"Featured verses not found in DB: {not_found[:10]}{'...' if len(not_found) > 10 else ''}"
        )

    logger.info(f"Synced {synced}/{len(featured_ids)} featured verses")

    return {
        "total_featured": len(featured_ids),
        "synced": synced,
        "not_found": len(not_found),
        "not_found_ids": not_found,
    }


@router.post("/sync-featured", response_model=SyncFeaturedResponse)
def trigger_sync_featured(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync featured verses from curated list to database.

    This marks verses as is_featured=True based on the static curated list.
    Run this after data ingestion to ensure featured flags are set.

    Returns:
        Sync statistics
    """
    try:
        stats = sync_featured_verses(db)

        return SyncFeaturedResponse(
            status="success",
            message=f"Synced {stats['synced']} of {stats['total_featured']} featured verses.",
            total_featured=stats["total_featured"],
            synced=stats["synced"],
            not_found=stats["not_found"],
        )

    except Exception as e:
        logger.error(f"Failed to sync featured verses: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync featured verses")


# =============================================================================
# Metadata Sync (Book & Chapter Intros)
# =============================================================================


class SyncMetadataResponse(BaseModel):
    """Response model for metadata sync."""

    status: str
    message: str
    book_synced: bool
    chapters_synced: int


def sync_metadata(db: Session) -> dict:
    """
    Sync book and chapter metadata from static data to database.

    This updates the book_metadata and chapter_metadata tables based on
    the curated content in data/chapter_metadata.py.

    Args:
        db: Database session

    Returns:
        Stats dict with sync results
    """
    from datetime import datetime

    from data.chapter_metadata import get_all_chapter_metadata, get_book_metadata
    from models import BookMetadata, ChapterMetadata

    book_data = get_book_metadata()
    chapters_data = get_all_chapter_metadata()

    # Sync book metadata
    book_synced = False
    existing_book = (
        db.query(BookMetadata).filter(BookMetadata.book_key == "bhagavad_geeta").first()
    )

    if existing_book:
        # Update existing
        existing_book.sanskrit_title = book_data["sanskrit_title"]
        existing_book.transliteration = book_data["transliteration"]
        existing_book.english_title = book_data["english_title"]
        existing_book.tagline = book_data["tagline"]
        existing_book.intro_text = book_data["intro_text"]
        existing_book.verse_count = book_data["verse_count"]
        existing_book.chapter_count = book_data["chapter_count"]
        existing_book.updated_at = datetime.utcnow()
        book_synced = True
    else:
        # Create new
        new_book = BookMetadata(
            book_key="bhagavad_geeta",
            sanskrit_title=book_data["sanskrit_title"],
            transliteration=book_data["transliteration"],
            english_title=book_data["english_title"],
            tagline=book_data["tagline"],
            intro_text=book_data["intro_text"],
            verse_count=book_data["verse_count"],
            chapter_count=book_data["chapter_count"],
        )
        db.add(new_book)
        book_synced = True

    # Sync chapter metadata
    chapters_synced = 0
    for ch_data in chapters_data:
        existing_ch = (
            db.query(ChapterMetadata)
            .filter(ChapterMetadata.chapter_number == ch_data["chapter_number"])
            .first()
        )

        if existing_ch:
            # Update existing
            existing_ch.sanskrit_name = ch_data["sanskrit_name"]
            existing_ch.transliteration = ch_data["transliteration"]
            existing_ch.english_title = ch_data["english_title"]
            existing_ch.subtitle = ch_data["subtitle"]
            existing_ch.summary = ch_data["summary"]
            existing_ch.verse_count = ch_data["verse_count"]
            existing_ch.key_themes = ch_data["key_themes"]
            existing_ch.updated_at = datetime.utcnow()
        else:
            # Create new
            new_ch = ChapterMetadata(
                chapter_number=ch_data["chapter_number"],
                sanskrit_name=ch_data["sanskrit_name"],
                transliteration=ch_data["transliteration"],
                english_title=ch_data["english_title"],
                subtitle=ch_data["subtitle"],
                summary=ch_data["summary"],
                verse_count=ch_data["verse_count"],
                key_themes=ch_data["key_themes"],
            )
            db.add(new_ch)

        chapters_synced += 1

    db.commit()

    logger.info(f"Synced book metadata and {chapters_synced} chapters")

    return {
        "book_synced": book_synced,
        "chapters_synced": chapters_synced,
    }


@router.post("/sync-metadata", response_model=SyncMetadataResponse)
def trigger_sync_metadata(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync book and chapter metadata from curated content to database.

    This populates/updates the book_metadata and chapter_metadata tables
    with content for the Reading Mode cover page and chapter intros.

    Returns:
        Sync statistics
    """
    try:
        stats = sync_metadata(db)

        return SyncMetadataResponse(
            status="success",
            message=f"Synced book metadata and {stats['chapters_synced']} chapters.",
            book_synced=stats["book_synced"],
            chapters_synced=stats["chapters_synced"],
        )

    except Exception as e:
        logger.error(f"Failed to sync metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync metadata")


# =============================================================================
# Dhyanam Sync (9 Invocation Verses)
# =============================================================================


class SyncDhyanamResponse(BaseModel):
    """Response model for dhyanam sync."""

    status: str
    message: str
    total_dhyanam: int
    synced: int


def sync_geeta_dhyanam(db: Session) -> dict[str, int]:
    """
    Sync Geeta Dhyanam verses from static data to database.

    This syncs the 9 invocation verses from data/geeta_dhyanam.py
    to the dhyanam_verses table.

    Args:
        db: Database session

    Returns:
        Stats dict with sync results
    """
    from datetime import datetime

    from data.geeta_dhyanam import get_geeta_dhyanam
    from models import DhyanamVerse

    dhyanam_data = get_geeta_dhyanam()

    synced = 0
    for verse_data in dhyanam_data:
        existing = (
            db.query(DhyanamVerse)
            .filter(DhyanamVerse.verse_number == verse_data["verse_number"])
            .first()
        )

        if existing:
            # Update existing
            existing.sanskrit = verse_data["sanskrit"]
            existing.iast = verse_data["iast"]
            existing.english = verse_data["english"]
            existing.hindi = verse_data["hindi"]
            existing.theme = verse_data["theme"]
            existing.duration_ms = verse_data["duration_ms"]
            existing.audio_url = verse_data["audio_url"]
            existing.updated_at = datetime.utcnow()
        else:
            # Create new
            new_verse = DhyanamVerse(
                verse_number=verse_data["verse_number"],
                sanskrit=verse_data["sanskrit"],
                iast=verse_data["iast"],
                english=verse_data["english"],
                hindi=verse_data["hindi"],
                theme=verse_data["theme"],
                duration_ms=verse_data["duration_ms"],
                audio_url=verse_data["audio_url"],
            )
            db.add(new_verse)

        synced += 1

    db.commit()

    logger.info(f"Synced {synced} Geeta Dhyanam verses")

    return {
        "total_dhyanam": len(dhyanam_data),
        "synced": synced,
    }


@router.post("/sync-dhyanam", response_model=SyncDhyanamResponse)
def trigger_sync_dhyanam(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync Geeta Dhyanam invocation verses from curated content to database.

    This populates/updates the dhyanam_verses table with the 9 sacred
    verses traditionally recited before studying the Bhagavad Geeta.

    Returns:
        Sync statistics
    """
    try:
        stats = sync_geeta_dhyanam(db)

        return SyncDhyanamResponse(
            status="success",
            message=f"Synced {stats['synced']} Geeta Dhyanam verses.",
            total_dhyanam=stats["total_dhyanam"],
            synced=stats["synced"],
        )

    except Exception as e:
        logger.error(f"Failed to sync Dhyanam: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync Dhyanam")


# =============================================================================
# Verse Audio Metadata Sync
# =============================================================================


class SyncAudioMetadataResponse(BaseModel):
    """Response model for audio metadata sync."""

    status: str
    message: str
    total_verses: int
    synced: int
    created: int
    updated: int


def sync_verse_audio_metadata(db: Session, chapter: int | None = None) -> dict[str, int]:
    """
    Sync verse audio metadata from static data to database.

    This syncs metadata from data/verse_audio_metadata/ to the
    verse_audio_metadata table, providing TTS generation hints.

    Args:
        db: Database session
        chapter: Optional chapter filter (1-18)

    Returns:
        Stats dict with sync results
    """
    from datetime import datetime

    from data.verse_audio_metadata import get_verse_metadata
    from models import Verse, VerseAudioMetadata

    # Get verses to sync
    query = db.query(Verse)
    if chapter:
        query = query.filter(Verse.chapter == chapter)
    verses = query.all()

    synced = 0
    created = 0
    updated = 0

    for verse in verses:
        metadata = get_verse_metadata(verse.canonical_id)

        existing = (
            db.query(VerseAudioMetadata)
            .filter(VerseAudioMetadata.canonical_id == verse.canonical_id)
            .first()
        )

        # Extract discourse_context once for use in both branches
        discourse_ctx = metadata.get("discourse_context")
        discourse_context_str = str(discourse_ctx) if discourse_ctx else None

        if existing:
            # Update existing (preserve audio file paths if set)
            existing.speaker = str(metadata.get("speaker", "krishna"))
            existing.addressee = str(metadata.get("addressee", "arjuna"))
            existing.discourse_type = str(metadata.get("discourse_type", "teaching"))
            existing.discourse_context = discourse_context_str
            existing.emotional_tone = str(metadata.get("emotional_tone", "neutral"))
            existing.intensity = str(metadata.get("intensity", "moderate"))
            existing.pacing = str(metadata.get("pacing", "moderate"))
            existing.theological_weight = str(
                metadata.get("theological_weight", "standard")
            )
            existing.updated_at = datetime.utcnow()
            updated += 1
        else:
            # Create new
            new_meta = VerseAudioMetadata(
                verse_id=verse.id,
                canonical_id=verse.canonical_id,
                speaker=str(metadata.get("speaker", "krishna")),
                addressee=str(metadata.get("addressee", "arjuna")),
                discourse_type=str(metadata.get("discourse_type", "teaching")),
                discourse_context=discourse_context_str,
                emotional_tone=str(metadata.get("emotional_tone", "neutral")),
                intensity=str(metadata.get("intensity", "moderate")),
                pacing=str(metadata.get("pacing", "moderate")),
                theological_weight=str(metadata.get("theological_weight", "standard")),
            )
            db.add(new_meta)
            created += 1

        synced += 1

    db.commit()

    chapter_msg = f" for chapter {chapter}" if chapter else ""
    logger.info(f"Synced {synced} verse audio metadata entries{chapter_msg}")

    return {
        "total_verses": len(verses),
        "synced": synced,
        "created": created,
        "updated": updated,
    }


@router.post("/sync-audio-metadata", response_model=SyncAudioMetadataResponse)
def trigger_sync_audio_metadata(
    chapter: int | None = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Sync verse audio metadata from curated content to database.

    This populates/updates the verse_audio_metadata table with TTS
    generation hints (speaker, tone, pacing, etc.) from the code-first
    curation in data/verse_audio_metadata/.

    Args:
        chapter: Optional chapter filter (1-18). If not provided, syncs all.

    Returns:
        Sync statistics
    """
    if chapter is not None and (chapter < 1 or chapter > 18):
        raise HTTPException(status_code=400, detail="Chapter must be between 1 and 18")

    try:
        stats = sync_verse_audio_metadata(db, chapter)

        chapter_msg = f" for chapter {chapter}" if chapter else ""
        return SyncAudioMetadataResponse(
            status="success",
            message=f"Synced {stats['synced']} verse audio metadata entries{chapter_msg}.",
            total_verses=stats["total_verses"],
            synced=stats["synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    except Exception as e:
        logger.error(f"Failed to sync audio metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync audio metadata")


class EnrichRequest(BaseModel):
    """Request model for enriching verses with LLM-generated content."""

    limit: int = 0  # 0 means all verses
    force: bool = False  # Re-enrich even if already enriched


class EnrichResponse(BaseModel):
    """Response model for enrichment status."""

    status: str
    message: str
    total_verses: int
    enriched: int
    skipped: int
    errors: int


@router.post("/enrich", response_model=EnrichResponse)
def enrich_verses(
    request: EnrichRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Enrich database verses with LLM-generated content.

    Run this after /api/v1/admin/ingest to add AI-generated enhancements:
    - consulting_principles: Leadership principles extracted from the verse
    - paraphrase_en: Brief modern summary for UI display

    Args:
        request: Enrichment configuration
            - limit: Max verses to process (0 = all)
            - force: Re-enrich even if already done
        background_tasks: FastAPI background tasks handler
        db: Database session

    Returns:
        Enrichment status
    """
    global _ingestion_running

    with _ingestion_lock:
        if _ingestion_running:
            raise HTTPException(
                status_code=409,
                detail="Ingestion/enrichment is already running. Please wait.",
            )
        _ingestion_running = True

    try:
        # Count verses that need enrichment
        # Count all verses that have translations but no enrichment data
        query = db.query(Verse).filter(Verse.translation_en.isnot(None))
        if not request.force:
            # Mark for enrichment if either paraphrase is empty/null OR principles is empty/null
            from sqlalchemy import and_, or_

            query = query.filter(
                or_(
                    and_(Verse.paraphrase_en.is_(None)),
                    and_(Verse.paraphrase_en == ""),
                    and_(Verse.consulting_principles.is_(None)),
                )
            )

        if request.limit > 0:
            query = query.limit(request.limit)

        total_to_enrich = query.count()

        # Queue enrichment in background
        background_tasks.add_task(
            run_enrich_task, limit=request.limit, force=request.force
        )

        return EnrichResponse(
            status="queued",
            message=f"Enrichment queued for ~{total_to_enrich} verses. Check /api/v1/admin/status for progress.",
            total_verses=total_to_enrich,
            enriched=0,
            skipped=0,
            errors=0,
        )

    except HTTPException:
        raise
    except Exception as e:
        with _ingestion_lock:
            _ingestion_running = False
        logger.error(f"Failed to queue enrichment: {e}")
        raise HTTPException(status_code=500, detail="Failed to queue enrichment")


def run_enrich_task(limit: int = 0, force: bool = False):
    """
    Background task to enrich database verses with LLM-generated content.

    Robust implementation with:
    - Rate limiting (3s between verses = ~20 verses/min, well under 50 req/min)
    - Retry with exponential backoff for rate limit errors (429)
    - Failed verse tracking for manual retry
    - Per-verse commit to preserve progress

    Args:
        limit: Max verses to enrich (0 = all)
        force: Re-enrich even if already done
    """
    global _ingestion_running

    from db.connection import SessionLocal
    from services.ingestion.enricher import Enricher

    db = SessionLocal()
    enricher = Enricher()

    enriched_count = 0
    skipped_count = 0
    error_count = 0
    failed_verses = []  # Track failed verse IDs for retry

    # Rate limiting configuration
    # Anthropic: 50 req/min limit, each verse = 2 LLM calls
    # 3s delay = 20 verses/min = 40 calls/min (safe margin)
    DELAY_BETWEEN_VERSES = 3.0

    # Retry configuration for rate limit errors
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 30  # Start with 30s on first 429
    BACKOFF_MULTIPLIER = 2  # Double each retry: 30s, 60s, 120s

    def enrich_with_retry(verse_dict: dict, verse_id: str) -> dict:
        """Enrich a verse with exponential backoff on rate limit errors."""
        last_error: Exception | None = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                return enricher.enrich_verse(
                    verse_dict,
                    extract_principles=True,
                    generate_paraphrase=True,
                    transliterate=True,
                )
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                # Check for rate limit error (429)
                if "429" in error_str or "rate" in error_str or "too many" in error_str:
                    if attempt < MAX_RETRIES:
                        backoff = INITIAL_BACKOFF * (BACKOFF_MULTIPLIER**attempt)
                        logger.warning(
                            f"Rate limit hit for {verse_id}, "
                            f"retry {attempt + 1}/{MAX_RETRIES} after {backoff}s"
                        )
                        time.sleep(backoff)
                        continue
                # Non-rate-limit error or exhausted retries
                raise last_error
        # Should never reach here, but satisfy type checker
        raise RuntimeError("Enrichment failed after retries") from last_error

    try:
        logger.info("=" * 80)
        logger.info("BACKGROUND ENRICHMENT OF EXISTING VERSES STARTED")
        logger.info(f"Limit: {limit or 'all'}")
        logger.info(f"Force re-enrich: {force}")
        logger.info(f"Rate limiting: {DELAY_BETWEEN_VERSES}s delay (~20 verses/min)")
        logger.info(
            f"Retry policy: {MAX_RETRIES} retries with {INITIAL_BACKOFF}s initial backoff"
        )
        logger.info("=" * 80)

        # Load verses with translations
        query = db.query(Verse).filter(Verse.translation_en.isnot(None))
        if not force:
            # Mark for enrichment if either paraphrase is empty/null OR principles is empty/null
            from sqlalchemy import and_, or_

            query = query.filter(
                or_(
                    and_(Verse.paraphrase_en.is_(None)),
                    and_(Verse.paraphrase_en == ""),
                    and_(Verse.consulting_principles.is_(None)),
                )
            )

        if limit > 0:
            query = query.limit(limit)

        verses = query.all()
        total = len(verses)

        # Estimate time: 3s per verse + processing time (~2s) = ~5s per verse
        estimated_minutes = (total * 5) / 60
        logger.info(f"Found {total} verses to enrich")
        logger.info(f"Estimated time: ~{estimated_minutes:.0f} minutes")

        for i, verse in enumerate(verses):
            try:
                # Convert to dict for enricher
                verse_dict = {
                    "canonical_id": verse.canonical_id,
                    "translation_en": verse.translation_en,
                    "sanskrit_devanagari": verse.sanskrit_devanagari,
                    "sanskrit_iast": verse.sanskrit_iast,
                    "paraphrase_en": verse.paraphrase_en if not force else None,
                    "consulting_principles": (
                        verse.consulting_principles if not force else None
                    ),
                }

                # Run enrichment with retry logic
                enriched = enrich_with_retry(verse_dict, verse.canonical_id)

                # Update database
                updated = False
                if (
                    enriched.get("paraphrase_en")
                    and enriched["paraphrase_en"] != verse.paraphrase_en
                ):
                    verse.paraphrase_en = enriched["paraphrase_en"]
                    updated = True
                if enriched.get("consulting_principles"):
                    verse.consulting_principles = enriched["consulting_principles"]
                    updated = True
                if enriched.get("sanskrit_iast") and not verse.sanskrit_iast:
                    verse.sanskrit_iast = enriched["sanskrit_iast"]
                    updated = True

                if updated:
                    enriched_count += 1
                    # Commit after each verse to preserve progress
                    db.commit()
                else:
                    skipped_count += 1

                if (i + 1) % 10 == 0:
                    elapsed_pct = ((i + 1) / total) * 100
                    logger.info(
                        f"Progress: {i + 1}/{total} ({elapsed_pct:.1f}%) - "
                        f"enriched: {enriched_count}, skipped: {skipped_count}, errors: {error_count}"
                    )

            except Exception as e:
                logger.error(f"Failed to enrich {verse.canonical_id}: {e}")
                error_count += 1
                failed_verses.append(verse.canonical_id)
                db.rollback()

            # Rate limiting: wait between verses to stay under API limits
            if i < len(verses) - 1:  # Don't delay after last verse
                time.sleep(DELAY_BETWEEN_VERSES)

        logger.info("=" * 80)
        logger.info("BACKGROUND ENRICHMENT COMPLETED")
        logger.info(f"Enriched: {enriched_count}")
        logger.info(f"Skipped: {skipped_count}")
        logger.info(f"Errors: {error_count}")
        if failed_verses:
            logger.warning(f"Failed verses ({len(failed_verses)}): {failed_verses}")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Background enrichment failed: {e}", exc_info=True)

    finally:
        db.close()
        with _ingestion_lock:
            _ingestion_running = False


class AlertRequest(BaseModel):
    """Request model for sending alerts."""

    subject: str
    message: str


class AlertResponse(BaseModel):
    """Response model for alert status."""

    status: str
    message: str


@router.post("/alert", response_model=AlertResponse)
def send_alert(
    request: AlertRequest,
    _: bool = Depends(verify_admin_api_key),
):
    """
    Send an alert email to the configured admin.

    Used by maintenance scripts and monitoring systems to notify
    about issues like disk space, failed backups, etc.

    Requires X-API-Key header for authentication.

    Args:
        request: Alert subject and message

    Returns:
        Status of the alert delivery
    """
    try:
        success = send_alert_email(request.subject, request.message)

        if success:
            return AlertResponse(
                status="sent",
                message="Alert email sent successfully",
            )
        else:
            return AlertResponse(
                status="failed",
                message="Alert could not be sent - check email configuration",
            )

    except Exception as e:
        logger.error(f"Failed to send alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to send alert")


# =============================================================================
# Circuit Breaker Management
# =============================================================================


class CircuitBreakerResetRequest(BaseModel):
    """Request model for circuit breaker reset."""

    service: str  # email, anthropic, ollama, chromadb


class CircuitBreakerStatusResponse(BaseModel):
    """Response model for circuit breaker status."""

    service: str
    state: str
    failure_count: int
    message: str


@router.post("/circuit-breaker/reset", response_model=CircuitBreakerStatusResponse)
def reset_circuit_breaker(
    request: CircuitBreakerResetRequest,
    _: bool = Depends(verify_admin_api_key),
):
    """
    Manually reset a circuit breaker to closed state.

    Use this endpoint to force-reset a circuit breaker during incident recovery
    when you know the underlying service is healthy but the circuit is stuck open.

    Supported services:
    - email: Email service circuit breaker
    - anthropic: Anthropic LLM circuit breaker
    - ollama: Ollama LLM circuit breaker
    - chromadb: ChromaDB vector store circuit breaker

    Requires X-API-Key header for authentication.
    """
    service = request.service.lower()

    try:
        if service == "email":
            from services.email import _email_circuit_breaker

            if _email_circuit_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="Email circuit breaker not initialized",
                )
            _email_circuit_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="email",
                state=_email_circuit_breaker.state,
                failure_count=_email_circuit_breaker.failure_count,
                message="Email circuit breaker reset to closed state",
            )

        elif service == "anthropic":
            from services.llm import get_llm_service

            llm = get_llm_service()
            if not hasattr(llm, "_anthropic_breaker") or llm._anthropic_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="Anthropic circuit breaker not initialized (mock mode?)",
                )
            llm._anthropic_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="anthropic",
                state=llm._anthropic_breaker.state,
                failure_count=llm._anthropic_breaker.failure_count,
                message="Anthropic circuit breaker reset to closed state",
            )

        elif service == "ollama":
            from services.llm import get_llm_service

            llm = get_llm_service()
            if not hasattr(llm, "_ollama_breaker") or llm._ollama_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="Ollama circuit breaker not initialized",
                )
            llm._ollama_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="ollama",
                state=llm._ollama_breaker.state,
                failure_count=llm._ollama_breaker.failure_count,
                message="Ollama circuit breaker reset to closed state",
            )

        elif service == "chromadb":
            from services.vector_store import get_vector_store

            vs = get_vector_store()
            if not hasattr(vs, "_circuit_breaker") or vs._circuit_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="ChromaDB circuit breaker not initialized",
                )
            vs._circuit_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="chromadb",
                state=vs._circuit_breaker.state,
                failure_count=vs._circuit_breaker.failure_count,
                message="ChromaDB circuit breaker reset to closed state",
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown service: {service}. Valid options: email, anthropic, ollama, chromadb",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset circuit breaker for {service}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset circuit breaker: {str(e)}",
        )


@router.get("/circuit-breaker/status")
def get_circuit_breaker_status(
    _: bool = Depends(verify_admin_api_key),
):
    """
    Get status of all circuit breakers.

    Returns the current state of each circuit breaker:
    - state: closed, open, or half_open
    - failure_count: number of consecutive failures
    - name: circuit breaker identifier

    Requires X-API-Key header for authentication.
    """
    result = {}

    # Email circuit breaker
    try:
        from services.email import _email_circuit_breaker

        if _email_circuit_breaker is not None:
            result["email"] = {
                "state": _email_circuit_breaker.state,
                "failure_count": _email_circuit_breaker.failure_count,
            }
    except Exception as e:
        result["email"] = {"error": str(e)}

    # LLM circuit breakers
    try:
        from services.llm import get_llm_service

        llm = get_llm_service()
        if hasattr(llm, "_anthropic_breaker") and llm._anthropic_breaker is not None:
            result["anthropic"] = {
                "state": llm._anthropic_breaker.state,
                "failure_count": llm._anthropic_breaker.failure_count,
            }
        if hasattr(llm, "_ollama_breaker") and llm._ollama_breaker is not None:
            result["ollama"] = {
                "state": llm._ollama_breaker.state,
                "failure_count": llm._ollama_breaker.failure_count,
            }
    except Exception as e:
        result["llm"] = {"error": str(e)}

    # ChromaDB circuit breaker
    try:
        from services.vector_store import get_vector_store

        vs = get_vector_store()
        if hasattr(vs, "_circuit_breaker") and vs._circuit_breaker is not None:
            result["chromadb"] = {
                "state": vs._circuit_breaker.state,
                "failure_count": vs._circuit_breaker.failure_count,
            }
    except Exception as e:
        result["chromadb"] = {"error": str(e)}

    return {"circuit_breakers": result}
