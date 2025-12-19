"""
Daily Digest Job - Send personalized daily verse emails to subscribers.

Usage:
    python -m jobs.daily_digest --send-time morning
    python -m jobs.daily_digest --send-time morning --dry-run
    python -m jobs.daily_digest --send-time afternoon --dry-run

Environment:
    NEWSLETTER_DRY_RUN=true  - Log emails without sending (default in dev)
    NEWSLETTER_DRY_RUN=false - Actually send emails (set in production)

Cron Schedule (UTC):
    Morning (6 AM IST):    30 0 * * * ... --send-time morning
    Afternoon (12:30 PM):  0 7 * * *  ... --send-time afternoon
    Evening (6 PM IST):    30 12 * * * ... --send-time evening
"""

import argparse
import logging
import random
import sys
from datetime import datetime
from typing import List, Optional, Set, Dict, Any

from sqlalchemy import or_, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from config import settings
from db.connection import SessionLocal
from models import Verse, Subscriber, SendTime
from api.taxonomy import get_goals

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Alert threshold: log critical if failure rate exceeds this percentage
FAILURE_ALERT_THRESHOLD_PERCENT = 10


# =============================================================================
# Time-based Greetings
# =============================================================================

TIME_GREETINGS = {
    "morning": "Good morning",
    "afternoon": "Take a breath",
    "evening": "As the day winds down",
}


# =============================================================================
# Milestone Messages
# =============================================================================

MILESTONE_MESSAGES = {
    7: "One week of wisdom. The journey continues.",
    30: "A month of daily verses. May they bring clarity.",
    100: "100 verses. A remarkable commitment to growth.",
    365: "One year together. Thank you for walking this path.",
}


# =============================================================================
# Reflection Prompts (shown every ~7 emails)
# =============================================================================

REFLECTION_PROMPTS = [
    "How did yesterday's verse sit with you?",
    "What wisdom from this week resonates most?",
    "Is there a verse you'd like to revisit?",
    "What small shift might today's verse inspire?",
]


# =============================================================================
# Helper Functions
# =============================================================================


def get_active_subscribers(db: Session, send_time: str) -> List[Subscriber]:
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


def get_principles_for_goals(goal_ids: List[str]) -> Set[str]:
    """
    Get union of all principles from the given goal IDs.

    If goal_ids is empty or only contains "exploring", returns empty set
    (which triggers featured-only verse selection).
    """
    if not goal_ids:
        return set()

    # Filter out "exploring" since it has no principles
    real_goals = [g for g in goal_ids if g != "exploring"]
    if not real_goals:
        return set()

    goals_data = get_goals()
    principles = set()

    for goal_id in real_goals:
        goal = goals_data.get(goal_id)
        if goal and "principles" in goal:
            principles.update(goal["principles"])

    return principles


def select_verse_for_subscriber(
    db: Session,
    subscriber: Subscriber,
    exclude_ids: List[str],
    fallback_to_featured: bool = False,
) -> Optional[Verse]:
    """
    Select a verse for the subscriber based on their goals.

    Strategy:
    1. Get union of principles from subscriber's goals
    2. If no principles (exploring or no goals), use featured verses
    3. Filter out recently sent verses (exclude_ids)
    4. Random selection from remaining
    5. Fallback: if no verses available and fallback_to_featured=True, try featured

    Args:
        db: Database session
        subscriber: The subscriber to select verse for
        exclude_ids: List of verse IDs to exclude (recently sent)
        fallback_to_featured: If True, fall back to featured verses when principle-based fails
    """
    principles = get_principles_for_goals(subscriber.goal_ids or [])

    # Build base query
    query = db.query(Verse)

    if principles:
        # Filter by principles (OR logic - any matching principle)
        conditions = [
            cast(Verse.consulting_principles, JSONB).contains([p])
            for p in principles
        ]
        query = query.filter(Verse.consulting_principles.isnot(None))
        query = query.filter(or_(*conditions))
    else:
        # No principles = exploring or no goals → use featured verses only
        query = query.filter(Verse.is_featured == True)  # noqa: E712

    # Exclude recently sent verses
    if exclude_ids:
        query = query.filter(Verse.canonical_id.notin_(exclude_ids))

    # Get all matching verses
    verses = query.all()

    if verses:
        return random.choice(verses)

    # No verses found with principle filter, try featured as fallback
    if fallback_to_featured and principles:
        logger.info(
            f"No principle-based verses for {subscriber.email}, falling back to featured"
        )
        featured_query = db.query(Verse).filter(Verse.is_featured == True)  # noqa: E712
        if exclude_ids:
            featured_query = featured_query.filter(Verse.canonical_id.notin_(exclude_ids))
        featured_verses = featured_query.all()
        if featured_verses:
            return random.choice(featured_verses)

    return None


def get_goal_labels(goal_ids: List[str]) -> str:
    """Get human-readable labels for goal IDs."""
    if not goal_ids:
        return "exploring the Gita's wisdom"

    goals_data = get_goals()
    labels = []

    for goal_id in goal_ids:
        goal = goals_data.get(goal_id)
        if goal:
            labels.append(goal.get("label", goal_id))

    if not labels:
        return "exploring the Gita's wisdom"

    if len(labels) == 1:
        return labels[0]
    elif len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    else:
        return ", ".join(labels[:-1]) + f", and {labels[-1]}"


def get_subscriber_name(subscriber: Subscriber) -> str:
    """Get subscriber's display name (name or email prefix)."""
    if subscriber.name:
        return subscriber.name

    # Extract prefix from email
    email_prefix = subscriber.email.split("@")[0]
    # Capitalize first letter
    return email_prefix.capitalize()


def should_show_reflection(verses_sent_count: int) -> bool:
    """Show reflection prompt every 7th email (not on milestones)."""
    if verses_sent_count in MILESTONE_MESSAGES:
        return False
    return verses_sent_count > 0 and verses_sent_count % 7 == 0


def get_reflection_prompt(verses_sent_count: int) -> Optional[str]:
    """Get a reflection prompt if applicable."""
    if not should_show_reflection(verses_sent_count):
        return None
    # Rotate through prompts based on count
    idx = (verses_sent_count // 7) % len(REFLECTION_PROMPTS)
    return REFLECTION_PROMPTS[idx]


def update_30d_window(
    current_list: List[str],
    new_verse_id: str,
    max_size: int = 30,
) -> List[str]:
    """
    Update the 30-day rolling window of sent verses.

    Adds new verse, removes oldest if exceeds max_size.
    """
    updated = current_list.copy() if current_list else []
    updated.append(new_verse_id)

    # Keep only the last max_size entries
    if len(updated) > max_size:
        updated = updated[-max_size:]

    return updated


# =============================================================================
# Main Send Function
# =============================================================================


def send_daily_digest(
    send_time: str,
    dry_run: bool = True,
) -> Dict[str, Any]:
    """
    Send daily digest emails to all active subscribers for the given send time.

    Args:
        send_time: One of "morning", "afternoon", "evening"
        dry_run: If True, log emails without sending

    Returns:
        Stats dict with sent, skipped, failed counts
    """
    if send_time not in [t.value for t in SendTime]:
        raise ValueError(f"Invalid send_time: {send_time}")

    stats = {
        "send_time": send_time,
        "dry_run": dry_run,
        "started_at": datetime.utcnow().isoformat(),
        "subscribers_found": 0,
        "sent": 0,
        "simulated": 0,  # Dry-run counter (emails that would be sent)
        "skipped": 0,
        "failed": 0,
        "no_verse_available": 0,
    }

    logger.info(f"Starting daily digest for send_time={send_time} (dry_run={dry_run})")

    # Create database session
    db = SessionLocal()

    try:
        # Get active subscribers
        subscribers = get_active_subscribers(db, send_time)
        stats["subscribers_found"] = len(subscribers)

        if not subscribers:
            logger.info("No active subscribers found for this send time")
            return stats

        logger.info(f"Found {len(subscribers)} active subscribers")

        # Import email function (deferred to avoid circular imports)
        from services.email import send_newsletter_digest_email

        for subscriber in subscribers:
            try:
                # Select verse with fallback to featured if principle-based fails
                exclude_ids = subscriber.verses_sent_30d or []
                verse = select_verse_for_subscriber(
                    db, subscriber, exclude_ids, fallback_to_featured=True
                )

                if not verse:
                    # No verse available - reset window and retry
                    # Don't commit yet - wait until email succeeds
                    logger.warning(
                        f"No verse available for {subscriber.email}, "
                        f"attempting window reset"
                    )
                    subscriber.verses_sent_30d = []
                    verse = select_verse_for_subscriber(
                        db, subscriber, [], fallback_to_featured=True
                    )

                    if not verse:
                        logger.error(
                            f"Still no verse available for {subscriber.email} "
                            f"(exhausted all fallbacks)"
                        )
                        db.rollback()  # Rollback window reset
                        stats["no_verse_available"] += 1
                        continue

                # Prepare email content
                name = get_subscriber_name(subscriber)
                greeting = TIME_GREETINGS.get(send_time, "Hello")
                goal_labels = get_goal_labels(subscriber.goal_ids or [])
                verses_count = subscriber.verses_sent_count + 1  # This will be their Nth verse

                # Check for milestone
                milestone_message = MILESTONE_MESSAGES.get(verses_count)

                # Check for reflection prompt
                reflection_prompt = get_reflection_prompt(verses_count)

                # Generate unsubscribe/preferences URLs
                # Use verification_token which is repurposed as unsubscribe token after verification
                token = subscriber.verification_token
                unsubscribe_url = f"{settings.FRONTEND_URL}/n/unsubscribe/{token}"
                preferences_url = f"{settings.FRONTEND_URL}/n/preferences/{token}"
                verse_url = f"{settings.FRONTEND_URL}/verses/{verse.canonical_id}"

                if dry_run:
                    # Log what would be sent
                    logger.info(
                        f"[DRY-RUN] Would send to: {subscriber.email}\n"
                        f"  Subject: Your daily verse for {goal_labels}\n"
                        f"  Greeting: {greeting}, {name}\n"
                        f"  Verse: {verse.canonical_id} ({verse.chapter}.{verse.verse})\n"
                        f"  Milestone: {milestone_message or 'None'}\n"
                        f"  Reflection: {reflection_prompt or 'None'}\n"
                        f"  Verses sent: {verses_count}"
                    )
                    stats["simulated"] += 1
                else:
                    # Actually send email
                    success = send_newsletter_digest_email(
                        email=subscriber.email,
                        name=name,
                        greeting=greeting,
                        verse=verse,
                        goal_labels=goal_labels,
                        milestone_message=milestone_message,
                        reflection_prompt=reflection_prompt,
                        verse_url=verse_url,
                        unsubscribe_url=unsubscribe_url,
                        preferences_url=preferences_url,
                    )

                    if success:
                        stats["sent"] += 1
                    else:
                        stats["failed"] += 1
                        logger.error(f"Failed to send email to {subscriber.email}")
                        continue

                # Update subscriber tracking (only when actually sending)
                if not dry_run:
                    subscriber.last_verse_sent_at = datetime.utcnow()
                    subscriber.verses_sent_30d = update_30d_window(
                        subscriber.verses_sent_30d,
                        verse.canonical_id,
                    )
                    subscriber.verses_sent_count = verses_count
                    db.commit()

            except Exception as e:
                db.rollback()  # Clean up any pending transaction state
                logger.exception(f"Error processing subscriber {subscriber.email}: {e}")
                stats["failed"] += 1
                continue

        stats["completed_at"] = datetime.utcnow().isoformat()
        logger.info(
            f"Daily digest complete: "
            f"sent={stats['sent']}, "
            f"simulated={stats['simulated']}, "
            f"skipped={stats['skipped']}, "
            f"failed={stats['failed']}, "
            f"no_verse={stats['no_verse_available']}"
        )

        # Check failure rate and alert if above threshold
        total_processed = stats["sent"] + stats["simulated"] + stats["failed"]
        if total_processed > 0:
            failure_rate = (stats["failed"] / total_processed) * 100
            if failure_rate >= FAILURE_ALERT_THRESHOLD_PERCENT:
                logger.critical(
                    f"HIGH FAILURE RATE ALERT: {failure_rate:.1f}% of emails failed "
                    f"({stats['failed']}/{total_processed}). "
                    f"Check email service configuration and logs."
                )

        return stats

    finally:
        db.close()


# =============================================================================
# CLI Entry Point
# =============================================================================


def main():
    """CLI entry point for daily digest job."""
    parser = argparse.ArgumentParser(
        description="Send daily verse digest emails to subscribers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--send-time",
        choices=["morning", "afternoon", "evening"],
        required=True,
        help="Time slot to process (morning/afternoon/evening)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=None,
        help="Log emails without sending (overrides NEWSLETTER_DRY_RUN)",
    )
    parser.add_argument(
        "--no-dry-run",
        action="store_true",
        help="Actually send emails (overrides NEWSLETTER_DRY_RUN)",
    )

    args = parser.parse_args()

    # Determine dry_run mode
    # Priority: CLI args > env var > default (True)
    if args.no_dry_run:
        dry_run = False
    elif args.dry_run:
        dry_run = True
    else:
        dry_run = settings.NEWSLETTER_DRY_RUN

    logger.info(f"Newsletter dry-run mode: {dry_run}")

    try:
        stats = send_daily_digest(
            send_time=args.send_time,
            dry_run=dry_run,
        )

        # Exit with error if any failed
        if stats["failed"] > 0:
            sys.exit(1)

    except Exception as e:
        logger.exception(f"Fatal error in daily digest: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
