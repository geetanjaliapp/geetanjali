"""Admin endpoints for data ingestion and enrichment."""

import logging
import threading
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import verify_admin_api_key
from db.connection import get_db
from models import Verse
from services.ingestion.pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Ingestion State Management
# =============================================================================

# Thread-safe ingestion state management
# Uses a lock to prevent race conditions when checking/setting ingestion status
_ingestion_lock = threading.Lock()
_ingestion_running = False


def is_ingestion_running() -> bool:
    """Check if ingestion is currently running."""
    return _ingestion_running


def set_ingestion_running(value: bool) -> None:
    """Set ingestion running state (thread-safe)."""
    global _ingestion_running
    with _ingestion_lock:
        _ingestion_running = value


def acquire_ingestion_lock() -> bool:
    """
    Attempt to acquire the ingestion lock.

    Returns:
        True if lock acquired, False if ingestion already running.
    """
    global _ingestion_running
    with _ingestion_lock:
        if _ingestion_running:
            return False
        _ingestion_running = True
        return True


# =============================================================================
# Request/Response Models
# =============================================================================


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


# =============================================================================
# Ingestion Endpoints
# =============================================================================


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
    if not acquire_ingestion_lock():
        raise HTTPException(
            status_code=409,
            detail="Ingestion is already running. Please wait for it to complete.",
        )

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
        set_ingestion_running(False)
        logger.error(f"Failed to queue ingestion: {e}")
        raise HTTPException(status_code=500, detail="Failed to queue ingestion")


def run_ingestion_task(source_type: str | None = None, force_refresh: bool = False):
    """
    Background task to run data ingestion.

    Args:
        source_type: Type of sources to ingest (None for all)
        force_refresh: Whether to force refresh from sources
    """
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
        set_ingestion_running(False)


# =============================================================================
# Enrichment Endpoints
# =============================================================================


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
    if not acquire_ingestion_lock():
        raise HTTPException(
            status_code=409,
            detail="Ingestion/enrichment is already running. Please wait.",
        )

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
        set_ingestion_running(False)
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
        set_ingestion_running(False)
