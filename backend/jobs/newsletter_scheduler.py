"""
Newsletter Scheduler - Enqueues individual digest jobs for workers.

This is run by cron at scheduled times. It:
1. Queries active subscribers for the given send_time slot
2. Enqueues one RQ job per subscriber
3. Logs summary statistics

Usage:
    python -m jobs.newsletter_scheduler --send-time morning
    python -m jobs.newsletter_scheduler --send-time afternoon
    python -m jobs.newsletter_scheduler --send-time evening

Cron Schedule (UTC):
    Morning (6 AM IST):    30 0 * * * ... --send-time morning
    Afternoon (12:30 PM):  0 7 * * *  ... --send-time afternoon
    Evening (6 PM IST):    30 12 * * * ... --send-time evening
"""

import argparse
import logging
import sys
from datetime import datetime, date
from typing import Optional

from config import settings
from db.connection import SessionLocal
from models import Subscriber, SendTime
from services.tasks import enqueue_task, is_rq_available, get_queue
from jobs.newsletter import send_subscriber_digest

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Lock TTL: 5 minutes (scheduler should complete well within this)
SCHEDULER_LOCK_TTL_SECONDS = 300


def _acquire_scheduler_lock(send_time: str) -> Optional[str]:
    """
    Acquire a distributed lock to prevent duplicate scheduler runs.

    Returns lock_key if acquired, None if already held or unavailable.
    The lock_key is captured once to avoid midnight boundary race conditions.
    """
    queue = get_queue()
    if not queue:
        # No Redis available, can't lock - proceed with warning
        logger.warning("Redis unavailable for distributed lock, proceeding without lock")
        return ""  # Empty string indicates "no lock needed"

    # Capture lock_key once to avoid midnight boundary issues
    lock_key = f"newsletter:scheduler:lock:{send_time}:{date.today().isoformat()}"

    try:
        # SET NX (only if not exists) with TTL
        acquired = queue.connection.set(
            lock_key,
            datetime.utcnow().isoformat(),
            nx=True,  # Only set if not exists
            ex=SCHEDULER_LOCK_TTL_SECONDS
        )
        if not acquired:
            logger.warning(f"Scheduler lock already held for {send_time}, exiting")
            return None
        logger.info(f"Acquired scheduler lock: {lock_key}")
        return lock_key
    except Exception as e:
        logger.warning(f"Failed to acquire scheduler lock: {e}, proceeding anyway")
        return ""  # Empty string indicates "no lock needed"


def _release_scheduler_lock(lock_key: str) -> None:
    """Release the scheduler lock using the exact key from acquisition."""
    if not lock_key:
        # No lock was acquired (Redis unavailable or error)
        return

    queue = get_queue()
    if not queue:
        return

    try:
        queue.connection.delete(lock_key)
        logger.debug(f"Released scheduler lock: {lock_key}")
    except Exception as e:
        logger.warning(f"Failed to release scheduler lock: {e}")


def get_active_subscribers(db, send_time: str) -> list[Subscriber]:
    """
    Get all active subscribers for the given send time.

    Active = verified AND not unsubscribed.
    """
    return (
        db.query(Subscriber)
        .filter(
            Subscriber.verified == True,  # noqa: E712
            Subscriber.unsubscribed_at.is_(None),
            Subscriber.send_time == send_time,
        )
        .all()
    )


def schedule_daily_digests(send_time: str, dry_run: bool = False) -> dict:
    """
    Query subscribers and enqueue individual digest jobs.

    Args:
        send_time: One of "morning", "afternoon", "evening"
        dry_run: If True, log but don't enqueue jobs

    Returns:
        Stats dict with queued, skipped, failed counts
    """
    if send_time not in [t.value for t in SendTime]:
        raise ValueError(f"Invalid send_time: {send_time}")

    stats = {
        "send_time": send_time,
        "dry_run": dry_run,
        "started_at": datetime.utcnow().isoformat(),
        "subscribers_found": 0,
        "jobs_queued": 0,
        "jobs_failed": 0,
    }

    logger.info(f"Starting newsletter scheduler for send_time={send_time} (dry_run={dry_run})")

    # Acquire distributed lock to prevent duplicate runs
    lock_key: Optional[str] = None
    if not dry_run:
        lock_key = _acquire_scheduler_lock(send_time)
        if lock_key is None:
            stats["error"] = "Lock held by another process"
            stats["status"] = "skipped"
            return stats

    # Check RQ availability
    if not dry_run and not is_rq_available():
        logger.error("RQ is not available. Cannot enqueue jobs.")
        stats["error"] = "RQ unavailable"
        _release_scheduler_lock(lock_key or "")
        return stats

    db = SessionLocal()

    try:
        # Get active subscribers
        subscribers = get_active_subscribers(db, send_time)
        stats["subscribers_found"] = len(subscribers)

        if not subscribers:
            logger.info("No active subscribers found for this send time")
            return stats

        logger.info(f"Found {len(subscribers)} active subscribers")

        # Enqueue jobs
        for subscriber in subscribers:
            if dry_run:
                logger.info(f"[DRY-RUN] Would enqueue job for subscriber {subscriber.id}")
                stats["jobs_queued"] += 1
            else:
                try:
                    job_id = enqueue_task(
                        send_subscriber_digest,
                        str(subscriber.id),
                        send_time,
                        retry_delays=[60, 300, 900],  # 1m, 5m, 15m
                    )
                    if job_id:
                        stats["jobs_queued"] += 1
                        logger.debug(f"Queued job {job_id} for subscriber {subscriber.id}")
                    else:
                        stats["jobs_failed"] += 1
                        logger.error(f"Failed to enqueue job for subscriber {subscriber.id}")
                except Exception as e:
                    stats["jobs_failed"] += 1
                    logger.exception(f"Error enqueueing job for subscriber {subscriber.id}")

        stats["completed_at"] = datetime.utcnow().isoformat()
        logger.info(
            f"Scheduler complete: "
            f"found={stats['subscribers_found']}, "
            f"queued={stats['jobs_queued']}, "
            f"failed={stats['jobs_failed']}"
        )

        return stats

    finally:
        db.close()
        # Release lock (only if we acquired it - not in dry_run)
        if not dry_run and lock_key:
            _release_scheduler_lock(lock_key)


def main():
    """CLI entry point for newsletter scheduler."""
    parser = argparse.ArgumentParser(
        description="Schedule newsletter digest jobs for workers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--send-time",
        choices=["morning", "afternoon", "evening"],
        required=True,
        help="Time slot to schedule (morning/afternoon/evening)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log what would be queued without actually enqueueing",
    )

    args = parser.parse_args()

    try:
        stats = schedule_daily_digests(
            send_time=args.send_time,
            dry_run=args.dry_run,
        )

        # Exit with error if any failed to queue
        if stats.get("jobs_failed", 0) > 0:
            sys.exit(1)

        # Exit with error if RQ was unavailable
        if stats.get("error"):
            sys.exit(1)

    except Exception as e:
        logger.exception(f"Fatal error in newsletter scheduler: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
