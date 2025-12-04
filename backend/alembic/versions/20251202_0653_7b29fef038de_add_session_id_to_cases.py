"""add_session_id_to_cases

Revision ID: 7b29fef038de
Revises: 002
Create Date: 2025-12-02 06:53:29.342093+00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7b29fef038de"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add session_id column to cases table
    op.add_column(
        "cases", sa.Column("session_id", sa.String(length=255), nullable=True)
    )

    # Create index on session_id for faster lookups
    op.create_index(op.f("ix_cases_session_id"), "cases", ["session_id"], unique=False)


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f("ix_cases_session_id"), table_name="cases")

    # Drop session_id column
    op.drop_column("cases", "session_id")
