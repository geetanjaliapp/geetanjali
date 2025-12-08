"""Add password reset fields to users table

Revision ID: 002
Revises: 001
Create Date: 2025-12-08

Adds:
- reset_token_hash: Hashed password reset token
- reset_token_expires: Token expiration timestamp
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add password reset columns to users table
    op.add_column(
        "users",
        sa.Column("reset_token_hash", sa.String(255), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("reset_token_expires", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "reset_token_expires")
    op.drop_column("users", "reset_token_hash")
