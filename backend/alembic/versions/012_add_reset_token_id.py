"""Add indexed reset_token_id for O(1) password reset lookup

Revision ID: 012
Revises: 011
Create Date: 2025-12-20

Security fix: Previous implementation iterated all users with reset tokens (O(n)).
Now uses indexed token_id for O(1) lookup, with bcrypt verification for defense in depth.

Adds:
- reset_token_id: SHA-256 hash of token prefix (indexed for O(1) lookup)
"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add indexed reset_token_id column for O(1) lookup
    op.add_column(
        "users",
        sa.Column("reset_token_id", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_users_reset_token_id",
        "users",
        ["reset_token_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_reset_token_id", table_name="users")
    op.drop_column("users", "reset_token_id")
