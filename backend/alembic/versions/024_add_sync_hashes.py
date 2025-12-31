"""Add sync_hashes table for curated content change detection

Revision ID: 024
Revises: 023
Create Date: 2025-12-31

This migration adds the sync_hashes table which stores hashes of curated
content source files. On startup, the app computes a hash of each content
type and compares it to detect changes that need to be synced.

Content types tracked:
- book_metadata: Book cover metadata
- chapter_metadata: Chapter intro metadata
- dhyanam_verses: Geeta Dhyanam invocation verses
- featured_verses: Featured verse IDs list
- audio_metadata: Verse audio/TTS metadata
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent
    conn = op.get_bind()
    inspector = inspect(conn)

    if "sync_hashes" not in inspector.get_table_names():
        op.create_table(
            "sync_hashes",
            # Primary key is the content type
            sa.Column("content_type", sa.String(50), primary_key=True),
            # SHA256 hash (64 hex chars)
            sa.Column("content_hash", sa.String(64), nullable=False),
            # When the content was last synced
            sa.Column(
                "synced_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
            # When the hash record was created
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
        )


def downgrade() -> None:
    op.drop_table("sync_hashes")
