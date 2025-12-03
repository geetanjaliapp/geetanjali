"""Case management endpoints."""

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from api.schemas import CaseCreate, CaseResponse
from api.middleware.auth import get_optional_user, get_session_id
from api.dependencies import get_case_with_access
from models.case import Case
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cases")


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    session_id: Optional[str] = Depends(get_session_id)
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
    logger.info(f"Creating case: {case_data.title} (anonymous={current_user is None}, session_id={session_id})")

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
    message_repo.create_user_message(
        case_id=case.id,
        content=case_data.description
    )

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
    session_id: Optional[str] = Depends(get_session_id)
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
