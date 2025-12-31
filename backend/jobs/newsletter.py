"""
Newsletter worker jobs - Individual subscriber digest processing.

These jobs are picked up by the RQ worker and process one subscriber at a time.
This provides:
- Granular retry per subscriber (one failure doesn't affect others)
- Better observability (individual job status in RQ dashboard)
- Parallel processing when multiple workers are running
"""

import logging
import random
import uuid
from datetime import datetime

# Thread-safe random for worker processes
_secure_random = random.SystemRandom()

from sqlalchemy import cast, or_
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from api.taxonomy import get_goals
from config import settings
from db.connection import SessionLocal
from models import SendTime, Subscriber, Verse
from services.email import send_newsletter_digest_email

logger = logging.getLogger(__name__)

# Idempotency window: skip if email was sent within this time
IDEMPOTENCY_WINDOW_SECONDS = 3600  # 1 hour


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


def get_principles_for_goals(goal_ids: list[str]) -> set[str]:
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
    principles: set[str] = set()

    for goal_id in real_goals:
        goal = goals_data.get(goal_id)
        if goal and "principles" in goal:
            principles.update(goal["principles"])

    return principles


def select_verse_for_subscriber(
    db: Session,
    subscriber: Subscriber,
    exclude_ids: list[str],
    fallback_to_featured: bool = False,
) -> Verse | None:
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
            cast(Verse.consulting_principles, JSONB).contains([p]) for p in principles
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
        return _secure_random.choice(verses)

    # No verses found with principle filter, try featured as fallback
    if fallback_to_featured and principles:
        logger.info(
            f"No principle-based verses for {subscriber.email}, falling back to featured"
        )
        featured_query = db.query(Verse).filter(Verse.is_featured == True)  # noqa: E712
        if exclude_ids:
            featured_query = featured_query.filter(
                Verse.canonical_id.notin_(exclude_ids)
            )
        featured_verses = featured_query.all()
        if featured_verses:
            return _secure_random.choice(featured_verses)

    return None


def get_goal_labels(goal_ids: list[str]) -> str:
    """Get human-readable labels for goal IDs."""
    if not goal_ids:
        return "exploring the Geeta's wisdom"

    goals_data = get_goals()
    labels: list[str] = []

    for goal_id in goal_ids:
        goal = goals_data.get(goal_id)
        if goal:
            label: str = goal.get("label", goal_id)
            labels.append(label)

    if not labels:
        return "exploring the Geeta's wisdom"

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


def get_reflection_prompt(verses_sent_count: int) -> str | None:
    """Get a reflection prompt if applicable."""
    if not should_show_reflection(verses_sent_count):
        return None
    # Rotate through prompts based on count
    idx = (verses_sent_count // 7) % len(REFLECTION_PROMPTS)
    return REFLECTION_PROMPTS[idx]


def update_30d_window(
    current_list: list[str],
    new_verse_id: str,
    max_size: int = 30,
) -> list[str]:
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


def _mask_email(email: str) -> str:
    """Mask email for logging (PII protection)."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.rsplit("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


def send_subscriber_digest(subscriber_id: str, send_time: str) -> dict:
    """
    Process and send daily digest email for a single subscriber.

    This is the worker job function - called by RQ worker for each subscriber.

    Args:
        subscriber_id: UUID of the subscriber
        send_time: Time slot (morning/afternoon/evening) for greeting

    Returns:
        Dict with result status and details

    Raises:
        Exception: Re-raises exceptions to trigger RQ retry mechanism
    """
    result = {
        "subscriber_id": subscriber_id,
        "status": "pending",
        "verse_id": None,
        "error": None,
    }

    # Input validation
    try:
        uuid.UUID(subscriber_id)
    except (ValueError, TypeError):
        result["status"] = "failed"
        result["error"] = "Invalid subscriber_id format"
        logger.warning(
            f"Invalid subscriber_id format: {subscriber_id[:8] if subscriber_id else 'None'}..."
        )
        return result

    if send_time not in [t.value for t in SendTime]:
        result["status"] = "failed"
        result["error"] = f"Invalid send_time: {send_time}"
        logger.warning(f"Invalid send_time: {send_time}")
        return result

    db = SessionLocal()

    try:
        # Fetch subscriber
        subscriber = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()

        if not subscriber:
            result["status"] = "skipped"
            result["error"] = "Subscriber not found"
            logger.warning(f"Subscriber {subscriber_id} not found, skipping")
            return result

        # Validate subscriber is still active
        if not subscriber.is_active:
            result["status"] = "skipped"
            result["error"] = "Subscriber not active"
            logger.info(
                f"Subscriber {_mask_email(subscriber.email)} no longer active, skipping"
            )
            return result

        # Idempotency check: skip if recently sent (prevents duplicates on retry/re-run)
        if subscriber.last_verse_sent_at:
            elapsed = datetime.utcnow() - subscriber.last_verse_sent_at
            if elapsed.total_seconds() < IDEMPOTENCY_WINDOW_SECONDS:
                result["status"] = "skipped"
                result["error"] = "Already sent recently"
                logger.info(
                    f"Subscriber {subscriber_id} already received email "
                    f"{int(elapsed.total_seconds())}s ago, skipping"
                )
                return result

        # Select verse with fallback to featured
        exclude_ids = subscriber.verses_sent_30d or []
        verse = select_verse_for_subscriber(
            db, subscriber, exclude_ids, fallback_to_featured=True
        )

        if not verse:
            # Try resetting window
            logger.warning(
                f"No verse available for subscriber {subscriber_id}, resetting window"
            )
            subscriber.verses_sent_30d = []
            verse = select_verse_for_subscriber(
                db, subscriber, [], fallback_to_featured=True
            )

            if not verse:
                result["status"] = "failed"
                result["error"] = "No verse available after reset"
                logger.error(
                    f"No verse available for subscriber {subscriber_id} after reset"
                )
                db.rollback()
                return result

        result["verse_id"] = verse.canonical_id

        # Prepare email content
        name = get_subscriber_name(subscriber)
        greeting = TIME_GREETINGS.get(send_time, "Hello")
        goal_labels = get_goal_labels(subscriber.goal_ids or [])
        verses_count = subscriber.verses_sent_count + 1

        # Check for milestone
        milestone_message = MILESTONE_MESSAGES.get(verses_count)

        # Check for reflection prompt
        reflection_prompt = get_reflection_prompt(verses_count)

        # Generate URLs
        token = subscriber.verification_token
        unsubscribe_url = f"{settings.FRONTEND_URL}/n/unsubscribe/{token}"
        preferences_url = f"{settings.FRONTEND_URL}/n/preferences/{token}"
        verse_url = f"{settings.FRONTEND_URL}/verses/{verse.canonical_id}"

        # Send email
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

        if not success:
            result["status"] = "failed"
            result["error"] = "Email send failed"
            logger.error(f"Failed to send digest to subscriber {subscriber_id}")
            # Raise to trigger RQ retry
            raise Exception(f"Email send failed for subscriber {subscriber_id}")

        # Update subscriber tracking
        subscriber.last_verse_sent_at = datetime.utcnow()
        subscriber.verses_sent_30d = update_30d_window(
            subscriber.verses_sent_30d,
            verse.canonical_id,
        )
        subscriber.verses_sent_count = verses_count

        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.exception(
                f"Failed to update tracking for subscriber {subscriber_id}"
            )
            # Email was sent, so don't retry - just log the tracking failure
            result["status"] = "sent_tracking_failed"
            result["error"] = "Tracking update failed"
            return result

        result["status"] = "sent"
        logger.info(
            f"Sent digest to subscriber {subscriber_id}: verse={verse.canonical_id}, "
            f"count={verses_count}"
        )
        return result

    except Exception as e:
        result["status"] = "failed"
        result["error"] = str(e)
        logger.exception(f"Error processing digest for {subscriber_id}: {e}")
        # Re-raise to trigger RQ retry
        raise

    finally:
        db.close()
