"""Logging configuration."""

import logging
import sys
import contextvars
from config import settings

# Correlation ID context variable for tracing requests
correlation_id = contextvars.ContextVar('correlation_id', default='unknown')


class CorrelationIDFilter(logging.Filter):
    """Logging filter to inject correlation ID into log records."""

    def filter(self, record):
        """Add correlation ID to log record."""
        record.correlation_id = correlation_id.get()
        return True


def setup_logging():
    """Configure application logging."""

    # Set log level from config
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Create filter first - add to root logger before any handlers
    correlation_filter = CorrelationIDFilter()
    logging.getLogger().addFilter(correlation_filter)

    # Create formatter with correlation ID
    formatter = logging.Formatter(
        "%(asctime)s - [%(correlation_id)s] - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Configure root logger
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(correlation_filter)

    logging.basicConfig(
        level=log_level,
        handlers=[handler],
    )

    # Reduce noise from some libraries
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level: {settings.LOG_LEVEL}")

    return logger
