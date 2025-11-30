"""Health check endpoints."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db, check_db_connection
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.

    Returns:
        Health status
    """
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
    }


@router.get("/health/live")
async def liveness_check():
    """
    Kubernetes liveness probe.

    Returns:
        Liveness status
    """
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Kubernetes readiness probe - checks dependencies.

    Args:
        db: Database session

    Returns:
        Readiness status with dependency checks
    """
    checks = {
        "database": False,
        "ollama": False,  # Will implement in Phase 4
        "chroma": False,  # Will implement in Phase 3
    }

    # Check database
    try:
        checks["database"] = check_db_connection()
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    # Overall status
    all_ready = checks["database"]  # For now, only check DB

    return {
        "status": "ready" if all_ready else "not_ready",
        "checks": checks,
    }
