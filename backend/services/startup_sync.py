"""Startup synchronization service for curated content.

This module handles automatic sync of all curated content on application startup.
It uses hash-based change detection to only sync content when the source has changed.

Content sync order (respects dependencies):
1. Book/Chapter Metadata - independent, required for Reading Mode
2. Dhyanam Verses - independent, required for Dhyanam feature
3. Featured Verse Flags - requires verses to exist
4. Verse Audio Metadata - requires verses to exist, for TTS

Hash-based change detection:
- Computes SHA256 hash of each content source
- Compares with stored hash in sync_hashes table
- Only syncs if hash differs or no hash exists
- Updates hash after successful sync
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, NamedTuple

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class SyncResult(NamedTuple):
    """Result of a sync operation."""

    name: str
    action: str  # "synced", "skipped_no_change", "skipped_no_data", "error"
    reason: str
    synced: int = 0
    created: int = 0
    updated: int = 0


def compute_content_hash(data: Any) -> str:
    """
    Compute SHA256 hash of content data.

    Args:
        data: Any JSON-serializable data structure

    Returns:
        64-character hex string (SHA256 hash)
    """
    # Serialize to JSON with sorted keys for consistent hashing
    json_str = json.dumps(data, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()


class StartupSyncService:
    """
    Service for syncing curated content on startup.

    Uses hash-based change detection to only sync when content has changed.
    Ensures all code-first curated content is synced to the database.
    """

    def __init__(self, db: Session):
        self.db = db
        self.results: list[SyncResult] = []

    def sync_all(self) -> list[SyncResult]:
        """
        Sync all curated content to database.

        Runs all sync operations in order, respecting dependencies.
        Only syncs content that has changed (based on hash comparison).

        Returns:
            List of SyncResult objects describing what was synced
        """
        logger.info("=" * 60)
        logger.info("STARTUP SYNC: Checking curated content")
        logger.info("=" * 60)

        # Independent content (no dependencies)
        self._sync_book_metadata()
        self._sync_chapter_metadata()
        self._sync_dhyanam_verses()

        # Dependent content (requires verses)
        self._sync_featured_verses()
        self._sync_audio_metadata()

        # Log summary
        self._log_summary()

        return self.results

    def _get_stored_hash(self, content_type: str) -> str | None:
        """Get stored hash for a content type, or None if not exists."""
        from models import SyncHash

        record = (
            self.db.query(SyncHash)
            .filter(SyncHash.content_type == content_type)
            .first()
        )
        return record.content_hash if record else None

    def _update_stored_hash(self, content_type: str, content_hash: str) -> None:
        """Update or create stored hash for a content type."""
        from models import SyncHash

        record = (
            self.db.query(SyncHash)
            .filter(SyncHash.content_type == content_type)
            .first()
        )

        if record:
            record.content_hash = content_hash
            record.synced_at = datetime.utcnow()
        else:
            record = SyncHash(
                content_type=content_type,
                content_hash=content_hash,
                synced_at=datetime.utcnow(),
            )
            self.db.add(record)

        self.db.commit()

    def _needs_sync(self, content_type: str, current_hash: str) -> bool:
        """Check if content needs sync by comparing hashes."""
        stored_hash = self._get_stored_hash(content_type)

        if stored_hash is None:
            logger.debug(f"{content_type}: No stored hash, sync needed")
            return True

        if stored_hash != current_hash:
            logger.debug(f"{content_type}: Hash changed, sync needed")
            logger.debug(f"  Stored: {stored_hash[:16]}...")
            logger.debug(f"  Current: {current_hash[:16]}...")
            return True

        logger.debug(f"{content_type}: Hash unchanged, skip sync")
        return False

    def _sync_book_metadata(self) -> None:
        """Sync book metadata if changed."""
        from data.chapter_metadata import get_book_metadata

        content_type = "book_metadata"
        source_data = get_book_metadata()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            self.results.append(
                SyncResult(
                    name="Book Metadata",
                    action="skipped_no_change",
                    reason="Content unchanged",
                )
            )
            return

        # Sync needed
        from api.admin import sync_metadata

        stats = sync_metadata(self.db)
        self._update_stored_hash(content_type, current_hash)

        self.results.append(
            SyncResult(
                name="Book Metadata",
                action="synced",
                reason="Content changed or first sync",
                synced=1 if stats["book_synced"] else 0,
                created=1 if stats["book_synced"] else 0,
            )
        )

    def _sync_chapter_metadata(self) -> None:
        """Sync chapter metadata if changed."""
        from data.chapter_metadata import get_all_chapter_metadata

        content_type = "chapter_metadata"
        source_data = get_all_chapter_metadata()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            self.results.append(
                SyncResult(
                    name="Chapter Metadata",
                    action="skipped_no_change",
                    reason="Content unchanged",
                )
            )
            return

        # Sync needed - sync_metadata handles both book and chapters
        from api.admin import sync_metadata

        stats = sync_metadata(self.db)
        self._update_stored_hash(content_type, current_hash)

        self.results.append(
            SyncResult(
                name="Chapter Metadata",
                action="synced",
                reason="Content changed or first sync",
                synced=stats["chapters_synced"],
            )
        )

    def _sync_dhyanam_verses(self) -> None:
        """Sync Geeta Dhyanam verses if changed."""
        from data.geeta_dhyanam import get_geeta_dhyanam

        content_type = "dhyanam_verses"
        source_data = get_geeta_dhyanam()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            self.results.append(
                SyncResult(
                    name="Dhyanam Verses",
                    action="skipped_no_change",
                    reason="Content unchanged",
                )
            )
            return

        # Sync needed
        from api.admin import sync_geeta_dhyanam

        stats = sync_geeta_dhyanam(self.db)
        self._update_stored_hash(content_type, current_hash)

        self.results.append(
            SyncResult(
                name="Dhyanam Verses",
                action="synced",
                reason="Content changed or first sync",
                synced=stats["synced"],
                created=stats["created"],
                updated=stats["updated"],
            )
        )

    def _sync_featured_verses(self) -> None:
        """Sync featured verse flags if changed."""
        from data.featured_verses import get_featured_verse_ids
        from models import Verse

        # Check if verses exist at all
        verse_count = self.db.query(Verse).count()
        if verse_count == 0:
            self.results.append(
                SyncResult(
                    name="Featured Verses",
                    action="skipped_no_data",
                    reason="No verses in DB (run ingestion first)",
                )
            )
            return

        content_type = "featured_verses"
        source_data = get_featured_verse_ids()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            self.results.append(
                SyncResult(
                    name="Featured Verses",
                    action="skipped_no_change",
                    reason="Content unchanged",
                )
            )
            return

        # Sync needed
        from api.admin import sync_featured_verses

        stats = sync_featured_verses(self.db)
        self._update_stored_hash(content_type, current_hash)

        self.results.append(
            SyncResult(
                name="Featured Verses",
                action="synced",
                reason="Content changed or first sync",
                synced=stats["synced"],
            )
        )

    def _sync_audio_metadata(self) -> None:
        """Sync verse audio metadata if changed."""
        from models import Verse

        # Check if verses exist at all
        verse_count = self.db.query(Verse).count()
        if verse_count == 0:
            self.results.append(
                SyncResult(
                    name="Audio Metadata",
                    action="skipped_no_data",
                    reason="No verses in DB (run ingestion first)",
                )
            )
            return

        # For audio metadata, compute hash from the entire metadata module
        # This covers all per-verse and per-chapter metadata
        from data.verse_audio_metadata import get_all_metadata

        content_type = "audio_metadata"
        source_data = get_all_metadata()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            self.results.append(
                SyncResult(
                    name="Audio Metadata",
                    action="skipped_no_change",
                    reason="Content unchanged",
                )
            )
            return

        # Sync needed
        from api.admin import sync_verse_audio_metadata

        stats = sync_verse_audio_metadata(self.db)
        self._update_stored_hash(content_type, current_hash)

        self.results.append(
            SyncResult(
                name="Audio Metadata",
                action="synced",
                reason="Content changed or first sync",
                synced=stats["synced"],
                created=stats["created"],
                updated=stats["updated"],
            )
        )

    def _log_summary(self) -> None:
        """Log summary of sync operations."""
        synced_items = [r for r in self.results if r.action == "synced"]
        skipped_unchanged = [r for r in self.results if r.action == "skipped_no_change"]
        skipped_no_data = [r for r in self.results if r.action == "skipped_no_data"]

        if synced_items:
            logger.info(f"STARTUP SYNC: Synced {len(synced_items)} content types:")
            for result in synced_items:
                details = []
                if result.created:
                    details.append(f"created={result.created}")
                if result.updated:
                    details.append(f"updated={result.updated}")
                if result.synced and not details:
                    details.append(f"synced={result.synced}")
                detail_str = f" ({', '.join(details)})" if details else ""
                logger.info(f"  + {result.name}{detail_str}")

        if skipped_unchanged:
            logger.info(
                f"STARTUP SYNC: {len(skipped_unchanged)} content types unchanged"
            )
            for result in skipped_unchanged:
                logger.debug(f"  - {result.name}: {result.reason}")

        if skipped_no_data:
            logger.warning(
                f"STARTUP SYNC: {len(skipped_no_data)} content types skipped (missing dependencies):"
            )
            for result in skipped_no_data:
                logger.warning(f"  ! {result.name}: {result.reason}")

        if not synced_items and not skipped_no_data:
            logger.info("STARTUP SYNC: All curated content up to date")

        logger.info("=" * 60)


def run_startup_sync() -> list[SyncResult]:
    """
    Run startup sync in a new database session.

    This is the main entry point for startup sync, meant to be called
    from the application lifespan handler.

    Returns:
        List of SyncResult objects
    """
    from db.connection import SessionLocal

    db = SessionLocal()
    try:
        service = StartupSyncService(db)
        return service.sync_all()
    except Exception as e:
        logger.error(f"STARTUP SYNC FAILED: {e}", exc_info=True)
        return []
    finally:
        db.close()
