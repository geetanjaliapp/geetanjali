"""Case management endpoints."""

import logging
import secrets
import string
import uuid
from typing import Any, Callable, List, Optional, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from db.repositories.output_repository import OutputRepository
from api.schemas import CaseCreate, CaseResponse, CaseShareToggle, MessageResponse, OutputResponse, PaginatedResponse
from api.middleware.auth import get_optional_user, get_session_id
from api.dependencies import get_case_with_access
from models.case import Case
from models.user import User
from services.cache import (
    cache,
    public_case_key,
    public_case_messages_key,
    public_case_outputs_key,
)

logger = logging.getLogger(__name__)

# Redis cache TTL for public cases (1 hour - can be invalidated on toggle)
PUBLIC_CASE_REDIS_TTL = 3600
# HTTP Cache-Control TTL (5 minutes - cannot be invalidated, keep short)
PUBLIC_CASE_HTTP_TTL = 300

T = TypeVar("T")


def generate_public_slug(length: int = 10) -> str:
    """Generate a random URL-safe slug for public sharing."""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def get_public_case_or_404(slug: str, db: Session) -> Case:
    """
    Fetch a public case by slug or raise 404.

    Args:
        slug: Public slug
        db: Database session

    Returns:
        Case if found and public

    Raises:
        HTTPException: If case not found or not public
    """
    repo = CaseRepository(db)
    case = repo.get_by_public_slug(slug)

    if not case or not case.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or not publicly accessible",
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
        response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Cache miss - fetch and cache
    data = fetch_fn()
    serialized = serialize_fn(data)
    cache.set(cache_key, serialized, PUBLIC_CASE_REDIS_TTL)

    response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
    response.headers["X-Cache"] = "MISS"

    return data


router = APIRouter(prefix="/api/v1/cases")
limiter = Limiter(key_func=get_remote_address)


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
    """
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
async def get_case(case: Case = Depends(get_case_with_access)):
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


@router.get("", response_model=PaginatedResponse[CaseResponse])
async def list_cases(
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
        Paginated list of cases with metadata
    """
    repo = CaseRepository(db)

    if current_user:
        # Authenticated user: get their cases
        cases = repo.get_by_user(current_user.id, skip=skip, limit=limit)
        total = db.query(Case).filter(Case.user_id == current_user.id, Case.is_deleted == False).count()
    elif session_id:
        # Anonymous user: get session-based cases
        cases = repo.get_by_session(session_id, skip=skip, limit=limit)
        total = db.query(Case).filter(Case.session_id == session_id, Case.is_deleted == False).count()
    else:
        # No auth and no session - return empty
        cases = []
        total = 0

    page = skip // limit + 1
    return PaginatedResponse.create(cases, total, page, limit)


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
        share_data: Whether to make public or private
        db: Database session
        case: Case object (validated by dependency)

    Returns:
        Updated case with is_public and public_slug
    """
    repo = CaseRepository(db)

    update_data: dict[str, Any] = {"is_public": share_data.is_public}

    # Generate slug when making public (if not already set)
    if share_data.is_public and not case.public_slug:
        # Ensure unique slug
        max_attempts = 10
        for _ in range(max_attempts):
            slug = generate_public_slug()
            existing = repo.get_by_public_slug(slug)
            if not existing:
                update_data["public_slug"] = slug
                break
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate unique public slug",
            )

    # Update case
    updated_case = repo.update(case_id, update_data)
    if not updated_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found after update",
        )
    logger.info(
        f"Case {case_id} sharing toggled: is_public={share_data.is_public}, slug={updated_case.public_slug}"
    )

    # Invalidate cache when toggling share (especially when making private)
    if updated_case.public_slug:
        cache.delete(public_case_key(updated_case.public_slug))
        cache.delete(public_case_messages_key(updated_case.public_slug))
        cache.delete(public_case_outputs_key(updated_case.public_slug))
        logger.debug(f"Invalidated cache for public case slug: {updated_case.public_slug}")

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


@router.get("/public/{slug}/messages", response_model=List[MessageResponse])
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
        serialize_fn=lambda msgs: [MessageResponse.model_validate(m).model_dump(mode="json") for m in msgs],
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
    """
    def fetch_outputs():
        case = get_public_case_or_404(slug, db)
        return OutputRepository(db).get_by_case_id(case.id)

    return cached_public_response(
        cache_key=public_case_outputs_key(slug),
        response=response,
        fetch_fn=fetch_outputs,
        serialize_fn=lambda outs: [OutputResponse.model_validate(o).model_dump(mode="json") for o in outs],
    )
