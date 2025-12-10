"""Follow-up conversation API endpoint.

This module implements the follow-up conversation endpoint which provides
lightweight conversational responses using the dual-mode pipeline architecture.

Flow:
1. Validate case access
2. Check case has at least one Output (consultation completed)
3. Apply content filter to follow-up question
4. Get latest Output for context
5. Get conversation history (Messages)
6. Run FollowUpPipeline
7. Store user message and response as Messages (atomically)
8. Return response
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from config import settings

from api.schemas import FollowUpRequest, FollowUpResponse, LLMAttributionSchema
from api.dependencies import get_case_with_access
from db.connection import get_db
from db.repositories.message_repository import MessageRepository
from db.repositories.output_repository import OutputRepository
from models.case import Case
from services.content_filter import validate_submission_content, ContentPolicyError
from services.follow_up import get_follow_up_pipeline
from utils.exceptions import LLMError

logger = logging.getLogger(__name__)

# Rate limiter - follow-ups are lighter than full analysis, allow 3x more
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.post(
    "/cases/{case_id}/follow-up",
    response_model=FollowUpResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a follow-up question",
    description="""
    Submit a follow-up question for an existing consultation.

    This endpoint is for conversational follow-ups after an initial consultation
    has been completed. It provides a lightweight response without full RAG
    regeneration.

    Requirements:
    - Case must have at least one completed consultation (Output)
    - Follow-up content must pass content moderation

    Returns:
    - Markdown response addressing the follow-up question
    - Uses prior consultation context and verse references
    """,
)
@limiter.limit(settings.FOLLOW_UP_RATE_LIMIT)
def submit_follow_up(
    request: Request,
    follow_up_data: FollowUpRequest,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db),
) -> FollowUpResponse:
    """
    Process a follow-up question and return conversational response.

    This creates both a user message (the follow-up question) and an
    assistant message (the response) in the conversation thread.
    """
    case_id = case.id

    # 1. Check case has at least one Output
    output_repo = OutputRepository(db)
    outputs = output_repo.get_by_case_id(case_id)

    if not outputs:
        logger.warning(f"Follow-up attempted on case without consultation: {case_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit follow-up: no consultation has been completed yet. "
            "Please start a consultation first.",
        )

    # 2. Apply content filter to follow-up question
    try:
        validate_submission_content("", follow_up_data.content)
    except ContentPolicyError as e:
        logger.warning(
            f"Content policy violation in follow-up (type={e.violation_type.value})",
            extra={"violation_type": e.violation_type.value, "case_id": case_id},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    # 3. Get latest Output for context (outputs are ordered newest first)
    latest_output = outputs[0]
    prior_output = latest_output.result_json

    # 4. Get conversation history
    message_repo = MessageRepository(db)
    messages = message_repo.get_by_case(case_id)

    # Convert messages to conversation format
    conversation = [
        {"role": msg.role.value if hasattr(msg.role, "value") else msg.role, "content": msg.content}
        for msg in messages
    ]

    # 5. Run FollowUpPipeline FIRST (before creating messages)
    # This ensures we don't create orphaned user messages on LLM failure
    try:
        pipeline = get_follow_up_pipeline()
        result = pipeline.run(
            case_description=case.description,
            prior_output=prior_output,
            conversation=conversation,
            follow_up_question=follow_up_data.content,
        )
    except LLMError as e:
        logger.error(f"Follow-up pipeline failed: {e}", extra={"case_id": case_id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to generate response. Please try again later.",
        )
    except Exception as e:
        logger.error(f"Unexpected error in follow-up: {e}", extra={"case_id": case_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        )

    # 6. Validate response is not empty
    if not result.content or not result.content.strip():
        logger.error("Follow-up pipeline returned empty response", extra={"case_id": case_id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to generate response. Please try again later.",
        )

    # 7. Create both messages atomically (only after successful LLM response)
    user_message = message_repo.create_user_message(
        case_id=case_id, content=follow_up_data.content
    )
    logger.info(f"Created user follow-up message: {user_message.id}")

    assistant_message = message_repo.create_assistant_message(
        case_id=case_id,
        content=result.content,
        output_id=None,  # Follow-up responses don't have Output records
    )
    logger.info(f"Created assistant follow-up message: {assistant_message.id}")

    # 8. Build and return response
    llm_attribution = None
    if result.model and result.provider:
        llm_attribution = LLMAttributionSchema(
            model=result.model,
            provider=result.provider,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )

    return FollowUpResponse(
        message_id=assistant_message.id,
        content=result.content,
        role="assistant",
        created_at=assistant_message.created_at,
        llm_attribution=llm_attribution,
    )
