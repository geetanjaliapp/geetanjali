"""Message API endpoints for conversation threading."""

from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.schemas import MessageCreate, MessageResponse
from api.dependencies import get_case_with_access
from db.connection import get_db
from db.repositories.message_repository import MessageRepository
from models.case import Case

router = APIRouter()


@router.get("/cases/{case_id}/messages", response_model=List[MessageResponse])
def get_case_messages(
    case: Case = Depends(get_case_with_access), db: Session = Depends(get_db)
):
    """
    Get all messages for a case, ordered chronologically.

    Returns the conversation thread including both user questions
    and assistant responses.
    """
    message_repo = MessageRepository(db)
    return message_repo.get_by_case(case.id)


@router.post(
    "/cases/{case_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    message: MessageCreate,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db),
):
    """
    Create a new user message (follow-up question) for a case.

    This adds a message to the conversation thread. The frontend
    should then trigger analysis to generate an assistant response.
    """
    message_repo = MessageRepository(db)
    return message_repo.create_user_message(case_id=case.id, content=message.content)
