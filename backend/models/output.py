"""Output model for consulting briefs."""

from sqlalchemy import String, Text, ForeignKey, JSON, Float, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from datetime import datetime
from typing import Optional, Any

from models.base import Base


class Output(Base):
    """Output model for generated consulting briefs."""

    __tablename__ = "outputs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cases.id", ondelete="CASCADE"), index=True
    )
    result_json: Mapped[Any] = mapped_column(
        JSON, nullable=False
    )  # Complete output structure
    executive_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )  # 0.0 to 1.0
    scholar_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, index=True
    )  # Index for chronological queries

    # Relationships
    case = relationship("Case", back_populates="outputs")
    reviewer = relationship(
        "User", foreign_keys=[reviewed_by], back_populates="reviewed_outputs"
    )
    message = relationship(
        "Message", back_populates="output", uselist=False
    )  # One-to-one with assistant message
    feedback = relationship(
        "Feedback", back_populates="output", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Output(id={self.id}, case_id={self.case_id}, confidence={self.confidence})>"
