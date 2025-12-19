"""Add verses_sent_count to subscribers table for milestone tracking

Revision ID: 010
Revises: 009
Create Date: 2025-12-19

Adds:
- verses_sent_count: Total number of verses sent (for milestone messages at day 7, 30, 100, 365)
- Also fixes name column size (255 -> 100) to align with API validation
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # Check if subscribers table exists
    if "subscribers" not in inspector.get_table_names():
        return  # Table doesn't exist, nothing to do

    # Get existing columns
    existing_columns = [col["name"] for col in inspector.get_columns("subscribers")]

    # Add verses_sent_count column if it doesn't exist
    if "verses_sent_count" not in existing_columns:
        op.add_column(
            "subscribers",
            sa.Column("verses_sent_count", sa.Integer(), nullable=False, server_default="0"),
        )

    # Fix name column size (255 -> 100) to align with API validation
    # PostgreSQL supports ALTER COLUMN TYPE
    try:
        op.alter_column(
            "subscribers",
            "name",
            type_=sa.String(100),
            existing_type=sa.String(255),
            existing_nullable=True,
        )
    except Exception:
        # SQLite doesn't support ALTER COLUMN TYPE, skip
        pass


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if "subscribers" not in inspector.get_table_names():
        return

    existing_columns = [col["name"] for col in inspector.get_columns("subscribers")]

    if "verses_sent_count" in existing_columns:
        op.drop_column("subscribers", "verses_sent_count")

    # Revert name column size (optional, may fail on SQLite)
    try:
        op.alter_column(
            "subscribers",
            "name",
            type_=sa.String(255),
            existing_type=sa.String(100),
            existing_nullable=True,
        )
    except Exception:
        pass
