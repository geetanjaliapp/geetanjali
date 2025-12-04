"""Feedback model for user ratings on consultation outputs."""

from sqlalchemy import String, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from datetime import datetime
from typing import Optional

from models.base import Base


class Feedback(Base):
    """
    Feedback model for user ratings on consultation outputs.

    Supports both authenticated users and anonymous sessions.
    Allows thumbs up/down rating with optional comment (max 280 chars).
    """

    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    output_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("outputs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )  # For anonymous feedback
    rating: Mapped[bool] = mapped_column(
        Boolean, nullable=False
    )  # True = thumbs up, False = thumbs down
    comment: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # Max 280 chars enforced in schema
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )

    # Relationships
    output = relationship("Output", back_populates="feedback")
    user = relationship("User", back_populates="feedback")

    def __repr__(self) -> str:
        rating_str = "thumbs_up" if self.rating else "thumbs_down"
        return (
            f"<Feedback(id={self.id}, output_id={self.output_id}, rating={rating_str})>"
        )
