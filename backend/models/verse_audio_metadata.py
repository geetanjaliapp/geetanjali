"""Verse Audio Metadata model for TTS generation configuration.

This model stores curated metadata for each verse to control how
the Text-to-Speech (Indic Parler-TTS) generates audio recitations.

The metadata includes:
- Speaker/addressee context (who is speaking to whom)
- Emotional tone and intensity for delivery
- Pacing guidance
- Theological weight classification
- Custom TTS description overrides
- Audio file references and generation tracking

This data survives verse re-ingestion since it's linked by canonical_id.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class VerseAudioMetadata(Base, TimestampMixin):
    """Audio generation metadata for a Bhagavad Geeta verse."""

    __tablename__ = "verse_audio_metadata"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Link to verse (survives re-ingestion via canonical_id)
    verse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("verses.id", ondelete="CASCADE"), index=True
    )
    canonical_id: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )

    # Speaker/Context
    speaker: Mapped[str] = mapped_column(String(20), nullable=False, default="krishna")
    addressee: Mapped[str] = mapped_column(String(20), default="arjuna")
    discourse_type: Mapped[str] = mapped_column(String(20), default="teaching")
    discourse_context: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Audio generation hints
    emotional_tone: Mapped[str] = mapped_column(String(20), default="neutral")
    intensity: Mapped[str] = mapped_column(String(20), default="moderate")
    pacing: Mapped[str] = mapped_column(String(20), default="moderate")

    # Classification
    theological_weight: Mapped[str] = mapped_column(
        String(20), default="standard", index=True
    )

    # Custom overrides
    tts_description_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audio file reference
    audio_file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    audio_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    audio_preset_used: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Audit
    curated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    curated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    verse = relationship("Verse", backref="audio_metadata")

    __table_args__ = (
        CheckConstraint(
            "speaker IN ('krishna', 'arjuna', 'sanjaya', 'dhritarashtra')",
            name="vam_valid_speaker",
        ),
        CheckConstraint(
            "addressee IN ('arjuna', 'krishna', 'dhritarashtra', 'sanjaya', 'assembly')",
            name="vam_valid_addressee",
        ),
        CheckConstraint(
            "discourse_type IN ('teaching', 'question', 'declaration', 'lament', "
            "'vision', 'prayer', 'narration')",
            name="vam_valid_discourse_type",
        ),
        CheckConstraint(
            "emotional_tone IN ('neutral', 'compassionate', 'authoritative', "
            "'sorrowful', 'fearful', 'joyful', 'awe', 'urgent')",
            name="vam_valid_emotional_tone",
        ),
        CheckConstraint(
            "intensity IN ('soft', 'moderate', 'strong', 'powerful')",
            name="vam_valid_intensity",
        ),
        CheckConstraint(
            "pacing IN ('slow', 'moderate', 'measured')",
            name="vam_valid_pacing",
        ),
        CheckConstraint(
            "theological_weight IN ('standard', 'key_teaching', 'maha_vakya')",
            name="vam_valid_theological_weight",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<VerseAudioMetadata(canonical_id={self.canonical_id}, "
            f"speaker={self.speaker}, tone={self.emotional_tone})>"
        )
