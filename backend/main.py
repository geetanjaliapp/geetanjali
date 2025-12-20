"""Main FastAPI application."""

import uuid
from fastapi import FastAPI, Request
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

    # Run blocking I/O in a thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, load_vector_store_sync)

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
