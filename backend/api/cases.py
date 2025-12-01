"""Case management endpoints."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from api.schemas import CaseCreate, CaseResponse
from api.middleware.auth import get_current_user, get_optional_user
from models.case import Case
from models.user import User
from typing import Optional
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cases")


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Create a new ethical dilemma case (supports anonymous users).

    Args:
        case_data: Case details
        db: Database session
        current_user: User object if authenticated, None if anonymous

    Returns:
        Created case
    """
    logger.info(f"Creating case: {case_data.title} (anonymous={current_user is None})")

    case_dict = case_data.model_dump()
    case_dict["id"] = str(uuid.uuid4())
    case_dict["user_id"] = current_user.id if current_user else None

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
async def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Get a case by ID (supports anonymous and authenticated users).

    Args:
        case_id: Case ID
        db: Database session
        current_user: Authenticated user (optional)

    Returns:
        Case details

    Raises:
        HTTPException: If case not found or user doesn't have access
    """
    repo = CaseRepository(db)
    case = repo.get(case_id)

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found"
        )

    # Verify ownership if case belongs to a user
    if case.user_id is not None:
        if current_user is None or case.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this case"
            )

    return case


@router.get("", response_model=List[CaseResponse])
async def list_cases(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List cases for the authenticated user.

    Args:
        skip: Number of records to skip
        limit: Maximum number of records
        db: Database session
        current_user: Authenticated user

    Returns:
        List of cases
    """
    repo = CaseRepository(db)
    cases = repo.get_by_user(current_user.id, skip=skip, limit=limit)

    return cases
