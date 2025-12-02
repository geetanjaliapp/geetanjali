"""Verse, Commentary, and Translation models."""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import relationship
import uuid

from models.base import Base, TimestampMixin


class Verse(Base, TimestampMixin):
    """Bhagavad Gita verse model."""

    __tablename__ = "verses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    canonical_id = Column(String(20), unique=True, nullable=False, index=True)
    chapter = Column(Integer, CheckConstraint("chapter >= 1 AND chapter <= 18"), nullable=False, index=True)
    verse = Column(Integer, CheckConstraint("verse >= 1"), nullable=False)
    sanskrit_iast = Column(Text)
    sanskrit_devanagari = Column(Text)
    translation_en = Column(Text)  # Primary English translation (from source)
    paraphrase_en = Column(Text)  # LLM-generated leadership summary
    consulting_principles = Column(JSON)  # Array of principle tags
    source = Column(String(255))
    license = Column(String(100))

    # Relationships
    commentaries = relationship("Commentary", back_populates="verse", cascade="all, delete-orphan")
    translations = relationship("Translation", back_populates="verse", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("chapter >= 1 AND chapter <= 18", name="check_chapter_range"),
        CheckConstraint("verse >= 1", name="check_verse_positive"),
    )

    def __repr__(self) -> str:
        return f"<Verse(canonical_id={self.canonical_id}, chapter={self.chapter}, verse={self.verse})>"


class Commentary(Base, TimestampMixin):
    """Commentary model for verse interpretations."""

    __tablename__ = "commentaries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    verse_id = Column(String(36), ForeignKey("verses.id", ondelete="CASCADE"), index=True)
    text = Column(Text, nullable=False)
    author = Column(String(255), index=True)
    school = Column(String(100), index=True)  # e.g., 'Advaita Vedanta'
    translator = Column(String(255))
    source = Column(String(255))
    license = Column(String(100))
    language = Column(String(10), default="en")

    # Relationships
    verse = relationship("Verse", back_populates="commentaries")

    def __repr__(self) -> str:
        return f"<Commentary(id={self.id}, author={self.author}, school={self.school})>"


class Translation(Base, TimestampMixin):
    """Translation model for verse translations."""

    __tablename__ = "translations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    verse_id = Column(String(36), ForeignKey("verses.id", ondelete="CASCADE"), index=True)
    text = Column(Text, nullable=False)
    language = Column(String(10), default="en", index=True)
    translator = Column(String(255), index=True)
    school = Column(String(100))
    source = Column(String(255))
    license = Column(String(100))
    year = Column(Integer)

    # Relationships
    verse = relationship("Verse", back_populates="translations")

    def __repr__(self) -> str:
        return f"<Translation(id={self.id}, translator={self.translator}, language={self.language})>"
