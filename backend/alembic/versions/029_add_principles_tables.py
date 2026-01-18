"""Add principle_groups and principles tables

Revision ID: 029
Revises: 028
Create Date: 2026-01-18

This migration adds tables for storing the Bhagavad Gita consulting principles
taxonomy. Data is maintained in code (config/*.json) and synced to DB via
StartupSyncService.

Tables:
- principle_groups: 4 yoga paths (karma, jnana, bhakti, sadachara)
- principles: 16 consulting principles with extended content for SEO
"""

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    # Create principle_groups table
    if "principle_groups" not in existing_tables:
        op.create_table(
            "principle_groups",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("label", sa.String(100), nullable=False),
            sa.Column("sanskrit", sa.String(100), nullable=False),
            sa.Column("transliteration", sa.String(100), nullable=False),
            sa.Column("description", sa.Text, nullable=False),
            sa.Column("display_order", sa.Integer, nullable=False, default=0),
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

    # Create principles table
    if "principles" not in existing_tables:
        op.create_table(
            "principles",
            # Primary key
            sa.Column("id", sa.String(50), primary_key=True),
            # Basic info
            sa.Column("label", sa.String(100), nullable=False),
            sa.Column("short_label", sa.String(50), nullable=False),
            sa.Column("sanskrit", sa.String(100), nullable=False),
            sa.Column("transliteration", sa.String(100), nullable=False),
            sa.Column("description", sa.Text, nullable=False),
            sa.Column("leadership_context", sa.Text, nullable=False),
            # Categorization
            sa.Column(
                "group_id",
                sa.String(50),
                sa.ForeignKey("principle_groups.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("keywords", postgresql.ARRAY(sa.String), nullable=False),
            sa.Column("chapter_focus", postgresql.ARRAY(sa.Integer), nullable=False),
            sa.Column("display_order", sa.Integer, nullable=False, default=0),
            # Extended content for SEO (nullable - populated in Sprint 2)
            sa.Column("extended_description", sa.Text, nullable=True),
            sa.Column("practical_application", sa.Text, nullable=True),
            sa.Column("common_misconceptions", sa.Text, nullable=True),
            sa.Column("faq_question", sa.Text, nullable=True),
            sa.Column("faq_answer", sa.Text, nullable=True),
            sa.Column("related_principles", postgresql.ARRAY(sa.String), nullable=True),
            # Timestamps
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


def downgrade() -> None:
    op.drop_table("principles")
    op.drop_table("principle_groups")
