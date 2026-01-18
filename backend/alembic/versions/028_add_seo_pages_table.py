"""Add seo_pages table for tracking generated SEO static pages

Revision ID: 028
Revises: 027
Create Date: 2026-01-18

This migration adds the seo_pages table which tracks generated SEO static HTML
pages and their content hashes. This enables incremental regeneration - only
pages whose source data or templates have changed are regenerated.

The table uses page_key as a natural primary key since it's already unique
(e.g., "BG_2_47", "chapter_2", "topic_dharma").

Tracked page types:
- verse: Individual verse pages (701 total)
- chapter: Chapter index pages (18)
- topic: Principle/topic pages (17)
- featured: Featured verses showcase
- daily: Verse of the day landing
- home: Homepage
- about: About page
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent
    conn = op.get_bind()
    inspector = inspect(conn)

    if "seo_pages" not in inspector.get_table_names():
        op.create_table(
            "seo_pages",
            # Natural primary key - page identifier
            sa.Column("page_key", sa.String(100), primary_key=True),
            # Page category (verse, chapter, topic, etc.)
            sa.Column("page_type", sa.String(50), nullable=False),
            # SHA256 hash of source data (64 hex chars)
            sa.Column("source_hash", sa.String(64), nullable=False),
            # SHA256 hash of template (first 16 chars)
            sa.Column("template_hash", sa.String(16), nullable=False),
            # When the page was last generated
            sa.Column("generated_at", sa.DateTime, nullable=False),
            # Relative file path within SEO output dir
            sa.Column("file_path", sa.String(200), nullable=False),
            # File size for monitoring (nullable for backwards compat)
            sa.Column("file_size_bytes", sa.Integer, nullable=True),
            # Generation duration in milliseconds
            sa.Column("generation_ms", sa.Integer, nullable=True),
            # TimestampMixin fields
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
                onupdate=sa.func.now(),
            ),
        )
        # Index for filtering by page type (common query pattern)
        op.create_index("ix_seo_pages_page_type", "seo_pages", ["page_type"])


def downgrade() -> None:
    op.drop_index("ix_seo_pages_page_type", table_name="seo_pages")
    op.drop_table("seo_pages")
