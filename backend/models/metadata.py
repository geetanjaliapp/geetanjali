"""Book and Chapter metadata models for Reading Mode."""

import uuid
from typing import Any

from sqlalchemy import JSON, CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin


class BookMetadata(Base, TimestampMixin):
    """
    Book-level metadata for the Bhagavad Geeta.

    Stores the cover page content: title, tagline, intro text.
    This table should have exactly one row for the Geeta.
    """

    __tablename__ = "book_metadata"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    book_key: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )  # e.g., "bhagavad_geeta"

    # Title variants
    sanskrit_title: Mapped[str] = mapped_column(String(200), nullable=False)
    transliteration: Mapped[str] = mapped_column(String(200), nullable=False)
    english_title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Display content
    tagline: Mapped[str] = mapped_column(String(500), nullable=False)
    intro_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Stats
    verse_count: Mapped[int] = mapped_column(Integer, nullable=False, default=700)
    chapter_count: Mapped[int] = mapped_column(Integer, nullable=False, default=18)

    def __repr__(self) -> str:
        return f"<BookMetadata(key={self.book_key}, title={self.english_title})>"


class ChapterMetadata(Base, TimestampMixin):
    """
    Chapter-level metadata for Reading Mode.

    Stores intro content for each of the 18 chapters:
    Sanskrit name, English title, summary, themes.
    """

    __tablename__ = "chapter_metadata"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chapter_number: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint("chapter_number >= 1 AND chapter_number <= 18"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Name variants
    sanskrit_name: Mapped[str] = mapped_column(String(200), nullable=False)
    transliteration: Mapped[str] = mapped_column(String(200), nullable=False)
    english_title: Mapped[str] = mapped_column(String(300), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Content
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Stats and metadata
    verse_count: Mapped[int] = mapped_column(Integer, nullable=False)
    key_themes: Mapped[Any | None] = mapped_column(
        JSON, nullable=True
    )  # List of theme strings

    __table_args__ = (
        CheckConstraint(
            "chapter_number >= 1 AND chapter_number <= 18",
            name="check_chapter_number_range",
        ),
    )

    def __repr__(self) -> str:
        return f"<ChapterMetadata(chapter={self.chapter_number}, title={self.english_title})>"
