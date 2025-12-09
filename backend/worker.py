"""RQ worker entry point.

Run with: python worker.py

This starts a worker that processes background analysis jobs.
The worker will automatically reconnect if Redis connection is lost.
"""

import sys

from config import settings
from utils.logging import setup_logging
from utils.sentry import init_sentry

# Initialize Sentry before anything else (captures startup errors)
init_sentry(service_name="worker")

# Setup logging
logger = setup_logging()


def run_worker():
    """Run the RQ worker."""
    if not settings.REDIS_URL:
        logger.error("REDIS_URL not configured, worker cannot start")
        sys.exit(1)

    if not settings.RQ_ENABLED:
        logger.error("RQ_ENABLED is False, worker not needed")
        sys.exit(1)

    try:
        from redis import Redis
        from rq import Worker, Queue

        redis_conn = Redis.from_url(settings.REDIS_URL)

        # Test connection
        redis_conn.ping()
        logger.info(f"Connected to Redis at {settings.REDIS_URL}")

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
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_worker()
