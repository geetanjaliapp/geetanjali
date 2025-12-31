"""Add verse_audio_metadata table for TTS generation configuration

Revision ID: 022
Revises: 021
Create Date: 2025-12-28

This migration adds the verse_audio_metadata table which stores curated
metadata for each verse to control Text-to-Speech generation. The table
includes speaker context, emotional tone, pacing, and audio file tracking.

Key features:
- Links to verses via verse_id FK with CASCADE delete
- canonical_id for surviving re-ingestion
- Enum constraints for valid values
- Indexes for common queries
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent
    conn = op.get_bind()
    inspector = inspect(conn)

    if "verse_audio_metadata" not in inspector.get_table_names():
        op.create_table(
            "verse_audio_metadata",
            # Primary key
            sa.Column("id", sa.String(36), primary_key=True),
            # Link to verse
            sa.Column(
                "verse_id",
                sa.String(36),
                sa.ForeignKey("verses.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "canonical_id", sa.String(20), unique=True, nullable=False, index=True
            ),
            # Speaker/Context
            sa.Column(
                "speaker", sa.String(20), nullable=False, server_default="krishna"
            ),
            sa.Column("addressee", sa.String(20), server_default="arjuna"),
            sa.Column("discourse_type", sa.String(20), server_default="teaching"),
            sa.Column("discourse_context", sa.String(50), nullable=True),
            # Audio generation hints
            sa.Column("emotional_tone", sa.String(20), server_default="neutral"),
            sa.Column("intensity", sa.String(20), server_default="moderate"),
            sa.Column("pacing", sa.String(20), server_default="moderate"),
            # Classification
            sa.Column(
                "theological_weight",
                sa.String(20),
                server_default="standard",
                index=True,
            ),
            # Custom overrides
            sa.Column("tts_description_override", sa.Text(), nullable=True),
            sa.Column("context_notes", sa.Text(), nullable=True),
            # Audio file reference
            sa.Column("audio_file_path", sa.String(255), nullable=True),
            sa.Column("audio_duration_ms", sa.Integer(), nullable=True),
            sa.Column("audio_generated_at", sa.DateTime(), nullable=True),
            sa.Column("audio_preset_used", sa.String(50), nullable=True),
            # Audit
            sa.Column("curated_by", sa.String(100), nullable=True),
            sa.Column("curated_at", sa.DateTime(), nullable=True),
            # Timestamps
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
                onupdate=sa.func.now(),
            ),
            # Constraints
            sa.CheckConstraint(
                "speaker IN ('krishna', 'arjuna', 'sanjaya', 'dhritarashtra')",
                name="vam_valid_speaker",
            ),
            sa.CheckConstraint(
                "addressee IN ('arjuna', 'krishna', 'dhritarashtra', 'sanjaya', 'assembly')",
                name="vam_valid_addressee",
            ),
            sa.CheckConstraint(
                "discourse_type IN ('teaching', 'question', 'declaration', 'lament', "
                "'vision', 'prayer', 'narration')",
                name="vam_valid_discourse_type",
            ),
            sa.CheckConstraint(
                "emotional_tone IN ('neutral', 'compassionate', 'authoritative', "
                "'sorrowful', 'fearful', 'joyful', 'awe', 'urgent')",
                name="vam_valid_emotional_tone",
            ),
            sa.CheckConstraint(
                "intensity IN ('soft', 'moderate', 'strong', 'powerful')",
                name="vam_valid_intensity",
            ),
            sa.CheckConstraint(
                "pacing IN ('slow', 'moderate', 'measured')",
                name="vam_valid_pacing",
            ),
            sa.CheckConstraint(
                "theological_weight IN ('standard', 'key_teaching', 'maha_vakya')",
                name="vam_valid_theological_weight",
            ),
        )


def downgrade() -> None:
    op.drop_table("verse_audio_metadata")
