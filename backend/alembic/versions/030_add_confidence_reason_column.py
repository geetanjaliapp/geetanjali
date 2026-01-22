"""Add confidence_reason column to outputs table for v1.34.0 escalation feature

Revision ID: 030
Revises: 029
Create Date: 2026-01-22

This migration adds the confidence_reason field to the outputs table to support
transparent user communication about LLM response quality (Phase 5 of v1.34.0).

The confidence_reason field provides a human-readable explanation of why the
response has its given confidence score.
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("outputs")]

    # Add confidence_reason column if it doesn't exist
    if "confidence_reason" not in columns:
        op.add_column(
            "outputs",
            sa.Column("confidence_reason", sa.Text, nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("outputs")]

    # Drop confidence_reason column if it exists
    if "confidence_reason" in columns:
        op.drop_column("outputs", "confidence_reason")
