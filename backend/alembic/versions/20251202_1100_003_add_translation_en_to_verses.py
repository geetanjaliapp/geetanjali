"""add_translation_en_to_verses

Revision ID: 003
Revises: 7b29fef038de
Create Date: 2025-12-02 11:00:00.000000+00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "003"
down_revision = "7b29fef038de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add translation_en column to verses table
    # This stores the primary/default English translation for quick display
    # Full translations with metadata are stored in the translations table
    op.add_column("verses", sa.Column("translation_en", sa.Text(), nullable=True))


def downgrade() -> None:
    # Drop translation_en column
    op.drop_column("verses", "translation_en")
