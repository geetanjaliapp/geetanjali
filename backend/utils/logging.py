"""Logging configuration."""

import contextvars
import logging
import sys

from config import settings

# Correlation ID context variable for tracing requests
correlation_id = contextvars.ContextVar("correlation_id", default="unknown")


class CorrelationIDFilter(logging.Filter):
    """Logging filter to inject correlation ID into log records."""

    def filter(self, record):
        """Add correlation ID to log record."""
        record.correlation_id = correlation_id.get()
        return True


def setup_logging():
    """Configure application logging.

    Sets root logger to WARNING to reduce noise from third-party libraries,
    while setting our application loggers to the configured LOG_LEVEL (default INFO).
    """

    # Set log level from config for our application
    app_log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Create filter first - add to root logger before any handlers
    correlation_filter = CorrelationIDFilter()
    logging.getLogger().addFilter(correlation_filter)

    # Create formatter with correlation ID
    formatter = logging.Formatter(
        "%(asctime)s - [%(correlation_id)s] - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Configure root logger at WARNING to reduce third-party noise
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(correlation_filter)

    logging.basicConfig(
        level=logging.WARNING,
        handlers=[handler],
    )

    # Set our application loggers to configured level
    app_namespaces = [
        "api",
        "services",
        "utils",
        "db",
        "jobs",
        "models",
        "worker",
        "worker_api",
        "main",
        "__main__",
    ]
    for namespace in app_namespaces:
        logging.getLogger(namespace).setLevel(app_log_level)

    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level: {settings.LOG_LEVEL}")

    return logger
