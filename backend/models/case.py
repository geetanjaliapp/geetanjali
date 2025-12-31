"""Case model for ethical dilemma consultations."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    session_id: Mapped[str | None] = mapped_column(
        String(255), index=True, nullable=True
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stakeholders: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    constraints: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    horizon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(50), default="low")
    attachments: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    locale: Mapped[str] = mapped_column(String(10), default="en")

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default=CaseStatus.DRAFT.value, index=True
    )

    # Sharing
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    public_slug: Mapped[str | None] = mapped_column(
        String(12), unique=True, nullable=True, index=True
    )
    shared_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )  # When case was first made public (for expiration)
    share_mode: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )  # Values: 'full', 'essential', or null (not shared)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Relationships
    # P0.3 FIX: Use lazy="selectin" to batch-load related objects in 1 extra query
    # instead of N+1 queries (one per case). This is the optimal strategy when
    # relationships are always accessed (e.g., case detail view).
    user = relationship("User", back_populates="cases")
    outputs = relationship(
        "Output",
        back_populates="case",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    messages = relationship(
        "Message",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Case(id={self.id}, title={self.title}, status={self.status})>"
