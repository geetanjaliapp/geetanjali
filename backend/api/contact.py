"""Contact form API endpoint."""

import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum

from db.connection import get_db
from models.contact import ContactMessage, ContactType
from services.email import send_contact_email

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

    name: str = Field(..., min_length=1, max_length=100, description="Sender's name")
    email: EmailStr = Field(..., description="Sender's email address")
    message_type: ContactTypeEnum = Field(
        default=ContactTypeEnum.feedback,
        description="Type of message"
    )
    subject: Optional[str] = Field(
        None, max_length=200, description="Optional subject line"
    )
    message: str = Field(
        ..., min_length=10, max_length=5000, description="Message content"
    )


class ContactResponse(BaseModel):
    """Response model for contact form submission."""

    success: bool
    message: str
    id: Optional[str] = None


@router.post("", response_model=ContactResponse)
async def submit_contact(
    request: ContactRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submit a contact form message.

    The message is stored in the database and sent via email
    to the configured recipient.

    Args:
        request: Contact form data
        background_tasks: FastAPI background tasks for async email sending
        db: Database session

    Returns:
        Success status and message
    """
    try:
        # Convert API enum to model enum
        db_message_type = ContactType(request.message_type.value)

        # Create database record
        contact = ContactMessage(
            name=request.name,
            email=request.email,
            message_type=db_message_type,
            subject=request.subject,
            message=request.message,
            email_sent=False
        )

        db.add(contact)
        db.commit()
        db.refresh(contact)

        logger.info(f"Contact message saved: {contact.id}")

        # Send email in background
        background_tasks.add_task(
            send_contact_email_task,
            contact_id=contact.id,
            name=request.name,
            email=request.email,
            message_type=request.message_type.value,
            subject=request.subject,
            message=request.message
        )

        return ContactResponse(
            success=True,
            message="Thank you for your message! We'll get back to you soon.",
            id=contact.id
        )

    except Exception as e:
        logger.error(f"Failed to submit contact form: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to submit your message. Please try again later."
        )


def send_contact_email_task(
    contact_id: str,
    name: str,
    email: str,
    message_type: str,
    subject: Optional[str],
    message: str
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
        message=message
    )

    # Update database record
    db = SessionLocal()
    try:
        contact = db.query(ContactMessage).filter(
            ContactMessage.id == contact_id
        ).first()

        if contact:
            contact.email_sent = email_sent
            db.commit()
            logger.info(f"Contact {contact_id} email_sent updated: {email_sent}")

    except Exception as e:
        logger.error(f"Failed to update contact email_sent status: {e}")

    finally:
        db.close()
