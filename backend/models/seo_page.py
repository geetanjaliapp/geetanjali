"""SEO page tracking model.

This model tracks generated SEO static HTML pages and their content hashes
to support incremental regeneration when source data or templates change.
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin


class SeoPage(Base, TimestampMixin):
    """
    Tracks generated SEO pages and their content hashes.

    Each SEO page (verse, chapter, topic, etc.) is tracked with hashes of both
    its source data and template. When either changes, the page is regenerated.

    Attributes:
        page_key: Natural primary key identifying the page
            - Verses: "BG_2_47", "BG_18_66"
            - Chapters: "chapter_2", "chapter_18"
            - Topics: "topic_dharma", "topic_bhakti"
            - Static: "home", "about", "featured", "daily_verse"
        page_type: Category for filtering and metrics
            - "verse", "chapter", "topic", "featured", "home", "about", "daily"
        source_hash: SHA256 hash of source data (verse content, taxonomy, etc.)
        template_hash: SHA256 hash (first 16 chars) of template file
        generated_at: When this page was last generated
        file_path: Relative path within SEO output directory
        file_size_bytes: Generated file size for monitoring
        generation_ms: Time taken to generate for performance tracking
    """

    __tablename__ = "seo_pages"

    # Natural primary key - page_key is unique by design
    page_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    page_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    template_hash: Mapped[str] = mapped_column(String(16), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    file_path: Mapped[str] = mapped_column(String(200), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    generation_ms: Mapped[int] = mapped_column(Integer, nullable=True)

    # Index for filtering by page type (common query pattern)
    __table_args__ = (Index("ix_seo_pages_page_type", "page_type"),)

    def __repr__(self) -> str:
        return (
            f"<SeoPage(key={self.page_key}, type={self.page_type}, "
            f"hash={self.source_hash[:8]}...)>"
        )

    def needs_regeneration(self, new_source_hash: str, new_template_hash: str) -> bool:
        """Check if this page needs regeneration based on hash comparison."""
        return (
            self.source_hash != new_source_hash
            or self.template_hash != new_template_hash
        )
