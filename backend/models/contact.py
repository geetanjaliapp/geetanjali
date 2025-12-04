"""Contact message model for About page feedback/queries."""

from sqlalchemy import String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from models.base import Base


class ContactType(str, Enum):
    """Type of contact message."""

    FEEDBACK = "feedback"
    QUESTION = "question"
    BUG_REPORT = "bug_report"
    FEATURE_REQUEST = "feature_request"
    OTHER = "other"


class ContactMessage(Base):
    """
    Contact message from the About page.

    Stores general feedback, questions, and inquiries from users.
    Messages are also sent via email to configured recipient.
    """

    __tablename__ = "contact_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    message_type: Mapped[ContactType] = mapped_column(
        SQLEnum(ContactType), nullable=False, default=ContactType.FEEDBACK
    )
    subject: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )
    # Track if email was sent successfully
    email_sent: Mapped[bool] = mapped_column(default=False)

    def __repr__(self) -> str:
        return f"<ContactMessage(id={self.id}, type={self.message_type}, email={self.email})>"
