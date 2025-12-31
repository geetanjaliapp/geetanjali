"""Verse, Commentary, and Translation models for Bhagavad Geeta scripture."""

import uuid
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class Verse(Base, TimestampMixin):
    """Bhagavad Geeta verse model."""

    __tablename__ = "verses"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    canonical_id: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    chapter: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint("chapter >= 1 AND chapter <= 18"),
        nullable=False,
        index=True,
    )
    verse: Mapped[int] = mapped_column(
        Integer, CheckConstraint("verse >= 1"), nullable=False
    )

    # Sanskrit text
    sanskrit_iast: Mapped[str | None] = mapped_column(Text, nullable=True)
    sanskrit_devanagari: Mapped[str | None] = mapped_column(Text, nullable=True)

    # English content
    translation_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    paraphrase_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    consulting_principles: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    commentaries = relationship(
        "Commentary", back_populates="verse", cascade="all, delete-orphan"
    )
    translations = relationship(
        "Translation", back_populates="verse", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("chapter >= 1 AND chapter <= 18", name="check_chapter_range"),
        CheckConstraint("verse >= 1", name="check_verse_positive"),
    )

    def __repr__(self) -> str:
        return f"<Verse(canonical_id={self.canonical_id}, chapter={self.chapter}, verse={self.verse})>"


class Commentary(Base, TimestampMixin):
    """Commentary model for verse interpretations by scholars."""

    __tablename__ = "commentaries"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    verse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("verses.id", ondelete="CASCADE"), index=True
    )

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en")

    # Attribution
    author: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    school: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    translator: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    verse = relationship("Verse", back_populates="commentaries")

    def __repr__(self) -> str:
        return f"<Commentary(id={self.id}, author={self.author}, school={self.school})>"


class Translation(Base, TimestampMixin):
    """Translation model for verse translations."""

    __tablename__ = "translations"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    verse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("verses.id", ondelete="CASCADE"), index=True
    )

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", index=True)

    # Attribution
    translator: Mapped[str | None] = mapped_column(
        String(255), index=True, nullable=True
    )
    school: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license: Mapped[str | None] = mapped_column(String(100), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    verse = relationship("Verse", back_populates="translations")

    def __repr__(self) -> str:
        return f"<Translation(id={self.id}, translator={self.translator}, language={self.language})>"
