"""Add public sharing fields to cases table.

Revision ID: 007_add_public_sharing
Revises: 371e7e724461
Create Date: 2025-12-04
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "007_add_public_sharing"
down_revision = "371e7e724461"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_public and public_slug columns for public sharing of cases."""
    # Add is_public column with default False
    op.add_column(
        "cases", sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false")
    )

    # Add public_slug column (unique, nullable for private cases)
    op.add_column(
        "cases", sa.Column("public_slug", sa.String(12), nullable=True)
    )

    # Create indexes for efficient lookups
    op.create_index("ix_cases_is_public", "cases", ["is_public"])
    op.create_index("ix_cases_public_slug", "cases", ["public_slug"], unique=True)


def downgrade() -> None:
    """Remove public sharing columns."""
    op.drop_index("ix_cases_public_slug", table_name="cases")
    op.drop_index("ix_cases_is_public", table_name="cases")
    op.drop_column("cases", "public_slug")
    op.drop_column("cases", "is_public")
