"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-11-30 18:20:00

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(100)),
        sa.Column("org_id", sa.String(100)),
        sa.Column("api_key", sa.String(255), unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_users_api_key", "users", ["api_key"])

    # Create verses table
    op.create_table(
        "verses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("canonical_id", sa.String(20), nullable=False, unique=True),
        sa.Column("chapter", sa.Integer(), nullable=False),
        sa.Column("verse", sa.Integer(), nullable=False),
        sa.Column("sanskrit_iast", sa.Text()),
        sa.Column("sanskrit_devanagari", sa.Text()),
        sa.Column("paraphrase_en", sa.Text()),
        sa.Column("consulting_principles", sa.JSON()),
        sa.Column("source", sa.String(255)),
        sa.Column("license", sa.String(100)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "chapter >= 1 AND chapter <= 18", name="check_chapter_range"
        ),
        sa.CheckConstraint("verse >= 1", name="check_verse_positive"),
    )
    op.create_index("idx_verses_canonical_id", "verses", ["canonical_id"])
    op.create_index("idx_verses_chapter", "verses", ["chapter"])

    # Create cases table
    op.create_table(
        "cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE")
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("role", sa.String(100)),
        sa.Column("stakeholders", sa.JSON()),
        sa.Column("constraints", sa.JSON()),
        sa.Column("horizon", sa.String(50)),
        sa.Column("sensitivity", sa.String(50), server_default="low"),
        sa.Column("attachments", sa.JSON()),
        sa.Column("locale", sa.String(10), server_default="en"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_cases_user_id", "cases", ["user_id"])
    op.create_index("idx_cases_sensitivity", "cases", ["sensitivity"])

    # Create outputs table
    op.create_table(
        "outputs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "case_id", sa.String(36), sa.ForeignKey("cases.id", ondelete="CASCADE")
        ),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("executive_summary", sa.Text()),
        sa.Column("confidence", sa.Float()),
        sa.Column("scholar_flag", sa.Boolean(), server_default="0"),
        sa.Column("reviewed_by", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_outputs_case_id", "outputs", ["case_id"])
    op.create_index("idx_outputs_scholar_flag", "outputs", ["scholar_flag"])
    op.create_index("idx_outputs_confidence", "outputs", ["confidence"])

    # Create commentaries table
    op.create_table(
        "commentaries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "verse_id", sa.String(36), sa.ForeignKey("verses.id", ondelete="CASCADE")
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author", sa.String(255)),
        sa.Column("school", sa.String(100)),
        sa.Column("translator", sa.String(255)),
        sa.Column("source", sa.String(255)),
        sa.Column("license", sa.String(100)),
        sa.Column("language", sa.String(10), server_default="en"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_commentaries_verse_id", "commentaries", ["verse_id"])
    op.create_index("idx_commentaries_author", "commentaries", ["author"])
    op.create_index("idx_commentaries_school", "commentaries", ["school"])

    # Create translations table
    op.create_table(
        "translations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "verse_id", sa.String(36), sa.ForeignKey("verses.id", ondelete="CASCADE")
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("language", sa.String(10), server_default="en"),
        sa.Column("translator", sa.String(255)),
        sa.Column("school", sa.String(100)),
        sa.Column("source", sa.String(255)),
        sa.Column("license", sa.String(100)),
        sa.Column("year", sa.Integer()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("idx_translations_verse_id", "translations", ["verse_id"])
    op.create_index("idx_translations_translator", "translations", ["translator"])
    op.create_index("idx_translations_language", "translations", ["language"])


def downgrade() -> None:
    op.drop_table("translations")
    op.drop_table("commentaries")
    op.drop_table("outputs")
    op.drop_table("cases")
    op.drop_table("verses")
    op.drop_table("users")
