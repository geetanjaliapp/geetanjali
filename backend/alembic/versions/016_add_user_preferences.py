"""Add user_preferences table for cross-device sync

Revision ID: 016
Revises: 015
Create Date: 2025-12-21

Adds:
- user_preferences: Stores favorites, reading progress, and learning goals
  - One row per user (unique constraint on user_id)
  - favorites: JSON list of canonical verse IDs
  - reading_*: Chapter, verse, font size, section prefs
  - learning_goal_*: Goal ID with timestamp
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent - check if table already exists
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if "user_preferences" not in existing_tables:
        op.create_table(
            "user_preferences",
            # Primary key
            sa.Column("id", sa.String(36), primary_key=True),
            # Foreign key to users (one-to-one)
            sa.Column(
                "user_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            # Favorites (JSON for cross-database compatibility)
            sa.Column(
                "favorites",
                sa.JSON(),
                nullable=False,
                server_default="[]",
            ),
            sa.Column(
                "favorites_updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
            # Reading progress
            sa.Column("reading_chapter", sa.Integer(), nullable=True),
            sa.Column("reading_verse", sa.Integer(), nullable=True),
            sa.Column(
                "reading_font_size",
                sa.String(10),
                nullable=False,
                server_default="medium",
            ),
            sa.Column(
                "reading_section_prefs",
                JSONB(),
                nullable=False,
                server_default="{}",
            ),
            sa.Column("reading_updated_at", sa.DateTime(), nullable=True),
            # Learning goal
            sa.Column("learning_goal_id", sa.String(50), nullable=True),
            sa.Column("learning_goal_updated_at", sa.DateTime(), nullable=True),
            # Timestamps
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

        # Create index on user_id for fast lookups
        op.create_index(
            "ix_user_preferences_user_id", "user_preferences", ["user_id"]
        )


def downgrade() -> None:
    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_table("user_preferences")
