"""Add server_default to subscribers JSON columns

Revision ID: 011
Revises: 010
Create Date: 2025-12-19

Fixes:
- goal_ids and verses_sent_30d columns now have database-level defaults
- Ensures correct behavior for direct SQL inserts
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent - check if table exists
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if "subscribers" in existing_tables:
        # Add server_default to goal_ids column
        op.alter_column(
            "subscribers",
            "goal_ids",
            existing_type=sa.JSON(),
            server_default=sa.text("'[]'"),
            existing_nullable=False,
        )

        # Add server_default to verses_sent_30d column
        op.alter_column(
            "subscribers",
            "verses_sent_30d",
            existing_type=sa.JSON(),
            server_default=sa.text("'[]'"),
            existing_nullable=False,
        )

        # Add server_default to send_time column
        op.alter_column(
            "subscribers",
            "send_time",
            existing_type=sa.String(20),
            server_default="morning",
            existing_nullable=False,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if "subscribers" in existing_tables:
        # Remove server_default from columns
        op.alter_column(
            "subscribers",
            "goal_ids",
            existing_type=sa.JSON(),
            server_default=None,
            existing_nullable=False,
        )

        op.alter_column(
            "subscribers",
            "verses_sent_30d",
            existing_type=sa.JSON(),
            server_default=None,
            existing_nullable=False,
        )

        op.alter_column(
            "subscribers",
            "send_time",
            existing_type=sa.String(20),
            server_default=None,
            existing_nullable=False,
        )
