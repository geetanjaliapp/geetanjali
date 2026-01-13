"""Comparison mode for multi-pass vs single-pass pipeline evaluation.

Phase 3 feature: Runs both pipelines and stores results for quality analysis.
This enables data-driven decision making before switching primary pipeline.

See: todos/releases/v1.27.0/phase-3-comparison.md for full specification.
"""

import logging
import random
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from config import settings
from models.multipass import MultiPassComparison
from utils.metrics_multipass import (
    comparison_confidence_diff,
    comparison_duration_diff_ms,
    comparison_errors_total,
    comparison_mode_total,
    comparison_pipeline_duration_ms,
)

logger = logging.getLogger(__name__)


@dataclass
class ComparisonResult:
    """Result from comparison mode execution."""

    primary_result: dict[str, Any]
    primary_is_policy_violation: bool
    comparison_id: str | None = None
    multipass_success: bool = False
    singlepass_success: bool = False


def should_run_comparison() -> bool:
    """Check if comparison mode should run for this request.

    Returns:
        True if comparison mode enabled and passes sample rate check.
    """
    if not settings.MULTIPASS_COMPARISON_MODE:
        return False

    # Apply sample rate
    if settings.MULTIPASS_COMPARISON_SAMPLE_RATE < 1.0:
        return random.random() < settings.MULTIPASS_COMPARISON_SAMPLE_RATE

    return True


def run_comparison_pipeline(
    case_id: str,
    case_data: dict,
    db: Session,
) -> ComparisonResult:
    """Run both pipelines and store comparison data.

    Runs multi-pass and single-pass pipelines, stores both results
    in comparison table, and returns the primary result for user response.

    Args:
        case_id: The case ID being analyzed
        case_data: Case data containing title, description, etc.
        db: Database session for storing comparison record

    Returns:
        ComparisonResult with primary result and comparison metadata
    """
    import asyncio

    from services.rag import get_rag_pipeline
    from services.rag.multipass import run_multipass_consultation

    logger.info(f"[Comparison] Running both pipelines for case {case_id}")

    # Initialize result tracking
    multipass_result = None
    multipass_error = None
    multipass_duration_ms = None
    multipass_consultation_id = None

    singlepass_result = None
    singlepass_error = None
    singlepass_duration_ms = None

    # Run multi-pass pipeline
    # Note: asyncio.run() is used intentionally here. This function is called from
    # RQ (Redis Queue) background workers, which run in a synchronous context without
    # an existing event loop. It is NOT called from FastAPI async handlers where
    # asyncio.run() would cause a RuntimeError. The RQ worker spawns a fresh event
    # loop for each job, making asyncio.run() the correct pattern.
    start_time: float | None = None
    try:
        start_time = time.time()
        multipass_output = asyncio.run(
            run_multipass_consultation(
                case_id=case_id,
                title=case_data.get("title", ""),
                description=case_data.get("description", ""),
            )
        )
        multipass_duration_ms = int((time.time() - start_time) * 1000)

        if multipass_output.success and multipass_output.result_json:
            multipass_result = multipass_output.result_json
            multipass_consultation_id = multipass_output.consultation_id
        else:
            multipass_error = multipass_output.fallback_reason or "Pipeline failed"

    except Exception as e:
        logger.error(f"[Comparison] Multi-pass error for case {case_id}: {e}")
        multipass_error = str(e)
        multipass_duration_ms = int((time.time() - start_time) * 1000) if start_time else None
        comparison_errors_total.labels(pipeline="multipass", error_type="exception").inc()

    # Record multipass duration metric
    if multipass_duration_ms is not None:
        comparison_pipeline_duration_ms.labels(pipeline="multipass").observe(
            multipass_duration_ms
        )

    # Run single-pass pipeline
    start_time = None
    try:
        start_time = time.time()
        rag_pipeline = get_rag_pipeline()
        singlepass_output, singlepass_is_policy = rag_pipeline.run(case_data)
        singlepass_duration_ms = int((time.time() - start_time) * 1000)
        singlepass_result = singlepass_output

    except Exception as e:
        logger.error(f"[Comparison] Single-pass error for case {case_id}: {e}")
        singlepass_error = str(e)
        singlepass_duration_ms = int((time.time() - start_time) * 1000) if start_time else None
        comparison_errors_total.labels(pipeline="singlepass", error_type="exception").inc()

    # Record singlepass duration metric
    if singlepass_duration_ms is not None:
        comparison_pipeline_duration_ms.labels(pipeline="singlepass").observe(
            singlepass_duration_ms
        )

    # Determine primary result based on config
    primary = settings.MULTIPASS_COMPARISON_PRIMARY
    if primary == "multipass" and multipass_result:
        primary_result = multipass_result
        primary_is_policy = multipass_output.is_policy_violation if multipass_output else False
    elif primary == "singlepass" and singlepass_result:
        primary_result = singlepass_result
        primary_is_policy = singlepass_is_policy if singlepass_result else False
    elif multipass_result:
        # Fallback: use whichever succeeded
        primary_result = multipass_result
        primary_is_policy = multipass_output.is_policy_violation if multipass_output else False
    elif singlepass_result:
        primary_result = singlepass_result
        primary_is_policy = singlepass_is_policy
    else:
        # Both failed - return minimal error structure
        logger.error(f"[Comparison] Both pipelines failed for case {case_id}")
        primary_result = {
            "executive_summary": "Analysis could not be completed. Please try again.",
            "confidence": 0.0,
            "scholar_flag": True,
        }
        primary_is_policy = False

    # Store comparison record
    comparison_id = _store_comparison_record(
        db=db,
        case_id=case_id,
        primary_pipeline=primary,
        multipass_result=multipass_result,
        multipass_consultation_id=multipass_consultation_id,
        multipass_duration_ms=multipass_duration_ms,
        multipass_error=multipass_error,
        singlepass_result=singlepass_result,
        singlepass_duration_ms=singlepass_duration_ms,
        singlepass_error=singlepass_error,
    )

    # Record comparison metrics
    mp_success_str = "true" if multipass_result is not None else "false"
    sp_success_str = "true" if singlepass_result is not None else "false"
    comparison_mode_total.labels(
        primary_pipeline=primary,
        multipass_success=mp_success_str,
        singlepass_success=sp_success_str,
    ).inc()

    # Record confidence difference metric if both succeeded
    mp_confidence = multipass_result.get("confidence") if multipass_result else None
    sp_confidence = singlepass_result.get("confidence") if singlepass_result else None
    if mp_confidence is not None and sp_confidence is not None:
        comparison_confidence_diff.observe(mp_confidence - sp_confidence)

    # Record duration difference metric if both have duration
    if multipass_duration_ms is not None and singlepass_duration_ms is not None:
        comparison_duration_diff_ms.observe(multipass_duration_ms - singlepass_duration_ms)

    logger.info(
        f"[Comparison] Completed for case {case_id}: "
        f"mp_conf={mp_confidence}, sp_conf={sp_confidence}"
    )

    return ComparisonResult(
        primary_result=primary_result,
        primary_is_policy_violation=primary_is_policy,
        comparison_id=comparison_id,
        multipass_success=multipass_result is not None,
        singlepass_success=singlepass_result is not None,
    )


def _store_comparison_record(
    db: Session,
    case_id: str,
    primary_pipeline: str,
    multipass_result: dict | None,
    multipass_consultation_id: str | None,
    multipass_duration_ms: int | None,
    multipass_error: str | None,
    singlepass_result: dict | None,
    singlepass_duration_ms: int | None,
    singlepass_error: str | None,
) -> str:
    """Store comparison record in database.

    Returns:
        Comparison record ID
    """
    # Extract metrics from results
    mp_confidence = multipass_result.get("confidence") if multipass_result else None
    sp_confidence = singlepass_result.get("confidence") if singlepass_result else None

    mp_scholar = multipass_result.get("scholar_flag") if multipass_result else None
    sp_scholar = singlepass_result.get("scholar_flag") if singlepass_result else None

    # Compute diffs
    confidence_diff = None
    if mp_confidence is not None and sp_confidence is not None:
        confidence_diff = mp_confidence - sp_confidence

    duration_diff = None
    if multipass_duration_ms is not None and singlepass_duration_ms is not None:
        duration_diff = multipass_duration_ms - singlepass_duration_ms

    comparison = MultiPassComparison(
        id=str(uuid.uuid4()),
        case_id=case_id,
        primary_pipeline=primary_pipeline,
        # Multi-pass
        multipass_consultation_id=multipass_consultation_id,
        multipass_success=multipass_result is not None,
        multipass_confidence=mp_confidence,
        multipass_scholar_flag=mp_scholar,
        multipass_duration_ms=multipass_duration_ms,
        multipass_result_json=multipass_result,
        multipass_error=multipass_error,
        # Single-pass
        singlepass_success=singlepass_result is not None,
        singlepass_confidence=sp_confidence,
        singlepass_scholar_flag=sp_scholar,
        singlepass_duration_ms=singlepass_duration_ms,
        singlepass_result_json=singlepass_result,
        singlepass_error=singlepass_error,
        # Computed
        confidence_diff=confidence_diff,
        duration_diff_ms=duration_diff,
        # Timestamps
        created_at=datetime.now(timezone.utc),
    )

    db.add(comparison)
    db.commit()

    logger.debug(f"[Comparison] Stored comparison record {comparison.id}")
    return comparison.id
