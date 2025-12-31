"""Follow-up conversation API endpoint (async).

This module implements the follow-up conversation endpoint which provides
lightweight conversational responses using the dual-mode pipeline architecture.

Flow:
1. Validate case access
2. Check case has at least one Output (consultation completed)
3. Apply content filter to follow-up question
4. Create user message immediately
5. Set case status to processing
6. Queue background task for LLM processing
7. Return 202 Accepted
8. Background task: run LLM, create assistant message, set case completed
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from api.dependencies import get_case_with_access, limiter
from api.schemas import ChatMessageResponse, FollowUpRequest
from config import settings
from db.connection import SessionLocal, get_db
from db.repositories.message_repository import MessageRepository
from db.repositories.output_repository import OutputRepository
from models.case import Case, CaseStatus
from services.cache import cache, public_case_messages_key
from services.content_filter import ContentPolicyError, validate_submission_content
from services.follow_up import get_follow_up_pipeline
from services.tasks import enqueue_task
from utils.exceptions import LLMError

logger = logging.getLogger(__name__)

router = APIRouter()


def run_follow_up_background(
    case_id: str,
    user_message_id: str,
    follow_up_content: str,
    correlation_id: str = "background",
):
    """
    Background task to process follow-up question.

    This runs in RQ worker (or BackgroundTasks fallback) and:
    1. Gets prior consultation context
    2. Gets conversation history
    3. Runs FollowUpPipeline
    4. Creates assistant message
    5. Updates case status to completed
    """
    from utils.logging import correlation_id as correlation_id_var

    correlation_id_var.set(correlation_id)  # Set correlation ID for this task
    logger.info(f"[Background] Starting follow-up processing for case {case_id}")

    db = SessionLocal()
    try:
        # Get case
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            logger.error(f"[Background] Case not found: {case_id}")
            return

        # Get prior output for context
        output_repo = OutputRepository(db)
        outputs = output_repo.get_by_case_id(case_id)
        if not outputs:
            logger.error(f"[Background] No outputs found for case: {case_id}")
            case.status = CaseStatus.FAILED.value
            db.commit()
            return

        latest_output = outputs[0]
        prior_output = latest_output.result_json

        # Get conversation history
        message_repo = MessageRepository(db)
        messages = message_repo.get_by_case(case_id)

        # Convert messages to conversation format (exclude the pending user message)
        conversation = [
            {
                "role": msg.role.value if hasattr(msg.role, "value") else msg.role,
                "content": msg.content,
            }
            for msg in messages
            if msg.id != user_message_id  # Exclude the message we just created
        ]

        # Run FollowUpPipeline
        try:
            pipeline = get_follow_up_pipeline()
            result = pipeline.run(
                case_description=case.description,
                prior_output=prior_output,
                conversation=conversation,
                follow_up_question=follow_up_content,
            )
        except LLMError as e:
            logger.error(
                f"[Background] Follow-up pipeline failed: {e}",
                extra={"case_id": case_id},
            )
            case.status = CaseStatus.FAILED.value
            db.commit()
            return
        except Exception as e:
            logger.error(
                f"[Background] Unexpected error in follow-up: {e}",
                extra={"case_id": case_id},
            )
            case.status = CaseStatus.FAILED.value
            db.commit()
            return

        # Validate response
        if not result.content or not result.content.strip():
            logger.error(
                "[Background] Follow-up pipeline returned empty response",
                extra={"case_id": case_id},
            )
            case.status = CaseStatus.FAILED.value
            db.commit()
            return

        # Create assistant message
        assistant_message = message_repo.create_assistant_message(
            case_id=case_id,
            content=result.content,
            output_id=None,  # Follow-up responses don't have Output records
        )
        logger.info(
            f"[Background] Created assistant follow-up message: {assistant_message.id}"
        )

        # Update case status to completed
        case.status = CaseStatus.COMPLETED.value
        db.commit()

        # Invalidate public case messages cache if case is public
        if case.public_slug:
            cache.delete(public_case_messages_key(case.public_slug))
            logger.debug(
                f"[Background] Invalidated public messages cache for case {case_id}"
            )

        logger.info(
            f"[Background] Follow-up complete for case {case_id}",
            extra={"correlation_id": correlation_id},
        )

    except (OperationalError, SQLAlchemyError) as e:
        logger.error(
            f"[Background] Database error in follow-up: {e}", extra={"case_id": case_id}
        )
        try:
            case = db.query(Case).filter(Case.id == case_id).first()
            if case:
                case.status = CaseStatus.FAILED.value
                db.commit()
        except Exception as nested_e:
            logger.error(
                f"[Background] Failed to mark case as FAILED after DB error: {nested_e}",
                extra={"case_id": case_id},
            )
    except Exception as e:
        logger.error(f"[Background] Unexpected error: {e}", extra={"case_id": case_id})
        try:
            case = db.query(Case).filter(Case.id == case_id).first()
            if case:
                case.status = CaseStatus.FAILED.value
                db.commit()
        except Exception as nested_e:
            logger.error(
                f"[Background] Failed to mark case as FAILED after error: {nested_e}",
                extra={"case_id": case_id},
            )
    finally:
        db.close()


@router.post(
    "/cases/{case_id}/follow-up",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a follow-up question (async)",
    description="""
    Submit a follow-up question for an existing consultation.

    This endpoint returns immediately with status 202 Accepted.
    The follow-up is processed in the background.
    Poll GET /cases/{case_id} to check status (processing -> completed/failed).

    Requirements:
    - Case must have at least one completed consultation (Output)
    - Follow-up content must pass content moderation

    Returns:
    - User message that was created
    - Case status will be 'processing'
    """,
)
@limiter.limit(settings.FOLLOW_UP_RATE_LIMIT)
async def submit_follow_up(
    request: Request,
    background_tasks: BackgroundTasks,
    follow_up_data: FollowUpRequest,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db),
) -> ChatMessageResponse:
    """
    Submit a follow-up question for async processing.

    Creates the user message immediately and queues background processing.
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

    # 2. Check if already processing
    if case.status in [CaseStatus.PENDING.value, CaseStatus.PROCESSING.value]:
        logger.info(f"Case {case_id} already in progress (status: {case.status})")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A follow-up is already being processed. Please wait.",
        )

    # 3. Apply content filter to follow-up question
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

    # 4. Create user message immediately
    message_repo = MessageRepository(db)
    user_message = message_repo.create_user_message(
        case_id=case_id, content=follow_up_data.content
    )
    logger.info(f"Created user follow-up message: {user_message.id}")

    # 5. Update case status to processing
    case.status = CaseStatus.PROCESSING.value
    db.commit()
    db.refresh(case)

    # 6. Get correlation ID from request state
    request_correlation_id = getattr(request.state, "correlation_id", "background")

    # 7. Queue background task (RQ first, fallback to BackgroundTasks)
    job_id = enqueue_task(
        run_follow_up_background,
        case_id,
        user_message.id,
        follow_up_data.content,
        request_correlation_id,
    )

    if job_id:
        logger.info(f"Follow-up queued via RQ (job: {job_id}) for case {case_id}")
    else:
        # Fallback to FastAPI BackgroundTasks
        background_tasks.add_task(
            run_follow_up_background,
            case_id,
            user_message.id,
            follow_up_data.content,
            request_correlation_id,
        )
        logger.info(f"Follow-up queued via BackgroundTasks for case {case_id}")

    # 8. Return user message
    return ChatMessageResponse(
        id=user_message.id,
        case_id=case_id,
        role="user",
        content=user_message.content,
        created_at=user_message.created_at,
        output_id=None,
    )
