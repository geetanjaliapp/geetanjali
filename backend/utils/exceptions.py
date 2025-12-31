"""Custom exceptions and error handlers."""

import logging
import re
from contextlib import contextmanager

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from utils.metrics import api_errors_total
from utils.sentry import capture_exception as sentry_capture


def _normalize_endpoint(path: str) -> str:
    """Normalize endpoint path for metrics to prevent cardinality explosion."""
    # Replace UUIDs with placeholder
    normalized = re.sub(r"/[a-f0-9-]{36}", "/:id", path)
    # Replace numeric IDs with placeholder
    normalized = re.sub(r"/\d+", "/:id", normalized)
    # Replace slugs (10+ alphanumeric chars) with placeholder
    normalized = re.sub(r"/[a-z0-9]{10,}", "/:slug", normalized)
    # Limit length to prevent abuse
    return normalized[:100]


# Export all exception handlers
__all__ = [
    "GeetanjaliException",
    "RAGPipelineError",
    "VectorStoreError",
    "LLMError",
    "RetryableLLMError",
    "http_exception_handler",
    "geetanjali_exception_handler",
    "validation_exception_handler",
    "general_exception_handler",
    "handle_service_error",
]

logger = logging.getLogger(__name__)


class GeetanjaliException(Exception):
    """Base exception for Geetanjali errors."""

    def __init__(
        self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    ):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class RAGPipelineError(GeetanjaliException):
    """Exception raised when RAG pipeline fails."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VectorStoreError(GeetanjaliException):
    """Exception raised when vector store operations fail."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


class LLMError(GeetanjaliException):
    """Exception raised when LLM operations fail."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


class RetryableLLMError(LLMError):
    """Exception for transient LLM errors that should be retried.

    Use this for timeout, connection errors, and rate limits.
    Do NOT use for permanent errors like auth failures or invalid requests.
    """

    pass


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions with no-cache headers to prevent stale 404s."""
    # Track 4xx/5xx errors in metrics (skip 3xx redirects)
    if exc.status_code >= 400:
        error_type = f"http_{exc.status_code}"
        endpoint = _normalize_endpoint(request.url.path)
        api_errors_total.labels(error_type=error_type, endpoint=endpoint).inc()

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={"Cache-Control": "no-store"},
    )


async def geetanjali_exception_handler(
    request: Request, exc: GeetanjaliException
) -> JSONResponse:
    """Handle Geetanjali custom exceptions."""
    logger.error(f"GeetanjaliException: {exc.message}")

    # Track in metrics
    error_type = exc.__class__.__name__
    endpoint = _normalize_endpoint(request.url.path)
    api_errors_total.labels(error_type=error_type, endpoint=endpoint).inc()

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "path": request.url.path,
        },
        headers={"Cache-Control": "no-store"},
    )


def _sanitize_error(error: dict) -> dict:
    """Remove non-JSON-serializable objects from validation error."""
    sanitized: dict = {}
    for key, value in error.items():
        if key == "ctx":
            # Convert context values to strings (handles ValueError, etc.)
            sanitized[key] = {k: str(v) for k, v in value.items()} if value else {}
        elif isinstance(value, (str, int, float, bool, type(None), list, tuple)):
            sanitized[key] = value
        else:
            sanitized[key] = str(value)
    return sanitized


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors."""
    logger.warning(f"Validation error: {exc.errors()}")

    # Track in metrics
    endpoint = _normalize_endpoint(request.url.path)
    api_errors_total.labels(error_type="ValidationError", endpoint=endpoint).inc()

    # Sanitize errors to ensure JSON serializability
    sanitized_errors = [_sanitize_error(e) for e in exc.errors()]

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Request validation failed",
            "details": sanitized_errors,
        },
        headers={"Cache-Control": "no-store"},
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)

    # Track in metrics
    error_type = exc.__class__.__name__
    endpoint = _normalize_endpoint(request.url.path)
    api_errors_total.labels(error_type=error_type, endpoint=endpoint).inc()

    # Capture to Sentry with request context
    sentry_capture(
        exc,
        path=str(request.url),
        method=request.method,
        correlation_id=getattr(request.state, "correlation_id", None),
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred",
            "path": request.url.path,
        },
        headers={"Cache-Control": "no-store"},
    )


@contextmanager
def handle_service_error(operation: str, level: str = "error"):
    """
    Context manager for consistent service error handling.

    Args:
        operation: Description of the operation (e.g., "Analyze case 123")
        level: Logging level for unexpected errors ("error" or "warning")

    Usage:
        with handle_service_error("Analyze case 123"):
            # your code here
            pass
    """
    try:
        yield
    except (OperationalError, SQLAlchemyError) as e:
        logger.warning(f"{operation} failed: database error - {type(e).__name__}")
        raise
    except ValueError as e:
        logger.warning(f"{operation} failed: invalid input - {e}")
        raise
    except HTTPException:
        # Re-raise HTTP exceptions without logging (already handled)
        raise
    except Exception as e:
        if level == "warning":
            logger.warning(f"{operation} failed: {type(e).__name__}: {e}")
        else:
            logger.error(f"{operation} failed: {type(e).__name__}: {e}", exc_info=True)
        raise
