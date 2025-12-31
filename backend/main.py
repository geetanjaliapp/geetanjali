"""Main FastAPI application."""

import asyncio
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import settings
from services.metrics_collector import collect_metrics
from utils.logging import setup_logging
from utils.metrics_scheduler import start_metrics_scheduler, stop_metrics_scheduler
from utils.sentry import init_sentry

# Initialize Sentry before anything else (captures startup errors)
init_sentry(service_name="backend")
from api import (
    admin,
    auth,
    cases,
    contact,
    dhyanam,
    experiments,
    feed,
    follow_up,
    health,
    messages,
    newsletter,
    outputs,
    preferences,
    reading,
    search,
    sitemap,
    taxonomy,
    tts,
    verses,
)
from api.dependencies import limiter
from api.middleware.csrf import CSRFMiddleware
from utils.exceptions import (
    GeetanjaliException,
    geetanjali_exception_handler,
    general_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)

logger = setup_logging()


# =============================================================================
# Application Lifespan (startup/shutdown)
# =============================================================================


def _load_vector_store_sync() -> None:
    """Load vector store synchronously in a thread."""
    try:
        logger.info("Pre-loading vector store in background (loads embedding model)...")
        from services.vector_store import get_vector_store

        get_vector_store()  # Initialize vector store
        logger.info("Vector store pre-loaded successfully")
    except Exception as e:
        logger.error(
            f"Failed to pre-load vector store: {e} (will load on first request)"
        )


def _sync_curated_content() -> None:
    """Sync curated content to database if not present."""
    try:
        from services.startup_sync import run_startup_sync

        run_startup_sync()
    except Exception as e:
        logger.error(f"Failed to sync curated content: {e}")


def _warm_daily_verse_cache() -> None:
    """Pre-warm daily verse cache to avoid cold-start latency."""
    try:
        from datetime import date

        from sqlalchemy import func

        from api.schemas import VerseResponse
        from db import SessionLocal
        from models.verse import Verse
        from services.cache import (
            cache,
            calculate_midnight_ttl,
            daily_verse_key,
            featured_count_key,
            featured_verse_ids_key,
        )

        # Skip if cache is not available
        if not cache.is_available():
            logger.debug("Cache not available, skipping daily verse warm-up")
            return

        # Check if already cached
        cache_key = daily_verse_key()
        if cache.get(cache_key):
            logger.debug("Daily verse already cached, skipping warm-up")
            return

        logger.info("Warming daily verse cache...")

        with SessionLocal() as db:
            # Warm featured verse count
            count_key = featured_count_key()
            featured_count = cache.get(count_key)
            if featured_count is None:
                featured_count = (
                    db.query(func.count(Verse.id))
                    .filter(Verse.is_featured.is_(True))
                    .scalar()
                )
                cache.set(count_key, featured_count, settings.CACHE_TTL_FEATURED_COUNT)

            # Warm featured verse IDs (used by random verse)
            ids_key = featured_verse_ids_key()
            if not cache.get(ids_key):
                verse_ids = [
                    row[0]
                    for row in db.query(Verse.canonical_id)
                    .filter(Verse.is_featured.is_(True))
                    .all()
                ]
                if verse_ids:
                    cache.set(ids_key, verse_ids, 3600)  # 1 hour TTL

            # Calculate and cache daily verse
            if featured_count and featured_count > 0:
                today = date.today()
                day_of_year = today.timetuple().tm_yday
                verse_index = day_of_year % featured_count
                verse = (
                    db.query(Verse)
                    .filter(Verse.is_featured.is_(True))
                    .offset(verse_index)
                    .first()
                )
                if verse:
                    verse_data = VerseResponse.model_validate(verse).model_dump()
                    ttl = calculate_midnight_ttl()
                    cache.set(cache_key, verse_data, ttl)
                    logger.info(
                        f"Daily verse cached: {verse.canonical_id} (TTL: {ttl}s)"
                    )

    except Exception as e:
        logger.warning(f"Failed to warm daily verse cache: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.

    Handles startup and shutdown events using modern FastAPI pattern.
    Replaces deprecated @app.on_event("startup") and @app.on_event("shutdown").
    """
    # === STARTUP ===
    logger.info(f"Starting {settings.APP_NAME} in {settings.APP_ENV} mode")

    # Sync curated content first (runs synchronously, needed before cache warming)
    # This uses hash-based change detection to only sync when content changes
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _sync_curated_content)

    # Run blocking I/O in thread pool to avoid blocking event loop
    loop.run_in_executor(None, _load_vector_store_sync)
    loop.run_in_executor(None, _warm_daily_verse_cache)

    # Start metrics scheduler (collects business metrics every 60s)
    start_metrics_scheduler(collect_metrics, interval_seconds=60)

    logger.info("Application startup complete")

    yield  # Application runs here

    # === SHUTDOWN ===
    logger.info("Application shutdown initiated")

    stop_metrics_scheduler()

    # Clean up services to release resources
    from services.llm import cleanup_llm_service
    from services.vector_store import cleanup_vector_store

    cleanup_llm_service()
    cleanup_vector_store()

    logger.info("Application shutdown complete")


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    description="Ethical leadership guidance from the Bhagavad Geeta",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(GZipMiddleware, minimum_size=1000)  # Compress responses > 1KB
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Request-ID",
        "X-Session-ID",
    ],
)
app.add_middleware(CSRFMiddleware)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        # CSP for API responses - restrictive since backend serves JSON, not HTML
        # Note: These headers mainly affect any HTML error pages, not JSON responses
        csp = (
            "default-src 'none'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
        response.headers["Content-Security-Policy"] = csp
    return response


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    """Add correlation ID for request tracing."""
    from utils.logging import correlation_id as correlation_id_var

    cid = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.correlation_id = cid
    correlation_id_var.set(cid)  # Set in logging context
    response = await call_next(request)
    response.headers["x-request-id"] = cid
    return response


app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(GeetanjaliException, geetanjali_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, general_exception_handler)

app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, tags=["Authentication"])
app.include_router(cases.router, tags=["Cases"])
app.include_router(verses.router, tags=["Verses"])
app.include_router(outputs.router, tags=["Outputs"])
app.include_router(messages.router, prefix="/api/v1", tags=["Messages"])
app.include_router(follow_up.router, prefix="/api/v1", tags=["Follow-up"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(contact.router, tags=["Contact"])
app.include_router(sitemap.router, tags=["SEO"])
app.include_router(feed.router, tags=["SEO"])
app.include_router(experiments.router, tags=["Experiments"])
app.include_router(reading.router, tags=["Reading"])
app.include_router(dhyanam.router, tags=["Dhyanam"])
app.include_router(search.router, tags=["Search"])
app.include_router(taxonomy.router, tags=["Taxonomy"])
app.include_router(newsletter.router, tags=["Newsletter"])
app.include_router(preferences.router, tags=["Preferences"])
app.include_router(tts.router, tags=["TTS"])

# Serve audio files (development only - nginx serves these in production)
from services.audio import get_audio_directory

audio_dir = get_audio_directory()
if audio_dir.exists():
    app.mount("/audio", StaticFiles(directory=str(audio_dir)), name="audio")

# Prometheus metrics instrumentation (excludes /metrics from instrumentation)
Instrumentator().instrument(app).expose(app, include_in_schema=False)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "environment": settings.APP_ENV,
        "docs": "/docs",
    }
