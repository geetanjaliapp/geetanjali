"""FastAPI HTTP server for the RQ worker service.

Provides health checks, Prometheus metrics, and admin endpoints.
Runs alongside the RQ worker in the same process.

Port: 8001 (separate from backend's 8000)
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

# Import worker-specific metrics - explicitly excludes business/infra gauges
# See utils/metrics_worker.py for detailed documentation on what's exposed
import utils.metrics_worker  # noqa: F401
from api.dependencies import verify_admin_api_key
from config import settings
from services.cache import get_redis_client

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    """Return current UTC time as ISO format string."""
    return datetime.now(timezone.utc).isoformat()


# FastAPI app for worker
app = FastAPI(
    title="Geetanjali Worker API",
    description="Health, metrics, and admin endpoints for the RQ worker service",
    version="1.0.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url=None,
)

# Prometheus metrics instrumentation - exposes /metrics endpoint
# This exposes all metrics defined in utils/metrics.py (including LLM metrics)
Instrumentator().instrument(app).expose(app, include_in_schema=False)


# Response models
class RootResponse(BaseModel):
    """Root endpoint response."""

    name: str
    service: str
    status: str
    environment: str
    docs: str | None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    service: str = "worker"
    environment: str
    timestamp: str


class ReadinessResponse(BaseModel):
    """Readiness check response with dependency status."""

    status: str
    service: str = "worker"
    timestamp: str
    checks: dict[str, Any]


class QueueResponse(BaseModel):
    """Queue status response."""

    queue_name: str
    pending_jobs: int
    failed_jobs: int
    finished_jobs: int
    timestamp: str


class WorkerStatusResponse(BaseModel):
    """Worker status response."""

    worker_count: int
    workers: list[dict[str, Any]]
    queue: QueueResponse
    timestamp: str


class AdminActionResponse(BaseModel):
    """Admin action response."""

    action: str
    success: bool
    message: str
    timestamp: str


# Root endpoint
@app.get("/", response_model=RootResponse, tags=["Root"])
async def root() -> RootResponse:
    """Root endpoint - service info."""
    return RootResponse(
        name=settings.APP_NAME,
        service="worker",
        status="running",
        environment=settings.APP_ENV,
        docs="/docs" if settings.APP_ENV != "production" else None,
    )


# Health endpoints
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Basic health check - returns OK if worker HTTP server is running."""
    return HealthResponse(
        status="healthy",
        service="worker",
        environment=settings.APP_ENV,
        timestamp=_utc_now(),
    )


@app.get("/health/live", response_model=HealthResponse, tags=["Health"])
async def liveness_check() -> HealthResponse:
    """Kubernetes liveness probe - is the process alive?"""
    return HealthResponse(
        status="alive",
        service="worker",
        environment=settings.APP_ENV,
        timestamp=_utc_now(),
    )


@app.get("/health/ready", response_model=ReadinessResponse, tags=["Health"])
async def readiness_check() -> ReadinessResponse:
    """
    Kubernetes readiness probe - can the worker accept jobs?

    Checks Redis connectivity since worker depends on Redis for job queue.
    """
    checks: dict[str, Any] = {}
    overall_status = "ready"

    # Check Redis connection (critical for worker)
    try:
        redis_client = get_redis_client()
        if redis_client:
            redis_client.ping()
            checks["redis"] = {"status": "connected", "healthy": True}
        else:
            checks["redis"] = {"status": "unavailable", "healthy": False}
            overall_status = "not_ready"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        checks["redis"] = {"status": "error", "error": str(e), "healthy": False}
        overall_status = "not_ready"

    return ReadinessResponse(
        status=overall_status,
        service="worker",
        timestamp=_utc_now(),
        checks=checks,
    )


# Status endpoints
@app.get("/status", response_model=WorkerStatusResponse, tags=["Status"])
async def worker_status() -> WorkerStatusResponse:
    """
    Get worker and queue status.

    Returns information about active workers and queue depth.
    """
    redis_client = get_redis_client()
    workers_info: list[dict[str, Any]] = []
    queue_info = QueueResponse(
        queue_name=settings.RQ_QUEUE_NAME,
        pending_jobs=0,
        failed_jobs=0,
        finished_jobs=0,
        timestamp=_utc_now(),
    )

    if redis_client:
        try:
            # Get worker keys (RQ 2.x pattern)
            worker_keys = redis_client.keys("rq:worker:*") or []
            for key in worker_keys:
                key_str = key.decode() if isinstance(key, bytes) else str(key)
                worker_name = key_str.replace("rq:worker:", "")
                # Get worker data
                worker_data = redis_client.hgetall(key)
                if worker_data:
                    # Handle both bytes and string keys (depends on decode_responses)
                    state_key = b"state" if b"state" in worker_data else "state"
                    raw_state = worker_data.get(state_key, "unknown")
                    state = (
                        raw_state.decode()
                        if isinstance(raw_state, bytes)
                        else str(raw_state)
                    )
                    workers_info.append({"name": worker_name, "state": state})

            # Get queue depths
            queue_key = f"rq:queue:{settings.RQ_QUEUE_NAME}"
            queue_info.pending_jobs = redis_client.llen(queue_key) or 0

            # Failed jobs registry
            failed_key = f"rq:failed:{settings.RQ_QUEUE_NAME}"
            queue_info.failed_jobs = redis_client.zcard(failed_key) or 0

            # Finished jobs registry
            finished_key = f"rq:finished:{settings.RQ_QUEUE_NAME}"
            queue_info.finished_jobs = redis_client.zcard(finished_key) or 0

        except Exception as e:
            logger.error(f"Error fetching worker status: {e}")

    return WorkerStatusResponse(
        worker_count=len(workers_info),
        workers=workers_info,
        queue=queue_info,
        timestamp=_utc_now(),
    )


@app.get("/queue", response_model=QueueResponse, tags=["Status"])
async def queue_status() -> QueueResponse:
    """
    Get queue status.

    Returns job counts in the worker queue.
    """
    redis_client = get_redis_client()
    pending = 0
    failed = 0
    finished = 0

    if redis_client:
        try:
            queue_key = f"rq:queue:{settings.RQ_QUEUE_NAME}"
            pending = redis_client.llen(queue_key) or 0

            failed_key = f"rq:failed:{settings.RQ_QUEUE_NAME}"
            failed = redis_client.zcard(failed_key) or 0

            finished_key = f"rq:finished:{settings.RQ_QUEUE_NAME}"
            finished = redis_client.zcard(finished_key) or 0
        except Exception as e:
            logger.error(f"Error fetching queue status: {e}")

    return QueueResponse(
        queue_name=settings.RQ_QUEUE_NAME,
        pending_jobs=pending,
        failed_jobs=failed,
        finished_jobs=finished,
        timestamp=_utc_now(),
    )


# Admin endpoints (require API key)
#
# NOTE: RQ 2.x doesn't have built-in queue pause/resume at the API level.
# These endpoints set coordination flags that can be checked by monitoring
# systems or custom job logic. To actually stop workers, use:
#   - docker compose stop worker
#   - Or scale to 0 replicas in Kubernetes


@app.get(
    "/admin/pause-status",
    response_model=AdminActionResponse,
    tags=["Admin"],
    dependencies=[Depends(verify_admin_api_key)],
)
async def get_pause_status() -> AdminActionResponse:
    """
    Check if the pause flag is set for this queue.

    This is a coordination flag for monitoring systems.
    It does NOT actually pause RQ workers.

    Requires X-API-Key header with admin API key.
    """
    redis_client = get_redis_client()
    if not redis_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis unavailable",
        )

    try:
        pause_key = f"geetanjali:queue:{settings.RQ_QUEUE_NAME}:pause_requested"
        value = redis_client.get(pause_key)
        # Handle both string and bytes (depends on decode_responses setting)
        is_paused = value in ("1", b"1")

        return AdminActionResponse(
            action="pause-status",
            success=True,
            message="paused" if is_paused else "running",
            timestamp=_utc_now(),
        )
    except Exception as e:
        logger.error(f"Failed to get pause status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@app.post(
    "/admin/request-pause",
    response_model=AdminActionResponse,
    tags=["Admin"],
    dependencies=[Depends(verify_admin_api_key)],
)
async def request_pause() -> AdminActionResponse:
    """
    Set a pause request flag for monitoring/coordination.

    NOTE: This does NOT actually pause the RQ worker. It sets a flag
    that can be checked by monitoring systems or custom job logic.
    To stop the worker, use: docker compose stop worker

    Requires X-API-Key header with admin API key.
    """
    redis_client = get_redis_client()
    if not redis_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis unavailable",
        )

    try:
        pause_key = f"geetanjali:queue:{settings.RQ_QUEUE_NAME}:pause_requested"
        redis_client.set(pause_key, "1")
        logger.warning(f"Pause requested for queue: {settings.RQ_QUEUE_NAME}")

        return AdminActionResponse(
            action="request-pause",
            success=True,
            message=f"Pause flag set for '{settings.RQ_QUEUE_NAME}'. NOTE: Worker still running. Use 'docker compose stop worker' to actually stop.",
            timestamp=_utc_now(),
        )
    except Exception as e:
        logger.error(f"Failed to set pause flag: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@app.post(
    "/admin/clear-pause",
    response_model=AdminActionResponse,
    tags=["Admin"],
    dependencies=[Depends(verify_admin_api_key)],
)
async def clear_pause() -> AdminActionResponse:
    """
    Clear the pause request flag.

    Requires X-API-Key header with admin API key.
    """
    redis_client = get_redis_client()
    if not redis_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis unavailable",
        )

    try:
        pause_key = f"geetanjali:queue:{settings.RQ_QUEUE_NAME}:pause_requested"
        redis_client.delete(pause_key)
        logger.info(f"Pause flag cleared for queue: {settings.RQ_QUEUE_NAME}")

        return AdminActionResponse(
            action="clear-pause",
            success=True,
            message=f"Pause flag cleared for '{settings.RQ_QUEUE_NAME}'",
            timestamp=_utc_now(),
        )
    except Exception as e:
        logger.error(f"Failed to clear pause flag: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
