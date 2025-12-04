"""Case management endpoints."""

import logging
import secrets
import string
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from db.repositories.output_repository import OutputRepository
from api.schemas import CaseCreate, CaseResponse, CaseShareToggle, MessageResponse, OutputResponse
from api.middleware.auth import get_optional_user, get_session_id, get_current_user
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


def generate_public_slug(length: int = 10) -> str:
    """Generate a random URL-safe slug for public sharing."""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

router = APIRouter(prefix="/api/v1/cases")


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
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


@router.get("", response_model=List[CaseResponse])
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

    update_data = {"is_public": share_data.is_public}

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
    logger.info(
        f"Case {case_id} sharing toggled: is_public={share_data.is_public}, slug={updated_case.public_slug}"
    )

    # Invalidate cache when toggling share (especially when making private)
    if updated_case.public_slug:
        slug = updated_case.public_slug
        cache.delete(public_case_key(slug))
        cache.delete(public_case_messages_key(slug))
        cache.delete(public_case_outputs_key(slug))
        logger.debug(f"Invalidated cache for public case slug: {slug}")

    return updated_case


# ============================================================================
# Public Case Access (No Auth Required)
# ============================================================================


@router.get("/public/{slug}", response_model=CaseResponse)
async def get_public_case(
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get a publicly shared case by its slug.

    No authentication required. Cached in Redis (1 hour) and HTTP (5 minutes).

    Args:
        slug: Public slug (e.g., "abc123xyz")
        response: FastAPI response for headers
        db: Database session

    Returns:
        Case details (if public)

    Raises:
        HTTPException: If case not found or not public
    """
    # Try Redis cache first
    cache_key = public_case_key(slug)
    cached = cache.get(cache_key)
    if cached:
        response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Cache miss - fetch from DB
    repo = CaseRepository(db)
    case = repo.get_by_public_slug(slug)

    if not case or not case.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or not publicly accessible",
        )

    # Cache in Redis
    case_dict = CaseResponse.model_validate(case).model_dump(mode="json")
    cache.set(cache_key, case_dict, PUBLIC_CASE_REDIS_TTL)

    response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
    response.headers["X-Cache"] = "MISS"

    return case


@router.get("/public/{slug}/messages", response_model=List[MessageResponse])
async def get_public_case_messages(
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get messages for a publicly shared case.

    No authentication required. Cached in Redis (1 hour) and HTTP (5 minutes).

    Args:
        slug: Public slug
        response: FastAPI response for headers
        db: Database session

    Returns:
        List of messages

    Raises:
        HTTPException: If case not found or not public
    """
    # Try Redis cache first
    cache_key = public_case_messages_key(slug)
    cached = cache.get(cache_key)
    if cached:
        response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Cache miss - fetch from DB
    case_repo = CaseRepository(db)
    case = case_repo.get_by_public_slug(slug)

    if not case or not case.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or not publicly accessible",
        )

    message_repo = MessageRepository(db)
    messages = message_repo.get_by_case_id(case.id)

    # Cache in Redis
    messages_list = [MessageResponse.model_validate(m).model_dump(mode="json") for m in messages]
    cache.set(cache_key, messages_list, PUBLIC_CASE_REDIS_TTL)

    response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
    response.headers["X-Cache"] = "MISS"

    return messages


@router.get("/public/{slug}/outputs", response_model=List[OutputResponse])
async def get_public_case_outputs(
    slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Get outputs for a publicly shared case.

    No authentication required. Cached in Redis (1 hour) and HTTP (5 minutes).

    Args:
        slug: Public slug
        response: FastAPI response for headers
        db: Database session

    Returns:
        List of outputs

    Raises:
        HTTPException: If case not found or not public
    """
    # Try Redis cache first
    cache_key = public_case_outputs_key(slug)
    cached = cache.get(cache_key)
    if cached:
        response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
        response.headers["X-Cache"] = "HIT"
        return cached

    # Cache miss - fetch from DB
    case_repo = CaseRepository(db)
    case = case_repo.get_by_public_slug(slug)

    if not case or not case.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or not publicly accessible",
        )

    output_repo = OutputRepository(db)
    outputs = output_repo.get_by_case_id(case.id)

    # Cache in Redis
    outputs_list = [OutputResponse.model_validate(o).model_dump(mode="json") for o in outputs]
    cache.set(cache_key, outputs_list, PUBLIC_CASE_REDIS_TTL)

    response.headers["Cache-Control"] = f"public, max-age={PUBLIC_CASE_HTTP_TTL}"
    response.headers["X-Cache"] = "MISS"

    return outputs
