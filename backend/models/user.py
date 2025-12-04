"""User model."""

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from datetime import datetime
from typing import Optional

from models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """User model for authentication and case ownership."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )  # Nullable for backward compatibility
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    role: Mapped[str] = mapped_column(String(100), default="user")
    org_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    api_key: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )

    # Relationships
    cases = relationship("Case", back_populates="user", cascade="all, delete-orphan")
    reviewed_outputs = relationship(
        "Output", foreign_keys="Output.reviewed_by", back_populates="reviewer"
    )
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    feedback = relationship("Feedback", back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, name={self.name}, role={self.role})>"
