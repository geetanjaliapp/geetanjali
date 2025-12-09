"""APScheduler setup for periodic metrics collection."""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

scheduler: BackgroundScheduler | None = None


def start_metrics_scheduler(collect_fn: callable, interval_seconds: int = 60) -> None:
    """Start the background scheduler for metrics collection.

    Args:
        collect_fn: The function to call for collecting metrics
        interval_seconds: How often to collect metrics (default: 60s)
    """
    global scheduler

    if scheduler is not None:
        logger.warning("Metrics scheduler already running")
        return

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        collect_fn,
        trigger=IntervalTrigger(seconds=interval_seconds),
        id="metrics_collector",
        name="Collect application metrics",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Metrics scheduler started (interval: {interval_seconds}s)")

    # Run immediately on startup
    try:
        collect_fn()
        logger.info("Initial metrics collection completed")
    except Exception as e:
        logger.error(f"Initial metrics collection failed: {e}")


def stop_metrics_scheduler() -> None:
    """Stop the background scheduler."""
    global scheduler

    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("Metrics scheduler stopped")
