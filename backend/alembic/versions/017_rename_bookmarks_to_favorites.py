"""Rename bookmarks columns to favorites

Revision ID: 017
Revises: 016
Create Date: 2025-12-21

Renames:
- bookmarks -> favorites
- bookmarks_updated_at -> favorites_updated_at

This aligns the database schema with the user-facing terminology.
"""

from alembic import op
from sqlalchemy import inspect

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if columns exist before renaming (idempotent)
    conn = op.get_bind()
    inspector = inspect(conn)

    if "user_preferences" not in inspector.get_table_names():
        return  # Table doesn't exist, nothing to do

    columns = [col["name"] for col in inspector.get_columns("user_preferences")]

    # Rename bookmarks -> favorites if old column exists
    if "bookmarks" in columns:
        op.alter_column(
            "user_preferences",
            "bookmarks",
            new_column_name="favorites",
        )

    # Rename bookmarks_updated_at -> favorites_updated_at if old column exists
    if "bookmarks_updated_at" in columns:
        op.alter_column(
            "user_preferences",
            "bookmarks_updated_at",
            new_column_name="favorites_updated_at",
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if "user_preferences" not in inspector.get_table_names():
        return

    columns = [col["name"] for col in inspector.get_columns("user_preferences")]

    # Rename back: favorites -> bookmarks
    if "favorites" in columns:
        op.alter_column(
            "user_preferences",
            "favorites",
            new_column_name="bookmarks",
        )

    if "favorites_updated_at" in columns:
        op.alter_column(
            "user_preferences",
            "favorites_updated_at",
            new_column_name="bookmarks_updated_at",
        )
