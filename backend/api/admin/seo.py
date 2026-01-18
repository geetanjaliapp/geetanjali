"""Admin endpoints for SEO page generation."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import verify_admin_api_key
from db.connection import get_db
from services.seo import GenerationInProgressError, SeoGeneratorService
from utils.metrics_seo import seo_generation_total

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================


class SeoStatusResponse(BaseModel):
    """Response model for SEO status."""

    pages_by_type: dict[str, int]
    total_pages: int
    total_size_bytes: int
    last_generated_at: str | None


class SeoGenerateResponse(BaseModel):
    """Response model for SEO generation trigger."""

    status: str
    message: str
    job_id: str | None = None


class SeoGenerateResultResponse(BaseModel):
    """Response model for SEO generation result (sync mode)."""

    status: str
    total_pages: int
    generated: int
    skipped: int
    errors: int
    duration_ms: int


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/seo/status", response_model=SeoStatusResponse)
def get_seo_status(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Get current SEO generation status.

    Returns page counts by type, total size, and last generation time.
    """
    service = SeoGeneratorService(db)
    status = service.get_status()
    return SeoStatusResponse(**status)


@router.post("/seo/generate", response_model=SeoGenerateResultResponse)
def trigger_seo_generation(
    force: bool = False,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Trigger synchronous SEO page generation.

    Args:
        force: If True, regenerate all pages regardless of hash

    Returns:
        Generation result with statistics

    Raises:
        409 Conflict: If another generation is already in progress
    """
    service = SeoGeneratorService(db)

    try:
        result = service.generate_all(force=force)
        return SeoGenerateResultResponse(
            status="completed",
            total_pages=result.total_pages,
            generated=result.generated,
            skipped=result.skipped,
            errors=result.errors,
            duration_ms=result.duration_ms,
        )
    except GenerationInProgressError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/seo/generate/async", response_model=SeoGenerateResponse)
def trigger_seo_generation_async(
    force: bool = False,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Trigger asynchronous SEO page generation via background task.

    For long-running generation, use this endpoint to avoid HTTP timeout.
    Check status endpoint to monitor progress.

    Args:
        force: If True, regenerate all pages regardless of hash

    Returns:
        Acknowledgment that generation has been queued

    Note:
        This is a simple background task implementation.
        For production with multiple workers, consider using RQ jobs.
    """
    # Note: For a more robust implementation, we would use RQ:
    # from services.tasks import enqueue_task
    # job_id = enqueue_task("seo.generate", force=force)

    def run_generation():
        """Run generation in background."""
        from db.connection import SessionLocal

        db_session = SessionLocal()
        try:
            service = SeoGeneratorService(db_session)
            result = service.generate_all(force=force)
            logger.info(
                f"SEO ASYNC: Completed - "
                f"{result.generated} generated, {result.skipped} skipped"
            )
            seo_generation_total.labels(trigger="async", result="success").inc()
        except GenerationInProgressError:
            logger.warning("SEO ASYNC: Generation already in progress")
            seo_generation_total.labels(trigger="async", result="skipped").inc()
        except Exception as e:
            logger.error(f"SEO ASYNC: Failed - {e}", exc_info=True)
            seo_generation_total.labels(trigger="async", result="error").inc()
            db_session.rollback()
        finally:
            db_session.close()

    background_tasks.add_task(run_generation)

    return SeoGenerateResponse(
        status="queued",
        message="SEO generation queued. Check /seo/status for progress.",
    )
