"""Add multipass_comparisons table for Phase 3 comparison mode.

Revision ID: 027_add_comparison
Revises: 026_add_multipass
Create Date: 2026-01-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create multipass_comparisons table for Phase 3 comparison data collection."""
    op.create_table(
        "multipass_comparisons",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "case_id",
            sa.String(36),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Which pipeline was used for user response
        sa.Column("primary_pipeline", sa.String(20), nullable=False),
        # Multi-pass results
        sa.Column(
            "multipass_consultation_id",
            sa.String(36),
            sa.ForeignKey("multipass_consultations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("multipass_success", sa.Boolean, default=False),
        sa.Column("multipass_confidence", sa.Float, nullable=True),
        sa.Column("multipass_scholar_flag", sa.Boolean, nullable=True),
        sa.Column("multipass_duration_ms", sa.Integer, nullable=True),
        sa.Column("multipass_result_json", sa.JSON, nullable=True),
        sa.Column("multipass_error", sa.Text, nullable=True),
        # Single-pass results
        sa.Column("singlepass_success", sa.Boolean, default=False),
        sa.Column("singlepass_confidence", sa.Float, nullable=True),
        sa.Column("singlepass_scholar_flag", sa.Boolean, nullable=True),
        sa.Column("singlepass_duration_ms", sa.Integer, nullable=True),
        sa.Column("singlepass_result_json", sa.JSON, nullable=True),
        sa.Column("singlepass_error", sa.Text, nullable=True),
        # Quality comparison metrics
        sa.Column("confidence_diff", sa.Float, nullable=True),
        sa.Column("duration_diff_ms", sa.Integer, nullable=True),
        # Manual review fields
        sa.Column("reviewed", sa.Boolean, default=False, index=True),
        sa.Column("reviewer_preference", sa.String(20), nullable=True),
        sa.Column("reviewer_notes", sa.Text, nullable=True),
        sa.Column("reviewed_at", sa.DateTime, nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
            index=True,
        ),
    )


def downgrade() -> None:
    """Drop multipass_comparisons table."""
    op.drop_table("multipass_comparisons")
