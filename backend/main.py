"""Main FastAPI application."""

import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from utils.logging import setup_logging
from utils.exceptions import (
    GeetanjaliException,
    geetanjali_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)
from api import health, cases, verses, outputs, messages, auth, admin, contact
from api.middleware.csrf import CSRFMiddleware

logger = setup_logging()
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    description="Ethical leadership guidance from the Bhagavad Geeta",
    version="1.0.0",
    debug=settings.DEBUG,
)

app.state.limiter = limiter
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CSRFMiddleware)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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
app.include_router(admin.router, tags=["Admin"])
app.include_router(contact.router, tags=["Contact"])

logger.info(f"Starting {settings.APP_NAME} in {settings.APP_ENV} mode")


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    def load_vector_store_sync():
        """Load vector store synchronously in a thread."""
        try:
            logger.info("Pre-loading vector store in background (loads embedding model)...")
            from services.vector_store import get_vector_store
            get_vector_store()  # Initialize vector store
            logger.info("Vector store pre-loaded successfully")
        except Exception as e:
            logger.error(f"Failed to pre-load vector store: {e} (will load on first request)")

    # Run blocking I/O in a thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, load_vector_store_sync)
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("Application shutdown")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "environment": settings.APP_ENV,
        "docs": "/docs",
    }
