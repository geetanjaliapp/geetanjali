"""Output model for LLM consultation results."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class Output(Base):
    """Output model for generated consulting briefs."""

    __tablename__ = "outputs"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="CASCADE"), index=True
    )

    # Content
    result_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    executive_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Debug - only populated for policy violations
    raw_llm_response: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Review
    scholar_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    reviewed_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )

    # Relationships
    case = relationship("Case", back_populates="outputs")
    reviewer = relationship(
        "User", foreign_keys=[reviewed_by], back_populates="reviewed_outputs"
    )
    message = relationship("Message", back_populates="output", uselist=False)
    feedback = relationship(
        "Feedback", back_populates="output", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Output(id={self.id}, case_id={self.case_id}, confidence={self.confidence})>"
