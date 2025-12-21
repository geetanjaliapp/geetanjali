"""Main FastAPI application."""

import uuid
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from prometheus_fastapi_instrumentator import Instrumentator

from config import settings
from utils.logging import setup_logging
from utils.sentry import init_sentry
from utils.metrics_scheduler import start_metrics_scheduler, stop_metrics_scheduler
from services.metrics_collector import collect_metrics

# Initialize Sentry before anything else (captures startup errors)
init_sentry(service_name="backend")
from utils.exceptions import (
    GeetanjaliException,
    http_exception_handler,
    geetanjali_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)
from api import (
    health,
    cases,
    verses,
    outputs,
    messages,
    auth,
    admin,
    contact,
    sitemap,
    feed,
    experiments,
    follow_up,
    reading,
    search,
    taxonomy,
    newsletter,
    preferences,
)
from api.middleware.csrf import CSRFMiddleware
from api.dependencies import limiter

logger = setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    description="Ethical leadership guidance from the Bhagavad Geeta",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
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
app.include_router(search.router, tags=["Search"])
app.include_router(taxonomy.router, tags=["Taxonomy"])
app.include_router(newsletter.router, tags=["Newsletter"])
app.include_router(preferences.router, tags=["Preferences"])

# Prometheus metrics instrumentation (excludes /metrics from instrumentation)
Instrumentator().instrument(app).expose(app, include_in_schema=False)

logger.info(f"Starting {settings.APP_NAME} in {settings.APP_ENV} mode")


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    import asyncio

    def load_vector_store_sync():
        """Load vector store synchronously in a thread."""
        try:
            logger.info(
                "Pre-loading vector store in background (loads embedding model)..."
            )
            from services.vector_store import get_vector_store

            get_vector_store()  # Initialize vector store
            logger.info("Vector store pre-loaded successfully")
        except Exception as e:
            logger.error(
                f"Failed to pre-load vector store: {e} (will load on first request)"
            )

    def warm_daily_verse_cache():
        """Pre-warm daily verse cache to avoid cold-start latency."""
        try:
            from datetime import date
            from sqlalchemy import func

            from db import SessionLocal
            from models.verse import Verse
            from api.schemas import VerseResponse
            from services.cache import (
                cache,
                daily_verse_key,
                featured_count_key,
                featured_verse_ids_key,
                calculate_midnight_ttl,
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
                    cache.set(
                        count_key, featured_count, settings.CACHE_TTL_FEATURED_COUNT
                    )

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

    # Run blocking I/O in a thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, load_vector_store_sync)
    loop.run_in_executor(None, warm_daily_verse_cache)

    # Start metrics scheduler (collects business metrics every 60s)
    start_metrics_scheduler(collect_metrics, interval_seconds=60)

    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    stop_metrics_scheduler()
    logger.info("Application shutdown")


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
