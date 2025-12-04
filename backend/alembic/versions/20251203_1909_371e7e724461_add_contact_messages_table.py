"""add contact_messages table

Revision ID: 371e7e724461
Revises: 006_add_feedback
Create Date: 2025-12-03 19:09:47.043981+00:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "371e7e724461"
down_revision = "006_add_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create contact_messages table
    op.create_table(
        "contact_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column(
            "message_type",
            sa.Enum(
                "feedback",
                "question",
                "bug_report",
                "feature_request",
                "other",
                name="contacttype",
            ),
            nullable=False,
        ),
        sa.Column("subject", sa.String(200), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, index=True),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index(
        "ix_contact_messages_created_at", "contact_messages", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_contact_messages_created_at", table_name="contact_messages")
    op.drop_table("contact_messages")
    op.execute("DROP TYPE IF EXISTS contacttype")
