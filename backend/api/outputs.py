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
from api.schemas import OutputResponse, CaseResponse
from api.middleware.auth import get_optional_user, require_role
from api.dependencies import get_case_with_access
from services.rag import get_rag_pipeline
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


def _create_output_from_result(
    case_id: str,
    result: dict,
    db: Session
) -> Output:
    """Create and persist an Output record from RAG result."""
    output = Output(
        id=str(uuid.uuid4()),
        case_id=case_id,
        result_json=result,
        executive_summary=result.get("executive_summary", ""),
        confidence=result.get("confidence", 0.0),
        scholar_flag=result.get("scholar_flag", False),
        created_at=datetime.utcnow()
    )
    db.add(output)
    return output


def _create_assistant_message(
    case_id: str,
    output: Output,
    result: dict,
    db: Session
) -> None:
    """Create assistant message linked to output."""
    message_repo = MessageRepository(db)
    message_repo.create_assistant_message(
        case_id=case_id,
        content=result.get("executive_summary", ""),
        output_id=output.id
    )


def run_analysis_background(case_id: str, case_data: dict):
    """
    Background task to run RAG analysis.
    Uses a new database session since background tasks run outside request context.
    """
    db = SessionLocal()
    try:
        logger.info(f"[Background] Starting analysis for case {case_id}")

        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            logger.error(f"[Background] Case {case_id} not found")
            return

        case.status = CaseStatus.PROCESSING.value
        db.commit()

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

        logger.info(f"[Background] Analysis complete. Output ID: {output.id}, Confidence: {output.confidence}")

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


@router.post("/cases/{case_id}/analyze/async", response_model=CaseResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(settings.ANALYZE_RATE_LIMIT)
async def analyze_case_async(
    request: Request,
    background_tasks: BackgroundTasks,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db)
):
    """
    Start async analysis of a case using the RAG pipeline.

    This endpoint returns immediately with status 202 Accepted.
    The analysis runs in the background and updates the case status.
    Poll GET /cases/{case_id} to check status (pending -> processing -> completed/failed).

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

    # Build case data and queue background task
    case_data = _build_case_data(case)
    background_tasks.add_task(run_analysis_background, case.id, case_data)

    logger.info(f"Async analysis queued for case {case.id}")
    return case


@router.post("/cases/{case_id}/analyze", response_model=OutputResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.ANALYZE_RATE_LIMIT)
async def analyze_case(
    request: Request,
    case: Case = Depends(get_case_with_access),
    db: Session = Depends(get_db)
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

            logger.info(f"Analysis complete. Output ID: {output.id}, Confidence: {output.confidence}")
            return output

        except SQLAlchemyError as db_error:
            db.rollback()
            logger.error(f"Database error saving output for case {case.id}: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to save your consultation. Please try again."
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed for case {case.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete your consultation right now. Please try again later."
        )


@router.get("/outputs/{output_id}", response_model=OutputResponse)
async def get_output(
    output_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
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
            detail=f"Output {output_id} not found"
        )

    # Verify ownership via case
    case_repo = CaseRepository(db)
    case = case_repo.get(output.case_id)

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found for this output"
        )

    # Verify ownership if case belongs to a user
    if case.user_id is not None:
        if current_user is None or case.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this output"
            )

    return output


@router.get("/cases/{case_id}/outputs", response_model=List[OutputResponse])
async def list_case_outputs(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    List all outputs for a case (supports anonymous users).

    Args:
        case_id: Case ID
        db: Database session
        current_user: Authenticated user (optional)

    Returns:
        List of outputs for the case
    """
    # Verify case ownership
    case_repo = CaseRepository(db)
    case = case_repo.get(case_id)

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

    outputs = (
        db.query(Output)
        .filter(Output.case_id == case_id)
        .order_by(Output.created_at.desc())
        .all()
    )

    return outputs


@router.post("/outputs/{output_id}/scholar-review", response_model=OutputResponse)
async def submit_scholar_review(
    output_id: str,
    approved: bool,
    db: Session = Depends(get_db),
    scholar_user: User = Depends(require_role("scholar"))
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
            detail=f"Output {output_id} not found"
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
        logger.error(f"Database error updating scholar review for output {output_id}: {db_error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update review status: {str(db_error)}"
        )
