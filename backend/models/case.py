"""Case model for ethical dilemmas."""

from sqlalchemy import String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
import enum
from typing import Optional, Any

from models.base import Base, TimestampMixin


class CaseStatus(str, enum.Enum):
    """Status of case consultation processing."""

    DRAFT = "draft"  # Case created, not yet submitted for analysis
    PENDING = "pending"  # Submitted, waiting to be processed
    PROCESSING = "processing"  # Currently being analyzed by LLM
    COMPLETED = "completed"  # Analysis complete, results available
    FAILED = "failed"  # Analysis failed, can retry


class Case(Base, TimestampMixin):
    """Case model for ethical dilemma submissions."""

    __tablename__ = "cases"

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
    )  # For anonymous users
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stakeholders: Mapped[Optional[Any]] = mapped_column(
        JSON, nullable=True
    )  # Array of strings
    constraints: Mapped[Optional[Any]] = mapped_column(
        JSON, nullable=True
    )  # Array of strings
    horizon: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # 'short', 'medium', 'long'
    sensitivity: Mapped[str] = mapped_column(
        String(50), default="low"
    )  # 'low', 'medium', 'high'
    attachments: Mapped[Optional[Any]] = mapped_column(
        JSON, nullable=True
    )  # Optional URLs or text blobs
    locale: Mapped[str] = mapped_column(String(10), default="en")
    # Async processing status
    status: Mapped[str] = mapped_column(
        String(20), default=CaseStatus.DRAFT.value, index=True
    )

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
        return (
            f"<Case(id={self.id}, title={self.title}, sensitivity={self.sensitivity})>"
        )
