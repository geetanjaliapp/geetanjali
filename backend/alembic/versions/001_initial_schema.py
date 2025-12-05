"""Initial schema for Geetanjali v1.0.0

Revision ID: 001
Revises:
Create Date: 2025-12-04

Tables:
- users: User accounts and authentication
- refresh_tokens: JWT refresh token storage
- verses: Bhagavad Geeta verses
- commentaries: Verse commentaries by scholars
- translations: Verse translations
- cases: Ethical dilemma consultations
- outputs: LLM-generated consultation results
- messages: Conversation threading for cases
- feedback: User ratings on outputs
- contact_messages: Contact form submissions
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =========================================================================
    # USERS - Authentication and authorization
    # =========================================================================
    op.create_table(
        "users",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        # Authentication
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        # Authorization
        sa.Column("role", sa.String(100), server_default="user"),
        sa.Column("org_id", sa.String(100), nullable=True),
        sa.Column("api_key", sa.String(255), nullable=True, unique=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_api_key", "users", ["api_key"])

    # =========================================================================
    # REFRESH_TOKENS - JWT token rotation
    # =========================================================================
    op.create_table(
        "refresh_tokens",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Token data
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])
    op.create_index("ix_refresh_tokens_revoked", "refresh_tokens", ["revoked"])

    # =========================================================================
    # VERSES - Bhagavad Geeta scripture
    # =========================================================================
    op.create_table(
        "verses",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("canonical_id", sa.String(20), nullable=False, unique=True),
        sa.Column("chapter", sa.Integer(), nullable=False),
        sa.Column("verse", sa.Integer(), nullable=False),
        # Sanskrit text
        sa.Column("sanskrit_iast", sa.Text(), nullable=True),
        sa.Column("sanskrit_devanagari", sa.Text(), nullable=True),
        # English content
        sa.Column("translation_en", sa.Text(), nullable=True),
        sa.Column("paraphrase_en", sa.Text(), nullable=True),
        # Metadata
        sa.Column("consulting_principles", sa.JSON(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("license", sa.String(100), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        # Constraints
        sa.CheckConstraint("chapter >= 1 AND chapter <= 18", name="check_chapter_range"),
        sa.CheckConstraint("verse >= 1", name="check_verse_positive"),
    )
    op.create_index("ix_verses_canonical_id", "verses", ["canonical_id"])
    op.create_index("ix_verses_chapter", "verses", ["chapter"])
    op.create_index("ix_verses_is_featured", "verses", ["is_featured"])

    # =========================================================================
    # COMMENTARIES - Scholar interpretations
    # =========================================================================
    op.create_table(
        "commentaries",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("verse_id", sa.String(36), sa.ForeignKey("verses.id", ondelete="CASCADE"), nullable=False),
        # Content
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("language", sa.String(10), server_default="en"),
        # Attribution
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("school", sa.String(100), nullable=True),
        sa.Column("translator", sa.String(255), nullable=True),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("license", sa.String(100), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_commentaries_verse_id", "commentaries", ["verse_id"])
    op.create_index("ix_commentaries_author", "commentaries", ["author"])
    op.create_index("ix_commentaries_school", "commentaries", ["school"])

    # =========================================================================
    # TRANSLATIONS - Verse translations
    # =========================================================================
    op.create_table(
        "translations",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("verse_id", sa.String(36), sa.ForeignKey("verses.id", ondelete="CASCADE"), nullable=False),
        # Content
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("language", sa.String(10), server_default="en"),
        # Attribution
        sa.Column("translator", sa.String(255), nullable=True),
        sa.Column("school", sa.String(100), nullable=True),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("license", sa.String(100), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_translations_verse_id", "translations", ["verse_id"])
    op.create_index("ix_translations_language", "translations", ["language"])
    op.create_index("ix_translations_translator", "translations", ["translator"])

    # =========================================================================
    # CASES - Ethical dilemma consultations
    # =========================================================================
    op.create_table(
        "cases",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("session_id", sa.String(255), nullable=True),
        # Content
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("role", sa.String(100), nullable=True),
        sa.Column("stakeholders", sa.JSON(), nullable=True),
        sa.Column("constraints", sa.JSON(), nullable=True),
        sa.Column("horizon", sa.String(50), nullable=True),
        sa.Column("sensitivity", sa.String(50), server_default="low"),
        sa.Column("attachments", sa.JSON(), nullable=True),
        sa.Column("locale", sa.String(10), server_default="en"),
        # Status
        sa.Column("status", sa.String(20), server_default="draft"),
        # Sharing
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("public_slug", sa.String(12), nullable=True, unique=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_cases_user_id", "cases", ["user_id"])
    op.create_index("ix_cases_session_id", "cases", ["session_id"])
    op.create_index("ix_cases_status", "cases", ["status"])
    op.create_index("ix_cases_sensitivity", "cases", ["sensitivity"])
    op.create_index("ix_cases_is_public", "cases", ["is_public"])
    op.create_index("ix_cases_public_slug", "cases", ["public_slug"])
    op.create_index("ix_cases_is_deleted", "cases", ["is_deleted"])

    # =========================================================================
    # OUTPUTS - LLM consultation results
    # =========================================================================
    op.create_table(
        "outputs",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("case_id", sa.String(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        # Content
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("executive_summary", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        # Review
        sa.Column("scholar_flag", sa.Boolean(), server_default="false"),
        sa.Column("reviewed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_outputs_case_id", "outputs", ["case_id"])
    op.create_index("ix_outputs_created_at", "outputs", ["created_at"])
    op.create_index("ix_outputs_scholar_flag", "outputs", ["scholar_flag"])
    op.create_index("ix_outputs_confidence", "outputs", ["confidence"])

    # =========================================================================
    # MESSAGES - Conversation threading
    # =========================================================================
    # Create messagerole enum if it doesn't exist
    op.execute("CREATE TYPE IF NOT EXISTS messagerole AS ENUM ('user', 'assistant')")

    op.create_table(
        "messages",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("case_id", sa.String(36), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        # Content
        sa.Column("role", sa.Enum("user", "assistant", name="messagerole", create_type=False), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("output_id", sa.String(36), sa.ForeignKey("outputs.id", ondelete="SET NULL"), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_messages_case_id", "messages", ["case_id"])
    op.create_index("ix_messages_role", "messages", ["role"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])

    # =========================================================================
    # FEEDBACK - User ratings on outputs
    # =========================================================================
    op.create_table(
        "feedback",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("output_id", sa.String(36), sa.ForeignKey("outputs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=True),
        # Content
        sa.Column("rating", sa.Boolean(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_feedback_output_id", "feedback", ["output_id"])
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])
    op.create_index("ix_feedback_session_id", "feedback", ["session_id"])
    op.create_index("ix_feedback_created_at", "feedback", ["created_at"])

    # =========================================================================
    # CONTACT_MESSAGES - Contact form submissions
    # =========================================================================
    # Create contacttype enum if it doesn't exist
    op.execute("CREATE TYPE IF NOT EXISTS contacttype AS ENUM ('feedback', 'question', 'bug_report', 'feature_request', 'other')")

    op.create_table(
        "contact_messages",
        # Identity
        sa.Column("id", sa.String(36), primary_key=True),
        # Sender
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        # Content
        sa.Column("message_type", sa.Enum("feedback", "question", "bug_report", "feature_request", "other", name="contacttype", create_type=False), nullable=False),
        sa.Column("subject", sa.String(200), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        # Status
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default="false"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_contact_messages_created_at", "contact_messages", ["created_at"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("contact_messages")
    op.drop_table("feedback")
    op.drop_table("messages")
    op.drop_table("outputs")
    op.drop_table("cases")
    op.drop_table("translations")
    op.drop_table("commentaries")
    op.drop_table("verses")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS messagerole")
    op.execute("DROP TYPE IF EXISTS contacttype")
