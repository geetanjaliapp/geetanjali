"""Case management endpoints."""

import logging
import secrets
import string
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from api.dependencies import get_case_with_access, limiter
from api.middleware.auth import get_optional_user, get_session_id
from api.schemas import (
    CaseCreate,
    CaseResponse,
    CaseShareToggle,
    ChatMessageResponse,
    OutputResponse,
    VerseRefResponse,
)
from config import settings
from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from db.repositories.output_repository import OutputRepository
from models.case import Case
from models.user import User
from services.cache import (
    cache,
    daily_views_counter_key,
    featured_cases_key,
    public_case_key,
    public_case_messages_key,
    public_case_outputs_key,
    public_case_view_key,
)
from services.content_filter import (
    ContentPolicyError,
    validate_submission_content,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


def generate_public_slug(length: int = 10) -> str:
    """Generate a random URL-safe slug for public sharing."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_unique_public_slug(db: Session, max_candidates: int = 10) -> str:
    """
    Generate a unique public slug efficiently using batch query.

    OPTIMIZATION: Instead of checking slugs one-by-one (up to 10 queries),
    generate multiple candidates and check all at once (1 query).

    Args:
        db: Database session
        max_candidates: Number of candidate slugs to generate

    Returns:
        A unique slug not currently in use

    Raises:
        HTTPException: If unable to generate unique slug (extremely rare)
    """
    # Generate multiple candidates upfront
    candidates = [generate_public_slug() for _ in range(max_candidates)]

    # Single query to check which candidates already exist
    existing_slugs = {
        row[0]
        for row in db.query(Case.public_slug)
        .filter(Case.public_slug.in_(candidates))
        .all()
    }

    # Find first non-existing slug
    for slug in candidates:
        if slug not in existing_slugs:
            return slug

    # Extremely rare: all random slugs exist (probability ~0 for 10-char slugs)
    # Fall back to UUID-based slug (guaranteed unique)
    logger.warning("All candidate slugs existed, falling back to UUID-based slug")
    return str(uuid.uuid4()).replace("-", "")[:12]


def get_public_case_or_404(slug: str, db: Session) -> Case:
    """
    Fetch a public case by slug or raise 404.

    Args:
        slug: Public slug
        db: Database session

    Returns:
        Case if found, public, and not expired

    Raises:
        HTTPException: If case not found, not public, or expired
    """
    repo = CaseRepository(db)
    case = repo.get_by_public_slug(slug)

    if not case or not case.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or not publicly accessible",
        )

    # Check if public link has expired
    if settings.PUBLIC_CASE_EXPIRY_DAYS > 0 and case.shared_at:
        expiry_date = case.shared_at + timedelta(days=settings.PUBLIC_CASE_EXPIRY_DAYS)
        if datetime.utcnow() > expiry_date:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This shared link has expired",
            )

    return case


def cached_public_response(
    cache_key: str,
    response: Response,
    fetch_fn: Callable[[], T],
    serialize_fn: Callable[[T], Any],
) -> Any:
    """
    Generic cache-or-fetch pattern for public case endpoints.

    Args:
        cache_key: Redis cache key
        response: FastAPI response for headers
        fetch_fn: Function to fetch data on cache miss
        serialize_fn: Function to serialize data for caching

    Returns:
        Cached data or freshly fetched data
    """
    # Try cache first
    cached = cache.get(cache_key)
    if cached is not None:
        response.headers["Cache-Control"] = (
            f"public, max-age={settings.CACHE_TTL_PUBLIC_CASE_HTTP}"
        )
        response.headers["X-Cache"] = "HIT"
        return cached

    # Cache miss - fetch and cache
    data = fetch_fn()
    serialized = serialize_fn(data)
    cache.set(cache_key, serialized, settings.CACHE_TTL_PUBLIC_CASE)

    response.headers["Cache-Control"] = (
        f"public, max-age={settings.CACHE_TTL_PUBLIC_CASE_HTTP}"
    )
    response.headers["X-Cache"] = "MISS"

    return serialized


router = APIRouter(prefix="/api/v1/cases")


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_case(
    request: Request,
    case_data: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    session_id: str | None = Depends(get_session_id),
):
    """
    Create a new ethical dilemma case (supports anonymous users).

    Args:
        case_data: Case details
        db: Database session
        current_user: User object if authenticated, None if anonymous
        session_id: Session ID from X-Session-ID header (for anonymous users)

    Returns:
        Created case

    Raises:
        HTTPException 422: If content violates content policy (blocklist)
    """
    # Layer 1: Pre-submission content filter (blocklist check)
    # Rejects obvious violations before database write
    try:
        validate_submission_content(case_data.title, case_data.description)
    except ContentPolicyError as e:
        logger.warning(
            f"Content policy violation at submission (type={e.violation_type.value})",
            extra={"violation_type": e.violation_type.value},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    logger.info(
        f"Creating case: {case_data.title} (anonymous={current_user is None}, session_id={session_id})"
    )

    case_dict = case_data.model_dump()
    case_dict["id"] = str(uuid.uuid4())
    case_dict["user_id"] = current_user.id if current_user else None

    # Use session_id from header if provided, otherwise use from request body
    if not case_dict.get("session_id") and session_id:
        case_dict["session_id"] = session_id

    repo = CaseRepository(db)
    case = repo.create(case_dict)

    # Create initial user message with the case description
    message_repo = MessageRepository(db)
    message_repo.create_user_message(case_id=case.id, content=case_data.description)

    logger.info(f"Case created: {case.id}")
    return case


# ============================================================================
# Featured Cases (Homepage) - MUST be before /{case_id} to match correctly
# ============================================================================


# Use centralized cache TTL from config
FEATURED_CASES_TTL = settings.CACHE_TTL_FEATURED_CASES
# Cooldown to prevent DoS via repeated job enqueueing
CURATION_COOLDOWN_SECONDS = 300  # 5 minutes

# Required categories for homepage
REQUIRED_CATEGORIES = {"career", "relationships", "ethics", "leadership"}


def _truncate(text: str, max_chars: int) -> str:
    """Truncate text with ellipsis at word boundary (Unicode-safe)."""
    if not text or len(text) <= max_chars:
        return text or ""
    truncated = text[:max_chars]
    # Find last space, handle case where no space exists
    last_space = truncated.rfind(" ")
    if last_space > 0:
        return truncated[:last_space] + "..."
    return truncated + "..."  # No space found, hard truncate


def _extract_summary(output) -> str:
    """Extract executive summary from output."""
    if not output or not output.result_json:
        return ""
    return output.result_json.get("executive_summary", "") or ""


def _extract_steps(
    output, max_steps: int = 2, max_chars: int | None = None
) -> list[str]:
    """Extract recommended action steps from output.

    Args:
        output: Case output object
        max_steps: Maximum number of steps to return (default 2 for complete display)
        max_chars: Max chars per step, or None for no truncation
    """
    if not output or not output.result_json:
        return []

    rec = output.result_json.get("recommended_action", {})
    steps = rec.get("steps", []) if isinstance(rec, dict) else []

    if max_chars:
        return [_truncate(step, max_chars) for step in steps[:max_steps]]
    return steps[:max_steps]


def _extract_verse_refs(output, max_refs: int = 3) -> list[VerseRefResponse]:
    """Extract verse references from output sources."""

    if not output or not output.result_json:
        return []

    sources = output.result_json.get("sources", [])
    refs = []

    for source in sources[:max_refs]:
        canonical_id = source.get("canonical_id", "")
        if canonical_id:
            refs.append(
                VerseRefResponse(
                    canonical_id=canonical_id,
                    display=canonical_id.replace("BG_", "BG ").replace("_", "."),
                )
            )

    return refs


@router.get("/featured")
@limiter.limit("30/minute")
async def get_featured_cases(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get featured cases for homepage display.

    Returns curated cases that are:
    - In featured_cases table with is_active=True
    - Have is_public=True on the Case
    - Have status=completed

    Cached in Redis (1 hour). Triggers background curation if categories missing.
    """
    from api.schemas import (
        FeaturedCaseResponse,
        FeaturedCasesResponse,
    )
    from models import FeaturedCase
    from models.case import CaseStatus

    # Enable browser caching for static content (featured cases rarely change)
    # Redis handles server-side caching with 24h TTL
    response.headers["Cache-Control"] = "public, max-age=86400"

    # Try Redis cache first
    cached = cache.get(featured_cases_key())
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached

    # Cache miss - query database
    response.headers["X-Cache"] = "MISS"

    from sqlalchemy.orm import joinedload

    featured = (
        db.query(FeaturedCase)
        .join(Case)
        .options(
            joinedload(FeaturedCase.case).joinedload(Case.outputs),
            joinedload(FeaturedCase.case).joinedload(Case.messages),
        )
        .filter(
            FeaturedCase.is_active == True,  # noqa: E712
            Case.is_public == True,  # noqa: E712
            Case.status == CaseStatus.COMPLETED.value,
            Case.is_deleted == False,  # noqa: E712
        )
        .order_by(FeaturedCase.category, FeaturedCase.display_order)
        .limit(20)
        .all()
    )

    # Check for missing categories and trigger curation
    existing_categories = {fc.category for fc in featured}
    missing = REQUIRED_CATEGORIES - existing_categories

    if missing:
        # Check cooldown to prevent DoS via repeated job enqueueing
        curation_cooldown_key = "curation:cooldown"
        if cache.get(curation_cooldown_key):
            logger.info("Curation job already triggered recently, skipping")
        else:
            logger.info(f"Missing featured categories: {missing}, triggering curation")
            try:
                from jobs.curate_featured import curate_missing_categories
                from services.tasks import enqueue_task

                enqueue_task(curate_missing_categories, list(missing))
                # Set cooldown to prevent repeated triggers
                cache.set(curation_cooldown_key, True, CURATION_COOLDOWN_SECONDS)
            except Exception as e:
                logger.warning(f"Failed to enqueue curation job: {e}")

    # Transform to response
    cases = []
    for fc in featured:
        case = fc.case

        # Defensive check: skip cases without public slug
        if not case.public_slug:
            logger.warning(f"Featured case {fc.id} has no public_slug, skipping")
            continue

        output = case.outputs[-1] if case.outputs else None

        cases.append(
            FeaturedCaseResponse(
                slug=case.public_slug,
                category=fc.category,
                dilemma_preview=_truncate(
                    case.description or "", 500
                ),  # Frontend clamps to 3 lines
                guidance_summary=_truncate(
                    _extract_summary(output), 500
                ),  # Frontend clamps to 4 lines
                recommended_steps=_extract_steps(
                    output, max_steps=3
                ),  # 3 complete steps
                verse_references=_extract_verse_refs(output, max_refs=3),
                has_followups=len(case.messages) > 2 if case.messages else False,
            )
        )

    result = FeaturedCasesResponse(
        cases=cases,
        categories=sorted(existing_categories),
        cached_at=datetime.utcnow(),
    )

    # Cache for 1 hour in Redis
    cache.set(featured_cases_key(), result.model_dump(mode="json"), FEATURED_CASES_TTL)

    return result


# ============================================================================
# Case CRUD Operations
# ============================================================================


@router.get("/{case_id}", response_model=CaseResponse)
@limiter.limit("60/minute")
async def get_case(request: Request, case: Case = Depends(get_case_with_access)):
    """
    Get a case by ID (supports anonymous and authenticated users).

    Args:
        case: Case object (validated by dependency)

    Returns:
        Case details

    Raises:
        HTTPException: If case not found or user doesn't have access
    """
    return case


@router.get("")
@limiter.limit("60/minute")
async def list_cases(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    session_id: str | None = Depends(get_session_id),
):
    """
    List cases for the user (supports anonymous and authenticated users).

    Args:
        skip: Number of records to skip
        limit: Maximum number of records
        status_filter: Optional filter - "completed", "in-progress", "shared"
        db: Database session
        current_user: Authenticated user (optional)
        session_id: Session ID from X-Session-ID header (for anonymous users)

    Returns:
        Dict with cases list and filter counts
    """
    repo = CaseRepository(db)

    if current_user:
        # Authenticated user: get their cases
        cases = repo.get_by_user(
            current_user.id, skip=skip, limit=limit, status_filter=status_filter
        )
        counts = repo.count_by_user(current_user.id)
    elif session_id:
        # Anonymous user: get session-based cases
        cases = repo.get_by_session(
            session_id, skip=skip, limit=limit, status_filter=status_filter
        )
        counts = repo.count_by_session(session_id)
    else:
        # No auth and no session - return empty
        cases = []
        counts = {"all": 0, "completed": 0, "in_progress": 0, "failed": 0, "shared": 0}

    return {
        "cases": [
            CaseResponse.model_validate(c).model_dump(mode="json") for c in cases
        ],
        "counts": counts,
    }


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_case(
    request: Request,
    case_id: str,
    db: Session = Depends(get_db),
    case: Case = Depends(get_case_with_access),
):
    """
    Soft delete a case.

    The case is not physically removed - it's marked as deleted and hidden from
    listings. This allows potential recovery and maintains data integrity.

    Also makes the case private to prevent continued public access.

    Args:
        case_id: Case ID
        db: Database session
        case: Case object (validated by dependency)

    Returns:
        204 No Content on success

    Raises:
        HTTPException: If case not found or user doesn't have access
    """
    repo = CaseRepository(db)
    deleted_case = repo.soft_delete(case_id)

    if not deleted_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Invalidate public cache if it was public
    if case.public_slug:
        cache.delete(public_case_key(case.public_slug))
        cache.delete(public_case_messages_key(case.public_slug))
        cache.delete(public_case_outputs_key(case.public_slug))

    logger.info(f"Case {case_id} soft deleted")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{case_id}/retry", response_model=CaseResponse)
@limiter.limit("10/minute")
async def retry_case_analysis(
    request: Request,
    case_id: str,
    db: Session = Depends(get_db),
    case: Case = Depends(get_case_with_access),
):
    """
    Retry analysis for a failed case.

    Resets the case status to 'draft' so it can be re-submitted for analysis.
    Only cases with 'failed' status can be retried.

    Args:
        case_id: Case ID
        db: Database session
        case: Case object (validated by dependency)

    Returns:
        Updated case with status 'draft'

    Raises:
        HTTPException: If case not found, access denied, or not in failed state
    """
    from models.case import CaseStatus

    if case.status != CaseStatus.FAILED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only failed cases can be retried. Current status: {case.status}",
        )

    repo = CaseRepository(db)
    updated_case = repo.update(case_id, {"status": CaseStatus.DRAFT.value})

    logger.info(f"Case {case_id} reset to draft for retry")
    return updated_case


@router.post("/{case_id}/share", response_model=CaseResponse)
@limiter.limit("20/minute")
async def toggle_case_sharing(
    request: Request,
    case_id: str,
    share_data: CaseShareToggle,
    db: Session = Depends(get_db),
    case: Case = Depends(get_case_with_access),
):
    """
    Toggle public visibility of a case.

    Only the case owner can toggle sharing.

    Args:
        case_id: Case ID
        share_data: Whether to make public or private, and share mode
        db: Database session
        case: Case object (validated by dependency)

    Returns:
        Updated case with is_public, public_slug, and share_mode
    """
    repo = CaseRepository(db)

    update_data: dict[str, Any] = {"is_public": share_data.is_public}

    if share_data.is_public:
        # Generate slug and set shared_at when making public (if not already set)
        if not case.public_slug:
            update_data["shared_at"] = datetime.utcnow()
            # OPTIMIZATION: Batch check multiple candidate slugs in single query
            update_data["public_slug"] = generate_unique_public_slug(db)

        # Set share mode (default to 'full' if not provided)
        update_data["share_mode"] = share_data.share_mode or "full"
    else:
        # Clear share_mode when making private
        update_data["share_mode"] = None

    # Update case
    updated_case = repo.update(case_id, update_data)
    if not updated_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found after update",
        )
    logger.info(
        f"Case {case_id} sharing toggled: is_public={share_data.is_public}, "
        f"share_mode={updated_case.share_mode}, slug={updated_case.public_slug}"
    )

    # Invalidate cache when toggling share (especially when making private)
    if updated_case.public_slug:
        cache.delete(public_case_key(updated_case.public_slug))
        cache.delete(public_case_messages_key(updated_case.public_slug))
        cache.delete(public_case_outputs_key(updated_case.public_slug))
        logger.debug(
            f"Invalidated cache for public case slug: {updated_case.public_slug}"
        )

    return updated_case


# ============================================================================
# Public Case Access (No Auth Required)
# ============================================================================


@router.get("/public/{slug}", response_model=CaseResponse)
@limiter.limit("60/minute")
async def get_public_case(
    request: Request,
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get a publicly shared case by its slug.

    No authentication required. Cached in Redis (1 hour) and HTTP (5 minutes).
    """
    return cached_public_response(
        cache_key=public_case_key(slug),
        response=response,
        fetch_fn=lambda: get_public_case_or_404(slug, db),
        serialize_fn=lambda c: CaseResponse.model_validate(c).model_dump(mode="json"),
    )


@router.get("/public/{slug}/messages", response_model=list[ChatMessageResponse])
@limiter.limit("60/minute")
async def get_public_case_messages(
    request: Request,
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get messages for a publicly shared case.

    No authentication required. Cached in Redis (1 hour) and HTTP (5 minutes).
    """

    def fetch_messages():
        case = get_public_case_or_404(slug, db)
        return MessageRepository(db).get_by_case(case.id)

    return cached_public_response(
        cache_key=public_case_messages_key(slug),
        response=response,
        fetch_fn=fetch_messages,
        serialize_fn=lambda msgs: [
            ChatMessageResponse.model_validate(m).model_dump(mode="json") for m in msgs
        ],
    )


@router.get("/public/{slug}/outputs", response_model=list[OutputResponse])
@limiter.limit("60/minute")
async def get_public_case_outputs(
    request: Request,
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get outputs for a publicly shared case.

    No authentication required. Cached in Redis (1 hour) and HTTP (5 minutes).

    If share_mode is 'essential', options and reflection_prompts are hidden.
    """

    def fetch_outputs():
        case = get_public_case_or_404(slug, db)
        outputs = OutputRepository(db).get_by_case_id(case.id)
        return (outputs, case.share_mode)

    def serialize_with_mode(data: tuple) -> list:
        outputs, share_mode = data
        result = []
        for o in outputs:
            output_dict = OutputResponse.model_validate(o).model_dump(mode="json")

            # Filter output based on share_mode
            if share_mode == "essential" and output_dict.get("result_json"):
                # Hide options and reflection_prompts for essential mode
                output_dict["result_json"].pop("options", None)
                output_dict["result_json"].pop("reflection_prompts", None)

            result.append(output_dict)
        return result

    return cached_public_response(
        cache_key=public_case_outputs_key(slug),
        response=response,
        fetch_fn=fetch_outputs,
        serialize_fn=serialize_with_mode,
    )


@router.post("/public/{slug}/view")
@limiter.limit("60/minute")
async def record_public_view(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
):
    """
    Record a view for a public case.

    Called when PublicCaseView loads. Rate limited to prevent abuse.
    Uses Redis to deduplicate views from the same client (24h window).
    Falls back to allowing views if Redis is unavailable.

    Returns:
        Current view count
    """
    case = get_public_case_or_404(slug, db)

    # Get client identifier (IP address, with fallback)
    client_ip = request.client.host if request.client else "unknown"

    # Check if this client has already viewed this case (dedupe window from config)
    view_key = public_case_view_key(slug, client_ip)
    is_new_view = cache.setnx(view_key, True, settings.CACHE_TTL_VIEW_DEDUPE)

    if is_new_view:
        # Only increment if this is a new unique view
        case.view_count = (case.view_count or 0) + 1
        db.commit()

        # Increment daily views counter for accurate 24h metrics
        cache.incr(daily_views_counter_key(), ttl=settings.CACHE_TTL_DAILY_COUNTER)

        logger.debug(
            f"Public case {slug} new view from {client_ip}, count: {case.view_count}"
        )
    else:
        logger.debug(
            f"Public case {slug} duplicate view from {client_ip}, count unchanged"
        )

    return {"view_count": case.view_count}
