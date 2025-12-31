"""Add dhyanam_verses table for Geeta Dhyanam invocation verses

Revision ID: 023
Revises: 022
Create Date: 2025-12-31

This migration adds the dhyanam_verses table which stores the 9 sacred
invocation verses (Geeta Dhyanam) traditionally recited before studying
the Bhagavad Geeta.

These verses are synced from data/geeta_dhyanam.py via the admin sync endpoint.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent
    conn = op.get_bind()
    inspector = inspect(conn)

    if "dhyanam_verses" not in inspector.get_table_names():
        op.create_table(
            "dhyanam_verses",
            # Primary key
            sa.Column("id", sa.String(36), primary_key=True),
            # Verse number (1-9)
            sa.Column(
                "verse_number",
                sa.Integer,
                unique=True,
                nullable=False,
                index=True,
            ),
            # Multilingual content
            sa.Column("sanskrit", sa.Text, nullable=False),
            sa.Column("iast", sa.Text, nullable=False),
            sa.Column("english", sa.Text, nullable=False),
            sa.Column("hindi", sa.Text, nullable=False),
            # Metadata
            sa.Column("theme", sa.String(255), nullable=False),
            # Audio
            sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
            sa.Column("audio_url", sa.String(255), nullable=False),
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
            # Constraints
            sa.CheckConstraint(
                "verse_number >= 1 AND verse_number <= 9",
                name="check_dhyanam_verse_number_range",
            ),
        )


def downgrade() -> None:
    op.drop_table("dhyanam_verses")
