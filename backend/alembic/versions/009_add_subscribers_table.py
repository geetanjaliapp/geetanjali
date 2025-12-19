"""Add subscribers table for Daily Wisdom newsletter

Revision ID: 009
Revises: 008
Create Date: 2025-12-19

Adds:
- subscribers: Newsletter subscription management
  - Double opt-in via verification token
  - Learning goal preferences for personalization
  - Send time preference (morning/afternoon/evening)
  - 30-day rolling window for verse deduplication
  - Optional FK to users table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent - check if table already exists
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if "subscribers" not in existing_tables:
        op.create_table(
            "subscribers",
            # Primary key
            sa.Column("id", sa.String(36), primary_key=True),
            # Contact info
            sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=True),
            # Preferences (JSON for SQLite compat, JSONB for PostgreSQL)
            sa.Column("goal_ids", sa.JSON(), nullable=False, default=list),
            sa.Column("send_time", sa.String(20), nullable=False, default="morning"),
            # Verification (double opt-in)
            sa.Column("verified", sa.Boolean(), nullable=False, default=False),
            sa.Column(
                "verification_token", sa.String(64), nullable=True, index=True
            ),
            sa.Column("verification_expires_at", sa.DateTime(), nullable=True),
            # Subscription lifecycle
            sa.Column("verified_at", sa.DateTime(), nullable=True),
            sa.Column("unsubscribed_at", sa.DateTime(), nullable=True),
            # Verse tracking (30-day rolling window)
            sa.Column("last_verse_sent_at", sa.DateTime(), nullable=True),
            sa.Column("verses_sent_30d", sa.JSON(), nullable=False, default=list),
            # Optional link to user account
            sa.Column(
                "user_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
                index=True,
            ),
            # Timestamps
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

        # Composite index for scheduled sending queries
        op.create_index(
            "ix_subscribers_active_send_time",
            "subscribers",
            ["send_time", "verified", "unsubscribed_at"],
        )


def downgrade() -> None:
    op.drop_index("ix_subscribers_active_send_time", table_name="subscribers")
    op.drop_table("subscribers")
