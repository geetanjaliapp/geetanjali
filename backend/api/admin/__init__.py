"""
Admin API endpoints for data management and system health.

This package provides admin-only endpoints for:
- Data ingestion and enrichment
- Sync operations (featured verses, metadata, audio)
- System health and circuit breaker management

Usage:
    from api.admin import router

    app.include_router(router, tags=["Admin"])
"""

from fastapi import APIRouter

from .health import router as health_router
from .ingestion import router as ingestion_router
from .sync import router as sync_router

# Re-export sync functions for startup_sync.py
from .sync import (
    sync_featured_verses,
    sync_geeta_dhyanam,
    sync_metadata,
    sync_verse_audio_metadata,
)

router = APIRouter(prefix="/api/v1/admin")
router.include_router(ingestion_router)
router.include_router(sync_router)
router.include_router(health_router)

__all__ = [
    "router",
    # Sync functions for startup
    "sync_featured_verses",
    "sync_metadata",
    "sync_geeta_dhyanam",
    "sync_verse_audio_metadata",
]
