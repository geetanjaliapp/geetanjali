"""Custom exceptions and error handlers."""

import logging
from contextlib import contextmanager
from fastapi import Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, OperationalError

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


async def geetanjali_exception_handler(
    request: Request, exc: GeetanjaliException
) -> JSONResponse:
    """Handle Geetanjali custom exceptions."""
    logger.error(f"GeetanjaliException: {exc.message}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "path": str(request.url),
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors."""
    logger.warning(f"Validation error: {exc.errors()}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Request validation failed",
            "details": exc.errors(),
        },
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred",
            "path": str(request.url),
        },
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
