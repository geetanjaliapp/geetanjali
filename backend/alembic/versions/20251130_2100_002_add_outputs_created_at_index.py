"""add_outputs_created_at_index

Revision ID: 002
Revises: 001
Create Date: 2025-11-30 21:00:00.000000

"""

from alembic import op
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add index on created_at column in outputs table for better query performance."""
    op.create_index("ix_outputs_created_at", "outputs", ["created_at"], unique=False)


def downgrade() -> None:
    """Remove index on created_at column in outputs table."""
    op.drop_index("ix_outputs_created_at", table_name="outputs")
