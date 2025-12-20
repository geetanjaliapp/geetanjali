"""Case management endpoints."""

import logging
import secrets
import string
import uuid
from datetime import datetime, timedelta
from typing import Any, Callable, List, Optional, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from db.repositories.output_repository import OutputRepository
from api.schemas import (
    CaseCreate,
    CaseResponse,
    CaseShareToggle,
    ChatMessageResponse,
    OutputResponse,
)
from api.middleware.auth import get_optional_user, get_session_id
from api.dependencies import get_case_with_access, limiter
from models.case import Case
from models.user import User
from services.cache import (
    cache,
    public_case_key,
    public_case_messages_key,
    public_case_outputs_key,
)
from services.content_filter import (
    validate_submission_content,
    ContentPolicyError,
)
from config import settings

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
    existing_slugs = set(
        row[0]
        for row in db.query(Case.public_slug)
        .filter(Case.public_slug.in_(candidates))
        .all()
    )

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

    return data


router = APIRouter(prefix="/api/v1/cases")


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_case(
    request: Request,
    case_data: CaseCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    session_id: Optional[str] = Depends(get_session_id),
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


@router.get("", response_model=List[CaseResponse])
@limiter.limit("60/minute")
async def list_cases(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    session_id: Optional[str] = Depends(get_session_id),
):
    """
    List cases for the user (supports anonymous and authenticated users).

    Args:
        skip: Number of records to skip
        limit: Maximum number of records
        db: Database session
        current_user: Authenticated user (optional)
        session_id: Session ID from X-Session-ID header (for anonymous users)

    Returns:
        List of cases
    """
    repo = CaseRepository(db)

    if current_user:
        # Authenticated user: get their cases
        cases = repo.get_by_user(current_user.id, skip=skip, limit=limit)
    elif session_id:
        # Anonymous user: get session-based cases
        cases = repo.get_by_session(session_id, skip=skip, limit=limit)
    else:
        # No auth and no session - return empty
        cases = []

    return cases


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
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
async def retry_case_analysis(
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
async def toggle_case_sharing(
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


@router.get("/public/{slug}/messages", response_model=List[ChatMessageResponse])
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


@router.get("/public/{slug}/outputs", response_model=List[OutputResponse])
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
    Frontend should dedupe with sessionStorage to only call once per session.

    Returns:
        Current view count
    """
    case = get_public_case_or_404(slug, db)

    # Increment view count
    case.view_count = (case.view_count or 0) + 1
    db.commit()

    logger.debug(f"Public case {slug} viewed, count: {case.view_count}")

    return {"view_count": case.view_count}
