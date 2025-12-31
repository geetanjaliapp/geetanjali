"""Experiment events model for A/B testing analytics."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class ExperimentEvent(Base):
    """
    Experiment event for A/B testing analytics.

    Stores events like variant assignment, CTA clicks, conversions.
    Designed for simple SQL queries without external analytics.
    """

    __tablename__ = "experiment_events"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Experiment info
    experiment: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    variant: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Context
    session_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True
    )
    # Use JSON with JSONB variant for PostgreSQL (SQLite uses plain JSON)
    properties: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=True
    )

    # Timestamps
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    # Composite index for common queries
    __table_args__ = (
        Index("ix_experiment_events_exp_event", "experiment", "event"),
        Index("ix_experiment_events_exp_variant", "experiment", "variant"),
    )

    def __repr__(self) -> str:
        return f"<ExperimentEvent(id={self.id}, experiment={self.experiment}, event={self.event})>"
