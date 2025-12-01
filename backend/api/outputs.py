"""Output management endpoints."""

import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import uuid

from db import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.message_repository import MessageRepository
from models.output import Output
from models.user import User
from api.schemas import OutputResponse
from api.middleware.auth import get_current_user, get_optional_user, require_role
from services.rag import get_rag_pipeline
from config import settings

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


@router.post("/cases/{case_id}/analyze", response_model=OutputResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.ANALYZE_RATE_LIMIT)
async def analyze_case(
    request: Request,
    case_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Analyze a case using the RAG pipeline (supports anonymous users).

    This endpoint:
    1. Retrieves the case from database
    2. Runs RAG pipeline (retrieve verses + generate brief)
    3. Stores output in database
    4. Returns the generated consulting brief

    Args:
        case_id: Case ID to analyze
        db: Database session
        current_user: Authenticated user (optional)

    Returns:
        Generated output with consulting brief

    Raises:
        HTTPException: If case not found or user doesn't have access, or RAG pipeline fails
    """
    logger.info(f"Analyzing case: {case_id} (anonymous={current_user is None})")

    # Get case and verify ownership
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

    try:
        # Prepare case data for RAG pipeline
        case_data = {
            "title": case.title,
            "description": case.description,
            "role": case.role,
            "stakeholders": case.stakeholders,
            "constraints": case.constraints,
            "horizon": case.horizon,
            "sensitivity": case.sensitivity,
        }

        # Run RAG pipeline
        rag_pipeline = get_rag_pipeline()
        result = rag_pipeline.run(case_data)

        # Create output record within transaction
        try:
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
            db.commit()
            db.refresh(output)

            # Create assistant message linked to this output
            message_repo = MessageRepository(db)
            message_repo.create_assistant_message(
                case_id=case_id,
                content=result.get("executive_summary", ""),
                output_id=output.id
            )

            logger.info(f"Analysis complete. Output ID: {output.id}, Confidence: {output.confidence}")

            return output

        except Exception as db_error:
            db.rollback()
            logger.error(f"Database error saving output for case {case_id}: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save analysis result: {str(db_error)}"
            )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Analysis failed for case {case_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
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
