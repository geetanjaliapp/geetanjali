"""RQ worker entry point.

Run with: python worker.py

This starts a worker that processes background analysis jobs.
The worker will automatically reconnect if Redis connection is lost.
"""

import sys
import threading

import uvicorn

from config import settings
from utils.logging import setup_logging
from utils.sentry import init_sentry

# Initialize Sentry before anything else (captures startup errors)
init_sentry(service_name="worker")

# Setup logging
logger = setup_logging()

# HTTP port for worker API (different from backend's 8000)
WORKER_API_PORT = 8001

# Global reference for graceful shutdown
_api_server: uvicorn.Server | None = None


def start_api_server() -> uvicorn.Server:
    """Start the FastAPI server for worker in a background thread."""
    global _api_server
    from worker_api import app

    config = uvicorn.Config(
        app,
        host="0.0.0.0",  # nosec B104 - Safe: Docker container, no public port exposure
        port=WORKER_API_PORT,
        log_level="warning",  # Reduce noise from health checks
        access_log=False,
    )
    server = uvicorn.Server(config)
    _api_server = server

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    logger.info(f"Worker API server started on port {WORKER_API_PORT}")
    return server


def shutdown_api_server() -> None:
    """Gracefully shutdown the API server."""
    global _api_server
    if _api_server:
        logger.info("Shutting down Worker API server...")
        _api_server.should_exit = True
        _api_server = None


def run_worker():
    """Run the RQ worker."""
    if not settings.REDIS_URL:
        logger.error("REDIS_URL not configured, worker cannot start")
        sys.exit(1)

    if not settings.RQ_ENABLED:
        logger.error("RQ_ENABLED is False, worker not needed")
        sys.exit(1)

    # Start the FastAPI server for health checks and metrics
    start_api_server()

    try:
        from redis import Redis
        from rq import Queue, Worker

        redis_conn = Redis.from_url(settings.REDIS_URL)

        # Test connection
        redis_conn.ping()
        # Mask password in log output
        from urllib.parse import urlparse

        parsed = urlparse(settings.REDIS_URL)
        db_path = parsed.path.lstrip("/") if parsed.path else "0"
        safe_url = (
            f"{parsed.scheme}://{parsed.hostname}:{parsed.port or 6379}/{db_path}"
        )
        logger.info(f"Connected to Redis at {safe_url}")

        queues = [Queue(settings.RQ_QUEUE_NAME, connection=redis_conn)]

        worker = Worker(
            queues, connection=redis_conn, name=f"geetanjali-worker-{settings.APP_ENV}"
        )

        logger.info(f"Starting worker for queue: {settings.RQ_QUEUE_NAME}")
        logger.info(f"Job timeout: {settings.RQ_JOB_TIMEOUT}s")
        logger.info(f"Retry delays: {settings.RQ_RETRY_DELAYS}")

        worker.work(with_scheduler=True)

    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
        shutdown_api_server()
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        shutdown_api_server()
        sys.exit(1)


if __name__ == "__main__":
    run_worker()
