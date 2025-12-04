"""add_is_featured_to_verses

Revision ID: 004
Revises: 003
Create Date: 2025-12-02 15:00:00.000000+00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_featured column to verses table
    # This marks showcase-worthy verses for featured selection
    op.add_column(
        "verses",
        sa.Column("is_featured", sa.Boolean(), nullable=True, server_default="false"),
    )

    # Create index for efficient featured verse queries
    op.create_index("ix_verses_is_featured", "verses", ["is_featured"], unique=False)


def downgrade() -> None:
    # Drop index first
    op.drop_index("ix_verses_is_featured", table_name="verses")
    # Drop is_featured column
    op.drop_column("verses", "is_featured")
