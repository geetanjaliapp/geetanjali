"""Geeta Dhyanam verse model for Reading Mode.

The 9 invocation verses traditionally recited before studying the Bhagavad Geeta.
These are synced from data/geeta_dhyanam.py via POST /api/v1/admin/sync-dhyanam.
"""

import uuid

from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin


class DhyanamVerse(Base, TimestampMixin):
    """
    Geeta Dhyanam verse model.

    Stores the 9 sacred invocation verses with multilingual content
    and audio metadata for the Reading Mode experience.
    """

    __tablename__ = "dhyanam_verses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    verse_number: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        nullable=False,
        index=True,
    )

    # Multilingual content
    sanskrit: Mapped[str] = mapped_column(Text, nullable=False)
    iast: Mapped[str] = mapped_column(Text, nullable=False)
    english: Mapped[str] = mapped_column(Text, nullable=False)
    hindi: Mapped[str] = mapped_column(Text, nullable=False)

    # Metadata
    theme: Mapped[str] = mapped_column(String(255), nullable=False)

    # Audio
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    audio_url: Mapped[str] = mapped_column(String(255), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "verse_number >= 1 AND verse_number <= 9",
            name="check_dhyanam_verse_number_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<DhyanamVerse(verse_number={self.verse_number}, theme={self.theme})>"
