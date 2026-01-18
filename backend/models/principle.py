"""Principle and PrincipleGroup models for taxonomy.

Principles are the 16 consulting principles from the Bhagavad Gita taxonomy.
Groups are the 4 yoga paths that organize the principles.

Data is maintained in code (config/principle_taxonomy.json, config/principle_groups.json)
and synced to DB via StartupSyncService. API and SEO read from DB.
"""

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, TimestampMixin


class PrincipleGroup(Base, TimestampMixin):
    """
    Yoga path grouping for principles.

    4 groups: karma, jnana, bhakti, sadachara
    Each organizes related principles by yoga path.
    """

    __tablename__ = "principle_groups"

    # Natural primary key - group ID (e.g., "karma", "jnana")
    id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Display info
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    sanskrit: Mapped[str] = mapped_column(String(100), nullable=False)
    transliteration: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Display order (1-4)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationship to principles
    principles: Mapped[list["Principle"]] = relationship(
        "Principle", back_populates="group_rel", order_by="Principle.display_order"
    )

    def __repr__(self) -> str:
        return f"<PrincipleGroup(id={self.id}, label={self.label})>"


class Principle(Base, TimestampMixin):
    """
    Consulting principle from the Bhagavad Gita.

    16 principles organized into 4 yoga groups.
    Used for verse tagging, search, and topic pages.

    Fields are synced from config/principle_taxonomy.json.
    Extended content fields support SEO topic pages.
    """

    __tablename__ = "principles"

    # Natural primary key - principle ID (e.g., "dharma", "nishkama_karma")
    id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Basic info (existing taxonomy fields)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    short_label: Mapped[str] = mapped_column(String(50), nullable=False)
    sanskrit: Mapped[str] = mapped_column(String(100), nullable=False)
    transliteration: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    leadership_context: Mapped[str] = mapped_column(Text, nullable=False)

    # Categorization
    group_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("principle_groups.id"), nullable=False, index=True
    )
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    chapter_focus: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)

    # Display order within group (1-4)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Extended content for SEO topic pages (NEW - Sprint 2)
    extended_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    practical_application: Mapped[str | None] = mapped_column(Text, nullable=True)
    common_misconceptions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # FAQ for rich snippets
    faq_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    faq_answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Related principles (IDs) for internal linking
    related_principles: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )

    # Relationship
    group_rel: Mapped["PrincipleGroup"] = relationship(
        "PrincipleGroup", back_populates="principles"
    )

    def __repr__(self) -> str:
        return f"<Principle(id={self.id}, label={self.label}, group={self.group_id})>"

    @property
    def has_extended_content(self) -> bool:
        """Check if principle has extended SEO content."""
        return bool(self.extended_description or self.practical_application)
