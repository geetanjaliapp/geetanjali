"""Add anchor_verse_id column to cases for v1.39.0 verse-consultation bridge

Revision ID: 031
Revises: 030
Create Date: 2026-06-22

Anchor verse ID links a consultation case to a specific verse the user was
reading before starting the consultation. Nullable — existing cases and
non-verse consultations are unaffected. Indexed for v1.40.0 "all consultations
for this verse" queries.
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("cases")]

    if "anchor_verse_id" not in columns:
        op.add_column(
            "cases",
            sa.Column(
                "anchor_verse_id",
                sa.String(30),
                nullable=True,
                index=True,
            ),
        )
        # Index via op for cross-database compatibility
        op.create_index(
            "ix_cases_anchor_verse_id",
            "cases",
            ["anchor_verse_id"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("cases")]

    if "anchor_verse_id" in columns:
        op.drop_index("ix_cases_anchor_verse_id", table_name="cases")
        op.drop_column("cases", "anchor_verse_id")
