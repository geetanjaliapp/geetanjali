"""Case model for ethical dilemma consultations."""

from sqlalchemy import String, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
import enum
from typing import Optional, Any

from models.base import Base, TimestampMixin


class CaseStatus(str, enum.Enum):
    """Status of case consultation processing."""

    DRAFT = "draft"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    POLICY_VIOLATION = "policy_violation"


class Case(Base, TimestampMixin):
    """Case model for ethical dilemma submissions."""

    __tablename__ = "cases"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(255), index=True, nullable=True
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stakeholders: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    constraints: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    horizon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(50), default="low")
    attachments: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    locale: Mapped[str] = mapped_column(String(10), default="en")

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default=CaseStatus.DRAFT.value, index=True
    )

    # Sharing
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    public_slug: Mapped[Optional[str]] = mapped_column(
        String(12), unique=True, nullable=True, index=True
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Relationships
    user = relationship("User", back_populates="cases")
    outputs = relationship(
        "Output", back_populates="case", cascade="all, delete-orphan"
    )
    messages = relationship(
        "Message",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def __repr__(self) -> str:
        return f"<Case(id={self.id}, title={self.title}, status={self.status})>"
