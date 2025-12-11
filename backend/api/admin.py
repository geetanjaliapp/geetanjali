"""Admin endpoints for data management."""

import logging
import threading
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from api.dependencies import verify_admin_api_key
from db.connection import get_db
from models import Verse
from services.ingestion.pipeline import IngestionPipeline
from services.email import send_alert_email
from data.featured_verses import get_featured_verse_ids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin")


class IngestionRequest(BaseModel):
    """Request model for data ingestion."""

    source_type: Optional[str] = (
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


def run_ingestion_task(source_type: Optional[str] = None, force_refresh: bool = False):
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

    Args:
        db: Database session

    Returns:
        Stats dict with synced/not_found counts
    """
    featured_ids = get_featured_verse_ids()

    # Reset all to not featured first
    db.query(Verse).update({"is_featured": False})

    # Mark featured verses
    synced = 0
    not_found = []

    for canonical_id in featured_ids:
        result = (
            db.query(Verse)
            .filter(Verse.canonical_id == canonical_id)
            .update({"is_featured": True})
        )

        if result > 0:
            synced += 1
        else:
            not_found.append(canonical_id)

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

    try:
        logger.info("=" * 80)
        logger.info("BACKGROUND ENRICHMENT OF EXISTING VERSES STARTED")
        logger.info(f"Limit: {limit or 'all'}")
        logger.info(f"Force re-enrich: {force}")
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
        logger.info(f"Found {total} verses to enrich")

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

                # Run enrichment
                enriched = enricher.enrich_verse(
                    verse_dict,
                    extract_principles=True,
                    generate_paraphrase=True,
                    transliterate=True,
                )

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
                    db.commit()
                    enriched_count += 1
                else:
                    skipped_count += 1

                if (i + 1) % 10 == 0:
                    logger.info(f"Progress: {i + 1}/{total} verses processed")

            except Exception as e:
                logger.error(f"Failed to enrich {verse.canonical_id}: {e}")
                error_count += 1
                db.rollback()

        logger.info("=" * 80)
        logger.info("BACKGROUND ENRICHMENT COMPLETED")
        logger.info(f"Enriched: {enriched_count}")
        logger.info(f"Skipped: {skipped_count}")
        logger.info(f"Errors: {error_count}")
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
