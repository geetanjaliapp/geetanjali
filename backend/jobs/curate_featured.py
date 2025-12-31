"""Background job to curate featured cases via actual consultation flow.

This job creates real consultations through the normal API flow,
including AI analysis and follow-up discussions. Each case takes
3-5 minutes due to LLM processing time.

Triggered by GET /cases/featured when categories are missing.

ARCHITECTURE NOTE - Inline Imports:
This module uses inline imports for `api.outputs` and `api.follow_up` inside
functions (not at module level). This is intentional to:
1. Avoid circular import issues (api.cases imports from jobs, jobs imports from api)
2. Reuse the same analysis/follow-up logic used by the API
3. Keep the curation flow consistent with real user consultations

The import chain: api.cases -> jobs.curate_featured -> api.outputs/follow_up
All cross-boundary imports are deferred (inside functions) to break cycles.
"""

import logging
import secrets
import string
import time
import uuid
from datetime import datetime

from db.connection import SessionLocal
from models import Case, FeaturedCase
from models.case import CaseStatus
from services.cache import cache, featured_cases_key

logger = logging.getLogger(__name__)

# Polling configuration
POLL_INTERVAL = 5  # seconds between status checks
ANALYSIS_TIMEOUT = 180  # 3 minutes for initial analysis
FOLLOWUP_TIMEOUT = 120  # 2 minutes per follow-up

# Curated dilemmas with follow-ups
CURATED_DILEMMAS: dict[str, dict[str, str | list[str]]] = {
    "career": {
        "title": "Balancing Career Advancement with Family Responsibilities",
        "dilemma": """I've been offered a promotion that requires relocating to another city. The role is a significant career advancement, but my elderly parents depend on me for support. My spouse is also reluctant to move. How do I balance my professional ambitions with family responsibilities?""",
        "followups": [
            "What if I could negotiate remote work for part of the time?",
            "My spouse says they'll support whatever I decide, but I can sense their reluctance. How do I read between the lines?",
        ],
    },
    "relationships": {
        "title": "Navigating a Difficult Money Conversation with a Close Friend",
        "dilemma": """My closest friend borrowed a significant amount of money six months ago and keeps avoiding the topic. I need the money back, but I'm afraid bringing it up will damage our 15-year friendship. How do I address this without losing the relationship?""",
        "followups": [
            "They seem to be spending on luxuries while avoiding repayment. Does that change things?",
        ],
    },
    "ethics": {
        "title": "Covering for a Friend's Deception",
        "dilemma": """A close friend asked me to cover for them about where they were last weekend. I suspect they're hiding something serious from their partner. Being honest could destroy their marriage, but lying makes me part of the deception. What should I do?""",
        "followups": [
            "What if their partner directly asks me? Do I owe more loyalty to the truth or to my friend?",
            "I've known both of them for years. Doesn't their partner deserve to know?",
        ],
    },
    "leadership": {
        "title": "Making a Fair Promotion Decision",
        "dilemma": """As a team lead, I must recommend one of two equally qualified team members for a promotion. One has been with the company longer and expects it; the other is newer but has contributed more recently. Whatever I decide will affect team morale. How do I make a fair decision?""",
        "followups": [
            "The senior person mentioned they'll leave if passed over. Should that influence my decision?",
            "What's my responsibility to the person who doesn't get promoted?",
        ],
    },
}


def curate_missing_categories(categories: list[str]) -> dict[str, list[str]]:
    """
    Curate featured cases for missing categories.

    Creates cases one at a time via actual consultation flow.
    Each case takes 3-5 minutes with follow-ups.

    Args:
        categories: List of category names to curate

    Returns:
        Dict with 'created' and 'failed' category lists
    """
    results: dict[str, list[str]] = {"created": [], "failed": []}

    logger.info(f"Starting curation for categories: {categories}")

    for category in categories:
        if category not in CURATED_DILEMMAS:
            logger.warning(f"Unknown category: {category}")
            results["failed"].append(category)
            continue

        try:
            case_id = _create_curated_case(category)
            if case_id:
                results["created"].append(category)
                logger.info(f"Successfully created featured case for {category}")
            else:
                results["failed"].append(category)
                logger.warning(f"Failed to create featured case for {category}")
        except Exception as e:
            logger.error(f"Error curating {category}: {e}", exc_info=True)
            results["failed"].append(category)

        # Small delay between cases to avoid overloading
        if categories.index(category) < len(categories) - 1:
            time.sleep(2)

    # Invalidate cache so next request gets fresh data
    _invalidate_featured_cache()

    logger.info(
        f"Curation complete: created={results['created']}, failed={results['failed']}"
    )
    return results


def _create_curated_case(category: str) -> str | None:
    """
    Create a curated case via internal consultation flow.

    Steps:
    1. Create case with dilemma
    2. Trigger analysis and wait for completion
    3. Add follow-up messages and wait for each response
    4. Share case publicly
    5. Create featured_cases entry

    Args:
        category: Category name (career, relationships, etc.)

    Returns:
        Case ID if successful, None if failed
    """
    db = SessionLocal()
    try:
        dilemma_data = CURATED_DILEMMAS[category]
        case_id = str(uuid.uuid4())

        logger.info(f"Creating case for category '{category}': {case_id}")

        # Extract text fields with proper typing
        title_text = str(dilemma_data["title"])
        dilemma_text = str(dilemma_data["dilemma"])

        # 1. Create case
        case = Case(
            id=case_id,
            title=title_text,
            description=dilemma_text,
            status=CaseStatus.DRAFT.value,
            # No user_id - system-created case
        )
        db.add(case)
        db.commit()

        # Create initial user message
        from db.repositories.message_repository import MessageRepository

        message_repo = MessageRepository(db)
        message_repo.create_user_message(case_id=case_id, content=dilemma_text)

        # 2. Trigger analysis
        logger.info(f"Triggering analysis for case {case_id}")
        case.status = CaseStatus.PENDING.value
        db.commit()

        # Run analysis (synchronously in worker context)
        from api.outputs import _build_case_data, run_analysis_background

        case_data = _build_case_data(case)
        run_analysis_background(case_id, case_data, f"curate-{category}")

        # 3. Wait for analysis completion
        if not _wait_for_completion(db, case_id, timeout=ANALYSIS_TIMEOUT):
            logger.error(f"Analysis did not complete in time for case {case_id}")
            return None

        # Refresh case after analysis
        db.expire_all()
        refreshed_case = db.query(Case).filter(Case.id == case_id).first()
        if not refreshed_case or refreshed_case.status != CaseStatus.COMPLETED.value:
            logger.error(f"Case {case_id} not in completed state after analysis")
            return None
        case = refreshed_case

        logger.info(f"Initial analysis complete for case {case_id}")

        # 4. Add follow-up messages
        for i, followup in enumerate(dilemma_data.get("followups", [])):
            logger.info(f"Adding follow-up {i + 1} for case {case_id}")

            # Create user message for follow-up
            user_msg = message_repo.create_user_message(
                case_id=case_id,
                content=followup,
            )

            # Set case status to processing
            case.status = CaseStatus.PROCESSING.value
            db.commit()

            # Run follow-up processing
            from api.follow_up import run_follow_up_background

            run_follow_up_background(
                case_id=case_id,
                user_message_id=user_msg.id,
                follow_up_content=followup,
                correlation_id=f"curate-{category}-followup-{i + 1}",
            )

            # Wait for follow-up completion
            if not _wait_for_completion(db, case_id, timeout=FOLLOWUP_TIMEOUT):
                logger.warning(f"Follow-up {i + 1} did not complete, continuing anyway")
                # Don't fail the whole case if one follow-up times out

            # Refresh case
            db.expire_all()
            refreshed = db.query(Case).filter(Case.id == case_id).first()
            if refreshed:
                case = refreshed

            logger.info(f"Follow-up {i + 1} complete for case {case_id}")

        # 5. Share case publicly
        logger.info(f"Sharing case {case_id}")
        case.is_public = True
        case.share_mode = "full"
        case.shared_at = datetime.utcnow()
        case.public_slug = _generate_unique_slug(db)
        db.commit()

        # 6. Create featured_cases entry
        featured = FeaturedCase(
            id=str(uuid.uuid4()),
            case_id=case_id,
            category=category,
            display_order=0,
            is_active=True,
        )
        db.add(featured)
        db.commit()

        logger.info(
            f"Featured case created: slug={case.public_slug}, category={category}"
        )
        return case_id

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating curated case for {category}: {e}", exc_info=True)
        return None
    finally:
        db.close()


def _wait_for_completion(db, case_id: str, timeout: int) -> bool:
    """
    Poll for case completion with timeout.

    Args:
        db: Database session
        case_id: Case ID to check
        timeout: Maximum wait time in seconds

    Returns:
        True if completed, False if timed out or failed
    """
    start = time.time()
    last_status = None

    while time.time() - start < timeout:
        db.expire_all()  # Clear cached state to get fresh data
        case = db.query(Case).filter(Case.id == case_id).first()

        if not case:
            logger.error(f"Case {case_id} not found during polling")
            return False

        if case.status != last_status:
            logger.debug(f"Case {case_id} status: {case.status}")
            last_status = case.status

        if case.status == CaseStatus.COMPLETED.value:
            return True

        if case.status in [CaseStatus.FAILED.value, CaseStatus.POLICY_VIOLATION.value]:
            logger.error(f"Case {case_id} ended with status: {case.status}")
            return False

        time.sleep(POLL_INTERVAL)

    logger.warning(f"Timeout waiting for case {case_id} (last status: {last_status})")
    return False


def _generate_unique_slug(db, length: int = 10) -> str:
    """
    Generate a unique public slug.

    Args:
        db: Database session
        length: Slug length

    Returns:
        Unique slug string
    """
    chars = string.ascii_lowercase + string.digits
    max_attempts = 10

    for _ in range(max_attempts):
        slug = "".join(secrets.choice(chars) for _ in range(length))
        existing = db.query(Case).filter(Case.public_slug == slug).first()
        if not existing:
            return slug

    # Fallback to UUID-based slug
    return str(uuid.uuid4()).replace("-", "")[:12]


def _invalidate_featured_cache() -> None:
    """Invalidate Redis cache for featured cases."""
    try:
        cache.delete(featured_cases_key())
        logger.info("Invalidated featured cases cache")
    except Exception as e:
        logger.warning(f"Failed to invalidate cache: {e}")
