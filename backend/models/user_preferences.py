"""User preferences model for cross-device sync."""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class UserPreferences(Base, TimestampMixin):
    """User preferences for bookmarks, reading progress, and learning goals.

    One row per user. Created lazily on first preferences access.
    Syncs with localStorage on frontend for cross-device experience.
    """

    __tablename__ = "user_preferences"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # One-to-one with User
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Bookmarks - list of canonical IDs (e.g., "BG_2_47")
    # Using JSON for SQLite test compatibility (PostgreSQL also supports JSON)
    bookmarks: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    bookmarks_updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Reading progress (Phase 4b)
    reading_chapter: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reading_verse: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reading_font_size: Mapped[str] = mapped_column(
        String(10), default="medium", nullable=False
    )
    # Use JSON with JSONB variant for PostgreSQL (SQLite uses plain JSON in tests)
    reading_section_prefs: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), default=dict, nullable=False
    )
    reading_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    # Learning goal (Phase 4b)
    learning_goal_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    learning_goal_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    # Relationship back to User
    user = relationship("User", back_populates="preferences")

    def __repr__(self) -> str:
        return f"<UserPreferences(user_id={self.user_id}, bookmarks={len(self.bookmarks or [])})>"
