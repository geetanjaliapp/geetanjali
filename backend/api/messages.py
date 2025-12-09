"""Message API endpoints for conversation threading."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.schemas import MessageCreate, ChatMessageResponse
from api.dependencies import get_case_with_access
from db.connection import get_db
from db.repositories.message_repository import MessageRepository
from models.case import Case
from services.content_filter import validate_submission_content, ContentPolicyError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/cases/{case_id}/messages", response_model=List[ChatMessageResponse])
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
    response_model=ChatMessageResponse,
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

    Raises:
        HTTPException 422: If content violates content policy (blocklist)
    """
    # Layer 1: Pre-submission content filter for follow-up messages
    try:
        validate_submission_content("", message.content)
    except ContentPolicyError as e:
        logger.warning(
            f"Content policy violation in follow-up message (type={e.violation_type.value})",
            extra={"violation_type": e.violation_type.value, "case_id": case.id},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    message_repo = MessageRepository(db)
    return message_repo.create_user_message(case_id=case.id, content=message.content)
