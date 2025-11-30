"""Health check endpoints."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db, check_db_connection
from config import settings

logger = logging.getLogger(__name__)


def check_chroma_connection() -> bool:
    """Check if ChromaDB is accessible."""
    try:
        from services.vector_store import get_vector_store
        vector_store = get_vector_store()
        vector_store.count()  # Simple operation to verify connection
        return True
    except Exception as e:
        logger.error(f"ChromaDB health check failed: {e}")
        return False


def check_ollama_connection() -> bool:
    """Check if Ollama is accessible."""
    try:
        from services.llm import get_llm_service
        llm_service = get_llm_service()
        return llm_service.check_health()
    except Exception as e:
        logger.error(f"Ollama health check failed: {e}")
        return False

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
        "chroma": False,
        "ollama": False,
    }

    # Check database
    try:
        checks["database"] = check_db_connection()
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    # Check ChromaDB
    try:
        checks["chroma"] = check_chroma_connection()
    except Exception as e:
        logger.error(f"ChromaDB health check failed: {e}")

    # Check Ollama
    try:
        checks["ollama"] = check_ollama_connection()
    except Exception as e:
        logger.error(f"Ollama health check failed: {e}")

    # Overall status
    all_ready = checks["database"] and checks["chroma"] and checks["ollama"]

    return {
        "status": "ready" if all_ready else "not_ready",
        "checks": checks,
    }
