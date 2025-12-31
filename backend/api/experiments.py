"""Experiment events API for A/B testing analytics."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.dependencies import get_session_id, limiter, verify_admin_api_key
from db.connection import get_db
from models.experiment import ExperimentEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/experiments")


class ExperimentEventCreate(BaseModel):
    """Request model for experiment event tracking."""

    experiment: str = Field(..., min_length=1, max_length=100)
    event: str = Field(..., min_length=1, max_length=100)
    properties: dict | None = Field(default=None)
    timestamp: datetime | None = Field(default=None)


class ExperimentEventResponse(BaseModel):
    """Response model for experiment event."""

    success: bool
    id: str | None = None


@router.post("/events", response_model=ExperimentEventResponse)
@limiter.limit("60/minute")
async def track_event(
    request: Request,
    event_data: ExperimentEventCreate,
    db: Session = Depends(get_db),
    session_id: str | None = Depends(get_session_id),
):
    """
    Track an experiment event.

    Events are stored for later analysis via SQL queries.
    This endpoint is designed to be fire-and-forget from the client.

    Args:
        event_data: Event details (experiment name, event type, properties)
        db: Database session
        session_id: Optional session ID for anonymous user tracking

    Returns:
        Success status
    """
    try:
        # Extract variant from properties if present
        variant = None
        if event_data.properties and "variant" in event_data.properties:
            variant = str(event_data.properties["variant"])

        experiment_event = ExperimentEvent(
            experiment=event_data.experiment,
            event=event_data.event,
            variant=variant,
            session_id=session_id,
            properties=event_data.properties,
            timestamp=event_data.timestamp or datetime.utcnow(),
        )

        db.add(experiment_event)
        db.commit()

        logger.debug(
            f"Experiment event tracked: {event_data.experiment}/{event_data.event}"
        )

        return ExperimentEventResponse(success=True, id=experiment_event.id)

    except Exception as e:
        logger.error(f"Failed to track experiment event: {e}")
        db.rollback()
        # Return success anyway - analytics shouldn't break the client
        return ExperimentEventResponse(success=False)


# Admin endpoint for viewing experiment stats (optional, can add auth later)
class ExperimentStats(BaseModel):
    """Experiment statistics response."""

    experiment: str
    variant: str
    total_users: int
    event_counts: dict


@router.get("/stats/{experiment_name}")
@limiter.limit("10/minute")
async def get_experiment_stats(
    request: Request,
    experiment_name: str,
    db: Session = Depends(get_db),
    _admin: bool = Depends(verify_admin_api_key),
):
    """
    Get basic statistics for an experiment.

    Returns counts of events by variant.
    """
    from sqlalchemy import distinct, func

    try:
        # Get unique sessions and event counts by variant
        results = (
            db.query(
                ExperimentEvent.variant,
                func.count(distinct(ExperimentEvent.session_id)).label(
                    "unique_sessions"
                ),
                ExperimentEvent.event,
                func.count(ExperimentEvent.id).label("event_count"),
            )
            .filter(ExperimentEvent.experiment == experiment_name)
            .group_by(ExperimentEvent.variant, ExperimentEvent.event)
            .all()
        )

        # Organize by variant
        stats_by_variant: dict = {}
        for row in results:
            variant = row.variant or "unknown"
            if variant not in stats_by_variant:
                stats_by_variant[variant] = {
                    "unique_sessions": 0,
                    "events": {},
                }
            stats_by_variant[variant]["unique_sessions"] = max(
                stats_by_variant[variant]["unique_sessions"], row.unique_sessions
            )
            stats_by_variant[variant]["events"][row.event] = row.event_count

        return {
            "experiment": experiment_name,
            "variants": stats_by_variant,
        }

    except Exception as e:
        logger.error(f"Failed to get experiment stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve stats")
