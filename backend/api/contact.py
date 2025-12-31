"""Contact form API endpoint."""

import logging
from enum import Enum

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from api.dependencies import limiter
from db.connection import get_db
from models.contact import ContactMessage, ContactType
from services.content_filter import ContentPolicyError, validate_submission_content
from services.email import send_contact_email
from utils.sanitization import SafeName, SafeText, SafeTitle

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contact")


class ContactTypeEnum(str, Enum):
    """Contact message types for API schema."""

    feedback = "feedback"
    question = "question"
    bug_report = "bug_report"
    feature_request = "feature_request"
    other = "other"


class ContactRequest(BaseModel):
    """Request model for contact form submission."""

    name: SafeName = Field(..., min_length=1, description="Sender's name")
    email: EmailStr = Field(..., description="Sender's email address")
    message_type: ContactTypeEnum = Field(
        default=ContactTypeEnum.feedback, description="Type of message"
    )
    subject: SafeTitle | None = Field(None, description="Optional subject line")
    message: SafeText = Field(..., min_length=10, description="Message content")

    @field_validator("name", "subject")
    @classmethod
    def reject_crlf(cls, v: str | None) -> str | None:
        """Reject CRLF characters to prevent email header injection."""
        if v is None:
            return v
        if "\r" in v or "\n" in v:
            raise ValueError("Field cannot contain newline characters")
        return v


class ContactResponse(BaseModel):
    """Response model for contact form submission."""

    success: bool
    message: str
    id: str | None = None


@router.post("", response_model=ContactResponse)
@limiter.limit("3/hour")
async def submit_contact(
    request: Request,
    data: ContactRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Submit a contact form message.

    The message is stored in the database and sent via email
    to the configured recipient.

    Args:
        request: Starlette Request (required by rate limiter)
        data: Contact form data
        background_tasks: FastAPI background tasks for async email sending
        db: Database session

    Returns:
        Success status and message
    """
    # Content validation (spam, gibberish, abuse detection)
    # Using subject as title, message as description - mirrors case submission pattern
    try:
        validate_submission_content(
            title=data.subject or data.name,  # Use name if no subject
            description=data.message,
        )
    except ContentPolicyError as e:
        logger.warning(
            "Contact form content violation",
            extra={
                "violation_type": e.violation_type.value,
                "input_length": len(data.message),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    try:
        # Convert API enum to model enum
        db_message_type = ContactType(data.message_type.value)

        # Create database record
        contact = ContactMessage(
            name=data.name,
            email=data.email,
            message_type=db_message_type,
            subject=data.subject,
            message=data.message,
            email_sent=False,
        )

        db.add(contact)
        db.commit()
        db.refresh(contact)

        logger.info(f"Contact message saved: {contact.id}")

        # Send email in background
        background_tasks.add_task(
            send_contact_email_task,
            contact_id=contact.id,
            name=data.name,
            email=data.email,
            message_type=data.message_type.value,
            subject=data.subject,
            message=data.message,
        )

        return ContactResponse(
            success=True,
            message="Thank you for your message! We'll get back to you soon.",
            id=contact.id,
        )

    except Exception as e:
        logger.error(f"Failed to submit contact form: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save message. Please try again.",
        )


def send_contact_email_task(
    contact_id: str,
    name: str,
    email: str,
    message_type: str,
    subject: str | None,
    message: str,
):
    """
    Background task to send contact email and update database.

    Args:
        contact_id: Database record ID
        name: Sender's name
        email: Sender's email
        message_type: Type of message
        subject: Optional subject
        message: Message content
    """
    from db.connection import SessionLocal

    # Send email
    email_sent = send_contact_email(
        name=name,
        email=email,
        message_type=message_type,
        subject=subject,
        message=message,
    )

    # Update database record
    db = SessionLocal()
    try:
        contact = (
            db.query(ContactMessage).filter(ContactMessage.id == contact_id).first()
        )

        if contact:
            contact.email_sent = email_sent
            db.commit()
            logger.info(f"Contact {contact_id} email_sent updated: {email_sent}")

    except Exception as e:
        logger.error(f"Failed to update contact email_sent status: {e}")

    finally:
        db.close()
