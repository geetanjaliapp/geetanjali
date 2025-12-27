"""Add theme preferences to user_preferences table

Revision ID: 021
Revises: 020
Create Date: 2025-12-27

Adds theme preference columns to user_preferences table:
- theme_mode: light/dark/system (default: system)
- theme_id: default/sutra/serenity/forest (default: default)
- font_family: serif/sans/mixed (default: mixed)
- theme_updated_at: timestamp for merge conflict resolution
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent - check if columns already exist
    conn = op.get_bind()
    inspector = inspect(conn)

    if "user_preferences" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("user_preferences")]

        if "theme_mode" not in existing_columns:
            op.add_column(
                "user_preferences",
                sa.Column(
                    "theme_mode",
                    sa.String(10),
                    nullable=False,
                    server_default="system",
                ),
            )

        if "theme_id" not in existing_columns:
            op.add_column(
                "user_preferences",
                sa.Column(
                    "theme_id",
                    sa.String(20),
                    nullable=False,
                    server_default="default",
                ),
            )

        if "font_family" not in existing_columns:
            op.add_column(
                "user_preferences",
                sa.Column(
                    "font_family",
                    sa.String(10),
                    nullable=False,
                    server_default="mixed",
                ),
            )

        if "theme_updated_at" not in existing_columns:
            op.add_column(
                "user_preferences",
                sa.Column("theme_updated_at", sa.DateTime(), nullable=True),
            )


def downgrade() -> None:
    op.drop_column("user_preferences", "theme_updated_at")
    op.drop_column("user_preferences", "font_family")
    op.drop_column("user_preferences", "theme_id")
    op.drop_column("user_preferences", "theme_mode")
