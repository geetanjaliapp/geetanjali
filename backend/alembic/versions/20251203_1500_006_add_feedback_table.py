"""Add feedback table for user ratings on outputs.

Revision ID: 006_add_feedback
Revises: 20251203_1341_005_add_status_to_cases
Create Date: 2025-12-03
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "006_add_feedback"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add feedback table for user ratings on consultation outputs."""
    op.create_table(
        "feedback",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "output_id",
            sa.String(36),
            sa.ForeignKey("outputs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("session_id", sa.String(36), nullable=True),
        sa.Column("rating", sa.Boolean, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # Create indexes
    op.create_index("ix_feedback_output_id", "feedback", ["output_id"])
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])
    op.create_index("ix_feedback_session_id", "feedback", ["session_id"])
    op.create_index("ix_feedback_created_at", "feedback", ["created_at"])


def downgrade() -> None:
    """Remove feedback table."""
    op.drop_index("ix_feedback_created_at", table_name="feedback")
    op.drop_index("ix_feedback_session_id", table_name="feedback")
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_index("ix_feedback_output_id", table_name="feedback")
    op.drop_table("feedback")
