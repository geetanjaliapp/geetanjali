"""FeaturedCase model for curated homepage consultations."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class FeaturedCase(Base, TimestampMixin):
    """Curated cases for homepage display.

    Links to Case records that are:
    - Created via actual consultation flow (with AI responses)
    - Marked as public with share_mode='full'
    - Categorized for homepage tabs (career, relationships, ethics, leadership)

    Multiple cases can exist per category for variety (frontend picks randomly).
    """

    __tablename__ = "featured_cases"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One featured entry per case
        index=True,
    )
    category: Mapped[str] = mapped_column(
        String(20),  # career, relationships, ethics, leadership
        nullable=False,
        index=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
    )

    # Relationship - eager load case data
    case = relationship("Case", lazy="joined")

    __table_args__ = (
        # Composite index for common query pattern
        Index("ix_featured_cases_active_category", "is_active", "category"),
    )

    def __repr__(self) -> str:
        return f"<FeaturedCase(id={self.id}, category={self.category}, case_id={self.case_id})>"
