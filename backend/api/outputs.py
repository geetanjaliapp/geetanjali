"""Output management endpoints."""

import logging
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from slowapi import Limiter
from slowapi.util import get_remote_address

from db import get_db, SessionLocal
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from models.output import Output
from models.case import Case, CaseStatus
from models.user import User
from api.schemas import OutputResponse, CaseResponse, FeedbackCreate, FeedbackResponse, PaginatedResponse
from api.middleware.auth import get_optional_user, require_role, get_session_id
from api.dependencies import get_case_with_access
from services.rag import get_rag_pipeline
from services.tasks import enqueue_task
from models.feedback import Feedback
from config import settings

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/v1")


def _build_case_data(case: Case) -> dict:
    """Build case data dict for RAG pipeline."""
    return {
        "title": case.title,
        "description": case.description,
        "role": case.role,
        "stakeholders": case.stakeholders,
        "constraints": case.constraints,
        "horizon": case.horizon,
        "sensitivity": case.sensitivity,
    }


def _create_output_from_result(case_id: str, result: dict, db: Session) -> Output:
    """Create and persist an Output record from RAG result."""
    output = Output(
        id=str(uuid.uuid4()),
        case_id=case_id,
        result_json=result,
        executive_summary=result.get("executive_summary", ""),
        confidence=result.get("confidence", 0.0),
        scholar_flag=result.get("scholar_flag", False),
        created_at=datetime.utcnow(),
    )
    db.add(output)
    return output


def _create_assistant_message(
    case_id: str, output: Output, result: dict, db: Session
) -> None:
    """Create assistant message linked to output."""
    message_repo = MessageRepository(db)
    message_repo.create_assistant_message(
        case_id=case_id,
        content=result.get("executive_summary", ""),
        output_id=output.id,
    )


def run_analysis_background(case_id: str, case_data: dict, request_correlation_id: str = "background"):
    """
    Background task to run RAG analysis.
    Uses a new database session since background tasks run outside request context.

    Args:
        case_id: Case ID to analyze
        case_data: Case data for RAG pipeline
        request_correlation_id: Correlation ID from original request
    """
    from utils.logging import correlation_id as correlation_id_var

    correlation_id_var.set(request_correlation_id)  # Set correlation ID for this task
    db = SessionLocal()
    try:
        logger.info(f"[Background] Starting analysis for case {case_id}")

        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            logger.error(f"[Background] Case {case_id} not found")
            return

        case.status = CaseStatus.PROCESSING.value
        db.commit()

        # Clean up orphaned assistant messages from previous failed attempts
        # Find the last user message and delete any assistant messages after it
        message_repo = MessageRepository(db)
        last_user_msg = message_repo.get_last_user_message(case_id)
        if last_user_msg:
            deleted = message_repo.delete_assistant_messages_after(
                case_id, last_user_msg.created_at
            )
            if deleted > 0:
                logger.info(
                    f"[Background] Cleaned up {deleted} orphaned assistant message(s) for case {case_id}"
                )

        # Run RAG pipeline
        rag_pipeline = get_rag_pipeline()
        result = rag_pipeline.run(case_data)

        # Create output using helper
        output = _create_output_from_result(case_id, result, db)

        # Update case title if LLM provided one
        if result.get("suggested_title"):
            case.title = result["suggested_title"]

        case.status = CaseStatus.COMPLETED.value
        db.commit()
        db.refresh(output)

        # Create assistant message using helper
        _create_assistant_message(case_id, output, result, db)

        logger.info(
            f"[Background] Analysis complete. Output ID: {output.id}, Confidence: {output.confidence}"
        )

    except Exception as e:
        logger.error(f"[Background] Analysis failed for case {case_id}: {e}")
        try:
            case = db.query(Case).filter(Case.id == case_id).first()
            if case:
                case.status = CaseStatus.FAILED.value
                db.commit()
        except (OperationalError, SQLAlchemyError) as db_err:
            logger.warning(f"[Background] Failed to update case status: {db_err}")
    finally:
        db.close()


@router.post(
    "/cases/{case_id}/analyze/async",
    response_model=CaseResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit(settings.ANALYZE_RATE_LIMIT)
async def analyze_case_async(
    request: Request,
    background_tasks: BackgroundTasks,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db),
):
    """
    Start async analysis of a case using the RAG pipeline.

    This endpoint returns immediately with status 202 Accepted.
    The analysis runs in the background and updates the case status.
    Poll GET /cases/{case_id} to check status (pending -> processing -> completed/failed).

    Uses RQ (Redis Queue) when available for reliable background processing with
    automatic retries. Falls back to FastAPI BackgroundTasks if Redis is unavailable.

    Returns:
        Case with status 'pending'
    """
    logger.info(f"Starting async analysis for case: {case.id}")

    # Check if already processing
    if case.status in [CaseStatus.PENDING.value, CaseStatus.PROCESSING.value]:
        logger.info(f"Case {case.id} already in progress (status: {case.status})")
        return case

    # Update status to pending
    case.status = CaseStatus.PENDING.value
    db.commit()
    db.refresh(case)

    # Build case data
    case_data = _build_case_data(case)

    # Get correlation ID from request state (if available)
    request_correlation_id = getattr(request.state, 'correlation_id', 'background')

    # Try RQ first, fallback to BackgroundTasks
    job_id = enqueue_task(run_analysis_background, case.id, case_data, request_correlation_id)

    if job_id:
        logger.info(f"Analysis queued via RQ (job: {job_id}) for case {case.id}")
    else:
        # Fallback to FastAPI BackgroundTasks
        background_tasks.add_task(run_analysis_background, case.id, case_data, request_correlation_id)
        logger.info(f"Analysis queued via BackgroundTasks for case {case.id}")

    return case


@router.post(
    "/cases/{case_id}/analyze",
    response_model=OutputResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(settings.ANALYZE_RATE_LIMIT)
async def analyze_case(
    request: Request,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db),
):
    """
    Analyze a case using the RAG pipeline (synchronous, supports anonymous users).

    This endpoint waits for the analysis to complete before returning.
    For async processing, use POST /cases/{case_id}/analyze/async instead.

    Returns:
        Generated output with consulting brief

    Raises:
        HTTPException: If case not found, access denied, or RAG pipeline fails
    """
    logger.info(f"Analyzing case: {case.id}")

    try:
        # Clean up orphaned assistant messages from previous failed attempts
        message_repo = MessageRepository(db)
        last_user_msg = message_repo.get_last_user_message(case.id)
        if last_user_msg:
            deleted = message_repo.delete_assistant_messages_after(
                case.id, last_user_msg.created_at
            )
            if deleted > 0:
                logger.info(
                    f"Cleaned up {deleted} orphaned assistant message(s) for case {case.id}"
                )

        # Build case data and run RAG pipeline
        case_data = _build_case_data(case)
        rag_pipeline = get_rag_pipeline()
        result = rag_pipeline.run(case_data)

        # Create output record
        try:
            output = _create_output_from_result(case.id, result, db)

            # Update case title if LLM provided one
            if result.get("suggested_title"):
                case.title = result["suggested_title"]

            case.status = CaseStatus.COMPLETED.value
            db.commit()
            db.refresh(output)

            # Create assistant message
            _create_assistant_message(case.id, output, result, db)

            logger.info(
                f"Analysis complete. Output ID: {output.id}, Confidence: {output.confidence}"
            )
            return output

        except SQLAlchemyError as db_error:
            db.rollback()
            logger.error(f"Database error saving output for case {case.id}: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to save your consultation. Please try again.",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed for case {case.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete your consultation right now. Please try again later.",
        )


@router.get("/outputs/{output_id}", response_model=OutputResponse)
async def get_output(
    output_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Get an output by ID (supports anonymous users).

    Args:
        output_id: Output ID
        db: Database session
        current_user: Authenticated user (optional)

    Returns:
        Output details

    Raises:
        HTTPException: If output not found or user doesn't have access
    """
    output = db.query(Output).filter(Output.id == output_id).first()

    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output {output_id} not found",
        )

    # Verify ownership via case
    case_repo = CaseRepository(db)
    case = case_repo.get(output.case_id)

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found for this output",
        )

    # Verify ownership if case belongs to a user
    if case.user_id is not None:
        if current_user is None or case.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this output",
            )

    return output


@router.get("/cases/{case_id}/outputs", response_model=PaginatedResponse[OutputResponse])
async def list_case_outputs(
    case_id: str,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    List outputs for a case with pagination (supports anonymous users).

    Args:
        case_id: Case ID
        skip: Number of records to skip
        limit: Maximum number of records
        db: Database session
        current_user: Authenticated user (optional)

    Returns:
        Paginated list of outputs for the case
    """
    # Verify case ownership
    case_repo = CaseRepository(db)
    case = case_repo.get(case_id)

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Case {case_id} not found"
        )

    # Verify ownership if case belongs to a user
    if case.user_id is not None:
        if current_user is None or case.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this case",
            )

    # Get total count
    total = db.query(Output).filter(Output.case_id == case_id).count()

    # Get paginated results
    outputs = (
        db.query(Output)
        .filter(Output.case_id == case_id)
        .order_by(Output.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    page = skip // limit + 1
    return PaginatedResponse.create(outputs, total, page, limit)


@router.post("/outputs/{output_id}/scholar-review", response_model=OutputResponse)
async def submit_scholar_review(
    output_id: str,
    approved: bool,
    db: Session = Depends(get_db),
    scholar_user: User = Depends(require_role("scholar")),
):
    """
    Submit scholar review for an output.

    Args:
        output_id: Output ID
        approved: Whether the output is approved
        db: Database session
        scholar_user: Authenticated scholar user (requires 'scholar' role)

    Returns:
        Updated output

    Raises:
        HTTPException: If output not found or user is not a scholar
    """
    output = db.query(Output).filter(Output.id == output_id).first()

    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output {output_id} not found",
        )

    try:
        # Update review status within transaction
        output.reviewed_by = scholar_user.id
        output.reviewed_at = datetime.utcnow()

        if approved:
            output.scholar_flag = False  # Clear flag if approved
            logger.info(f"Output {output_id} approved by scholar {scholar_user.id}")
        else:
            logger.info(f"Output {output_id} rejected by scholar {scholar_user.id}")

        db.commit()
        db.refresh(output)

        return output

    except Exception as db_error:
        db.rollback()
        logger.error(
            f"Database error updating scholar review for output {output_id}: {db_error}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update review status",
        )


@router.post(
    "/outputs/{output_id}/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_feedback(
    output_id: str,
    feedback_data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    session_id: Optional[str] = Depends(get_session_id),
):
    """
    Submit feedback (thumbs up/down + optional comment) for an output.

    Can be submitted by authenticated users or anonymous sessions.
    Only one feedback per user/session per output is allowed.

    Args:
        output_id: Output ID to rate
        feedback_data: Rating and optional comment
        db: Database session
        current_user: Authenticated user (optional)
        session_id: Session ID for anonymous users

    Returns:
        Created feedback

    Raises:
        HTTPException: 404 if output not found, 409 if already submitted
    """
    # Verify output exists
    output = db.query(Output).filter(Output.id == output_id).first()
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output {output_id} not found",
        )

    # Need either user or session
    if not current_user and not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication or session required to submit feedback",
        )

    # Check for existing feedback
    existing_query = db.query(Feedback).filter(Feedback.output_id == output_id)
    if current_user:
        existing = existing_query.filter(Feedback.user_id == current_user.id).first()
    else:
        existing = existing_query.filter(
            Feedback.session_id == session_id, Feedback.user_id.is_(None)
        ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Feedback already submitted for this output",
        )

    # Create feedback
    feedback = Feedback(
        output_id=output_id,
        user_id=current_user.id if current_user else None,
        session_id=session_id if not current_user else None,
        rating=feedback_data.rating,
        comment=feedback_data.comment,
        created_at=datetime.utcnow(),
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    rating_str = "thumbs_up" if feedback.rating else "thumbs_down"
    logger.info(f"Feedback submitted for output {output_id}: {rating_str}")

    return feedback
