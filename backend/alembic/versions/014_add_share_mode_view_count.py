"""Add share_mode and view_count to cases for shared consultations

Revision ID: 014
Revises: 013
Create Date: 2025-12-20

Adds:
- share_mode: Visibility mode for shared cases ('full' or 'essential')
- view_count: Number of times a public case has been viewed

Backfill:
- Existing public cases get share_mode='full' to preserve current behavior
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent - check if columns already exist
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("cases")]

    if "share_mode" not in columns:
        op.add_column(
            "cases",
            sa.Column("share_mode", sa.String(20), nullable=True),
        )

    if "view_count" not in columns:
        op.add_column(
            "cases",
            sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        )

    # Backfill: Set share_mode='full' for existing public cases
    op.execute(
        "UPDATE cases SET share_mode = 'full' WHERE is_public = true AND share_mode IS NULL"
    )


def downgrade() -> None:
    op.drop_column("cases", "view_count")
    op.drop_column("cases", "share_mode")
