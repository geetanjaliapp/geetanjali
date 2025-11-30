"""Output management endpoints."""

import logging
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import uuid

from db import get_db
from db.repositories.case_repository import CaseRepository
from models.output import Output
from api.schemas import OutputResponse
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
    db: Session = Depends(get_db)
):
    """
    Analyze a case using the RAG pipeline.

    This endpoint:
    1. Retrieves the case from database
    2. Runs RAG pipeline (retrieve verses + generate brief)
    3. Stores output in database
    4. Returns the generated consulting brief

    Args:
        case_id: Case ID to analyze
        db: Database session

    Returns:
        Generated output with consulting brief

    Raises:
        HTTPException: If case not found or RAG pipeline fails
    """
    logger.info(f"Analyzing case: {case_id}")

    # Get case
    case_repo = CaseRepository(db)
    case = case_repo.get(case_id)

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found"
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
    db: Session = Depends(get_db)
):
    """
    Get an output by ID.

    Args:
        output_id: Output ID
        db: Database session

    Returns:
        Output details

    Raises:
        HTTPException: If output not found
    """
    output = db.query(Output).filter(Output.id == output_id).first()

    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output {output_id} not found"
        )

    return output


@router.get("/cases/{case_id}/outputs", response_model=List[OutputResponse])
async def list_case_outputs(
    case_id: str,
    db: Session = Depends(get_db)
):
    """
    List all outputs for a case.

    Args:
        case_id: Case ID
        db: Database session

    Returns:
        List of outputs for the case
    """
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
    reviewer_id: str = "dev-scholar-id"  # TODO: Replace with actual auth
):
    """
    Submit scholar review for an output.

    Args:
        output_id: Output ID
        approved: Whether the output is approved
        db: Database session
        reviewer_id: Reviewer user ID (from auth)

    Returns:
        Updated output

    Raises:
        HTTPException: If output not found
    """
    output = db.query(Output).filter(Output.id == output_id).first()

    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output {output_id} not found"
        )

    try:
        # Update review status within transaction
        output.reviewed_by = reviewer_id
        output.reviewed_at = datetime.utcnow()

        if approved:
            output.scholar_flag = False  # Clear flag if approved
            logger.info(f"Output {output_id} approved by scholar {reviewer_id}")
        else:
            logger.info(f"Output {output_id} rejected by scholar {reviewer_id}")

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
