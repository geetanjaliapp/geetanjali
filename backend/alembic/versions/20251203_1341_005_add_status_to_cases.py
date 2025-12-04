"""add_status_to_cases

Revision ID: 005
Revises: 004
Create Date: 2025-12-03

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status column to cases table with default value 'completed' for existing rows
    op.add_column("cases", sa.Column("status", sa.String(length=20), nullable=True))

    # Set default for existing rows - treat them as completed since they have outputs
    op.execute("UPDATE cases SET status = 'completed' WHERE status IS NULL")

    # Create index on status for faster filtering
    op.create_index(op.f("ix_cases_status"), "cases", ["status"], unique=False)


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f("ix_cases_status"), table_name="cases")

    # Drop status column
    op.drop_column("cases", "status")
