"""User preferences model for cross-device sync."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class UserPreferences(Base, TimestampMixin):
    """User preferences for favorites, reading progress, and learning goals.

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

    # Favorites - list of canonical IDs (e.g., "BG_2_47")
    # Using JSON for SQLite test compatibility (PostgreSQL also supports JSON)
    favorites: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    favorites_updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Reading progress (Phase 4b)
    reading_chapter: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_verse: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reading_font_size: Mapped[str] = mapped_column(
        String(10), default="medium", nullable=False
    )
    # Use JSON with JSONB variant for PostgreSQL (SQLite uses plain JSON in tests)
    reading_section_prefs: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), default=dict, nullable=False
    )
    reading_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Learning goals (Phase 4b) - list of goal IDs from taxonomy
    learning_goal_ids: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    learning_goal_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # Theme preferences - synced across devices
    theme_mode: Mapped[str] = mapped_column(
        String(10), default="system", nullable=False
    )  # light/dark/system
    theme_id: Mapped[str] = mapped_column(
        String(20), default="default", nullable=False
    )  # default/sutra/serenity/forest
    font_family: Mapped[str] = mapped_column(
        String(10), default="mixed", nullable=False
    )  # serif/sans/mixed
    theme_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationship back to User
    user = relationship("User", back_populates="preferences")

    def __repr__(self) -> str:
        return f"<UserPreferences(user_id={self.user_id}, favorites={len(self.favorites or [])})>"
