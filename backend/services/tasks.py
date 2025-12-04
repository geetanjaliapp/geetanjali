"""RQ task queue service with graceful fallback to FastAPI BackgroundTasks.

This module provides a task queue that:
- Uses RQ (Redis Queue) when Redis is available
- Falls back to FastAPI BackgroundTasks when Redis is unavailable
- Supports automatic retries with exponential backoff
"""

import logging
from typing import Callable, Optional, List

from config import settings

logger = logging.getLogger(__name__)

# RQ queue (lazy initialized)
_queue = None
_rq_available: Optional[bool] = None


def _parse_retry_delays() -> List[int]:
    """Parse retry delays from config string."""
    try:
        return [int(d.strip()) for d in settings.RQ_RETRY_DELAYS.split(",")]
    except (ValueError, AttributeError):
        return [30, 120]  # Default: 30s, 2min


def get_queue():
    """
    Get RQ queue with connection check.

    Returns None if RQ/Redis is unavailable or disabled.
    """
    global _queue, _rq_available

    # Check if RQ is disabled
    if not settings.RQ_ENABLED or not settings.REDIS_URL:
        return None

    # If we already know RQ is unavailable, don't retry
    if _rq_available is False:
        return None

    # Initialize queue if not already done
    if _queue is None:
        try:
            from redis import Redis
            from rq import Queue

            redis_conn = Redis.from_url(
                settings.REDIS_URL, socket_timeout=2, socket_connect_timeout=2
            )
            # Test connection
            redis_conn.ping()

            _queue = Queue(
                name=settings.RQ_QUEUE_NAME,
                connection=redis_conn,
                default_timeout=settings.RQ_JOB_TIMEOUT,
            )
            _rq_available = True
            logger.info(f"RQ queue '{settings.RQ_QUEUE_NAME}' connected successfully")
        except Exception as e:
            logger.warning(f"RQ unavailable, will use BackgroundTasks fallback: {e}")
            _rq_available = False
            _queue = None

    return _queue


def reset_queue_connection():
    """Reset RQ connection state (useful for reconnection attempts)."""
    global _queue, _rq_available
    _queue = None
    _rq_available = None


def enqueue_task(
    func: Callable, *args, retry_delays: Optional[List[int]] = None, **kwargs
) -> Optional[str]:
    """
    Enqueue a task to RQ with retry support.

    Args:
        func: Function to execute
        *args: Positional arguments for the function
        retry_delays: Custom retry delays in seconds (default from config)
        **kwargs: Keyword arguments for the function

    Returns:
        Job ID if queued successfully, None if RQ unavailable
    """
    queue = get_queue()
    if not queue:
        return None

    try:
        from rq import Retry

        # Configure retry
        delays = retry_delays or _parse_retry_delays()
        retry = Retry(max=len(delays), interval=delays) if delays else None

        job = queue.enqueue(func, *args, retry=retry, **kwargs)
        logger.info(f"Enqueued task {func.__name__} with job ID: {job.id}")
        return str(job.id) if job.id else None

    except Exception as e:
        logger.error(f"Failed to enqueue task {func.__name__}: {e}")
        return None


def is_rq_available() -> bool:
    """Check if RQ is available and working."""
    return get_queue() is not None


def get_job_status(job_id: str) -> Optional[str]:
    """
    Get status of a queued job.

    Args:
        job_id: The job ID

    Returns:
        Job status string or None if not found
    """
    queue = get_queue()
    if not queue:
        return None

    try:
        from rq.job import Job

        job = Job.fetch(job_id, connection=queue.connection)
        status = job.get_status()
        return str(status) if status else None
    except Exception:
        return None
