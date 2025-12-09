"""Add experiment events table for A/B testing

Revision ID: 003
Revises: 002
Create Date: 2025-12-09

Adds:
- experiment_events: Table for tracking A/B test events
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent - check if table already exists
    conn = op.get_bind()
    inspector = inspect(conn)
    if "experiment_events" in inspector.get_table_names():
        return  # Table already exists (created by Base.metadata.create_all)

    op.create_table(
        "experiment_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("experiment", sa.String(100), nullable=False, index=True),
        sa.Column("event", sa.String(100), nullable=False, index=True),
        sa.Column("variant", sa.String(50), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=True, index=True),
        sa.Column("properties", JSONB, nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # Composite indexes for common queries
    op.create_index(
        "ix_experiment_events_exp_event",
        "experiment_events",
        ["experiment", "event"],
    )
    op.create_index(
        "ix_experiment_events_exp_variant",
        "experiment_events",
        ["experiment", "variant"],
    )


def downgrade() -> None:
    op.drop_index("ix_experiment_events_exp_variant", table_name="experiment_events")
    op.drop_index("ix_experiment_events_exp_event", table_name="experiment_events")
    op.drop_table("experiment_events")
