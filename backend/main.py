"""Main FastAPI application."""

from fastapi import FastAPI
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
    version="0.1.0",
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
    logger.info("Preloading embedding model at startup...")
    from services.embeddings import get_embedding_service

    get_embedding_service()  # Preload the model
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
        "version": "0.1.0",
        "status": "running",
        "environment": settings.APP_ENV,
        "docs": "/docs",
    }
