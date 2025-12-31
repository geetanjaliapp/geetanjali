"""Sync hash model for tracking curated content changes.

This model stores hashes of curated content source data to detect
when content has changed and needs to be re-synced to the database.
"""

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class SyncHash(Base):
    """
    Stores hashes of curated content for change detection.

    On startup, the app computes a hash of each content source and compares
    it with the stored hash. If different, the content is synced and the
    hash is updated.

    Attributes:
        content_type: Unique identifier for the content type
            - "book_metadata": Book cover metadata
            - "chapter_metadata": Chapter intro metadata
            - "dhyanam_verses": Geeta Dhyanam invocation verses
            - "featured_verses": Featured verse IDs list
            - "audio_metadata": Verse audio/TTS metadata
        content_hash: SHA256 hash of the source data (JSON serialized)
        synced_at: When the content was last synced
        created_at: When the hash record was created
    """

    __tablename__ = "sync_hashes"

    content_type: Mapped[str] = mapped_column(String(50), primary_key=True)
    content_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<SyncHash(content_type={self.content_type}, hash={self.content_hash[:8]}...)>"
