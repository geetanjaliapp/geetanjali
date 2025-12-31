"""Extend sync_hashes content_hash column to 128 chars

Revision ID: 025
Revises: 024
Create Date: 2025-12-31

The hash now includes a version prefix (e.g., "v1:") for algorithm migrations,
so the column needs to accommodate: prefix (up to 8 chars) + SHA256 (64 chars).
Extending to 128 chars provides ample headroom.
"""

import sqlalchemy as sa

from alembic import op

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "sync_hashes",
        "content_hash",
        existing_type=sa.String(64),
        type_=sa.String(128),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "sync_hashes",
        "content_hash",
        existing_type=sa.String(128),
        type_=sa.String(64),
        existing_nullable=False,
    )
