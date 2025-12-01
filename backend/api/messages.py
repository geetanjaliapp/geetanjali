"""Message API endpoints for conversation threading."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.schemas import MessageCreate, MessageResponse
from db.connection import get_db
from db.repositories.message_repository import MessageRepository
from db.repositories.case_repository import CaseRepository

router = APIRouter()


@router.get("/cases/{case_id}/messages", response_model=List[MessageResponse])
def get_case_messages(case_id: str, db: Session = Depends(get_db)):
    """
    Get all messages for a case, ordered chronologically.

    Returns the conversation thread including both user questions
    and assistant responses.
    """
    # Verify case exists
    case_repo = CaseRepository(db)
    case = case_repo.get(case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found"
        )

    # Get all messages for the case
    message_repo = MessageRepository(db)
    messages = message_repo.get_by_case(case_id)

    return messages


@router.post("/cases/{case_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(
    case_id: str,
    message: MessageCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new user message (follow-up question) for a case.

    This adds a message to the conversation thread. The frontend
    should then trigger analysis to generate an assistant response.
    """
    # Verify case exists
    case_repo = CaseRepository(db)
    case = case_repo.get(case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found"
        )

    # Create user message
    message_repo = MessageRepository(db)
    new_message = message_repo.create_user_message(
        case_id=case_id,
        content=message.content
    )

    return new_message
