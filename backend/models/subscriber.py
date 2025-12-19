"""Newsletter subscriber model for Daily Wisdom."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class SendTime(str, Enum):
    """Time of day preference for receiving daily verse."""

    MORNING = "morning"  # 6 AM IST
    AFTERNOON = "afternoon"  # 12:30 PM IST
    EVENING = "evening"  # 6 PM IST


class Subscriber(Base, TimestampMixin):
    """
    Newsletter subscriber for Daily Wisdom emails.

    Supports:
    - Double opt-in via email verification
    - Optional link to user account
    - Goal-based verse personalization
    - Time preference for delivery
    - 30-day rolling window of sent verses (avoid repeats)
    """

    __tablename__ = "subscribers"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Contact info
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Preferences
    goal_ids: Mapped[List[str]] = mapped_column(
        JSON, default=list, nullable=False
    )  # e.g., ["inner_peace", "resilience"]
    send_time: Mapped[str] = mapped_column(
        String(20), default=SendTime.MORNING.value, nullable=False
    )

    # Verification (double opt-in)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )
    verification_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )

    # Subscription lifecycle
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    unsubscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Verse tracking (30-day rolling window)
    last_verse_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    verses_sent_30d: Mapped[List[str]] = mapped_column(
        JSON, default=list, nullable=False
    )  # Verse canonical IDs sent in last 30 days

    # Optional link to user account
    # Allows logged-in users to subscribe with a different email
    # SET NULL on delete to preserve subscription data
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    # Relationship
    user = relationship("User", back_populates="subscriptions")

    # Composite index for scheduled sending queries
    __table_args__ = (
        Index(
            "ix_subscribers_active_send_time",
            "send_time",
            "verified",
            "unsubscribed_at",
        ),
    )

    @property
    def is_active(self) -> bool:
        """Check if subscriber is active (verified and not unsubscribed)."""
        return self.verified and self.unsubscribed_at is None

    def __repr__(self) -> str:
        status = "active" if self.is_active else "inactive"
        return f"<Subscriber {self.email} ({status})>"
