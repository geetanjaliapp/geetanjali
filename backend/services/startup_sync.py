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

Error Handling:
- Each content type is synced independently
- Failures in one type don't block others
- Errors are logged and tracked in results

Race Condition Mitigation:
- Uses DB-level upsert pattern (idempotent)
- Multiple instances syncing same content is safe (same result)
- Sync functions themselves are idempotent (upsert pattern)
"""

import hashlib
import json
import logging
import time
from collections.abc import Callable
from datetime import datetime
from typing import Any, NamedTuple

from sqlalchemy.orm import Session

from config import settings

logger = logging.getLogger(__name__)


class SyncResult(NamedTuple):
    """Result of a sync operation."""

    name: str
    action: str  # "synced", "skipped_no_change", "skipped_no_data", "error"
    reason: str
    synced: int = 0
    created: int = 0
    updated: int = 0
    duration_ms: int = 0


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

    Each sync operation is independent - failures in one don't block others.

    Performance optimizations:
    - Batch fetches all stored hashes in one query at startup
    - Hash comparison skips expensive operations (ffprobe) when unchanged
    - File scanning still needed for hash computation, but is fast (~700 stat calls)
    """

    # Hash version prefix - increment when hash algorithm/serialization changes
    # This ensures old hashes are treated as "no hash" after algorithm changes
    HASH_VERSION = "v1:"

    def __init__(self, db: Session, force_sync: bool = False):
        """
        Initialize the sync service.

        Args:
            db: Database session
            force_sync: If True, sync all content regardless of hash
        """
        self.db = db
        self.force_sync = force_sync or getattr(settings, "FORCE_CONTENT_SYNC", False)
        self.results: list[SyncResult] = []
        self._stored_hashes: dict[str, str] | None = None  # Lazy-loaded cache

    def sync_all(self) -> list[SyncResult]:
        """
        Sync all curated content to database.

        Runs all sync operations in order, respecting dependencies.
        Only syncs content that has changed (based on hash comparison).
        Each sync is independent - errors don't block subsequent syncs.

        Returns:
            List of SyncResult objects describing what was synced
        """
        start_time = time.time()
        logger.info("=" * 60)
        logger.info("STARTUP SYNC: Checking curated content")
        if self.force_sync:
            logger.info("STARTUP SYNC: Force sync enabled - ignoring hashes")
        logger.info("=" * 60)

        # Batch fetch all stored hashes upfront (1 query instead of 5)
        self._load_stored_hashes()

        # Independent content (no dependencies)
        # Note: Book and chapter metadata are synced together to avoid duplicate calls
        self._sync_with_error_handling(
            "Metadata",
            self._sync_metadata,
        )
        self._sync_with_error_handling(
            "Dhyanam Verses",
            self._sync_dhyanam_verses,
        )
        self._sync_with_error_handling(
            "Principles",
            self._sync_principles,
        )

        # Dependent content (requires verses)
        self._sync_with_error_handling(
            "Featured Verses",
            self._sync_featured_verses,
        )
        self._sync_with_error_handling(
            "Audio Metadata",
            self._sync_audio_metadata,
        )

        # Audio file durations (requires audio_metadata rows to exist)
        self._sync_with_error_handling(
            "Audio Durations",
            self._sync_audio_durations,
        )

        # SEO pages (optional - checks status, doesn't regenerate on startup)
        self._sync_with_error_handling(
            "SEO Pages",
            self._check_seo_status,
        )

        # Log summary
        total_duration_ms = int((time.time() - start_time) * 1000)
        self._log_summary(total_duration_ms)

        return self.results

    def _sync_with_error_handling(
        self,
        name: str,
        sync_func: Callable[[], SyncResult | None],
    ) -> None:
        """
        Execute a sync function with error handling and timing.

        Args:
            name: Human-readable name for the content type
            sync_func: Function that performs the sync and returns result
        """
        start_time = time.time()
        try:
            result = sync_func()
            if result:
                # Add timing to result
                duration_ms = int((time.time() - start_time) * 1000)
                result = SyncResult(
                    name=result.name,
                    action=result.action,
                    reason=result.reason,
                    synced=result.synced,
                    created=result.created,
                    updated=result.updated,
                    duration_ms=duration_ms,
                )
                self.results.append(result)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"STARTUP SYNC: Failed to sync {name}: {e}", exc_info=True)
            self.results.append(
                SyncResult(
                    name=name,
                    action="error",
                    reason=str(e)[:100],  # Truncate long errors
                    duration_ms=duration_ms,
                )
            )

    def _load_stored_hashes(self) -> None:
        """
        Batch load all stored hashes into memory.

        This reduces 5 individual DB queries to 1, significantly improving
        startup performance when all content is unchanged.
        """
        from models import SyncHash

        self._stored_hashes = {}
        records = self.db.query(SyncHash).all()
        for record in records:
            self._stored_hashes[record.content_type] = record.content_hash

        logger.debug(f"Loaded {len(self._stored_hashes)} stored hashes")

    def _get_stored_hash(self, content_type: str) -> str | None:
        """
        Get stored hash for a content type from cache.

        Returns None if:
        - No hash exists for this content type
        - Hash exists but has wrong version prefix (algorithm changed)
        """
        if self._stored_hashes is None:
            self._load_stored_hashes()
            assert self._stored_hashes is not None  # Set by _load_stored_hashes

        stored = self._stored_hashes.get(content_type)
        if stored is None:
            return None

        # Check version prefix - treat old hashes as "no hash"
        if not stored.startswith(self.HASH_VERSION):
            logger.debug(f"{content_type}: Hash version mismatch, re-sync needed")
            return None

        return stored

    def _update_stored_hash(self, content_type: str, content_hash: str) -> None:
        """Update or create stored hash for a content type."""
        from models import SyncHash

        # Ensure hash has version prefix
        if not content_hash.startswith(self.HASH_VERSION):
            content_hash = self.HASH_VERSION + content_hash

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

        # Update cache
        if self._stored_hashes is not None:
            self._stored_hashes[content_type] = content_hash

    def _needs_sync(self, content_type: str, current_hash: str) -> bool:
        """Check if content needs sync by comparing hashes."""
        if self.force_sync:
            logger.debug(f"{content_type}: Force sync enabled")
            return True

        stored_hash = self._get_stored_hash(content_type)

        if stored_hash is None:
            logger.debug(f"{content_type}: No stored hash, sync needed")
            return True

        # Add version prefix to current hash for comparison
        versioned_current = self.HASH_VERSION + current_hash

        if stored_hash != versioned_current:
            logger.debug(f"{content_type}: Hash changed, sync needed")
            logger.debug(f"  Stored: {stored_hash[:20]}...")
            logger.debug(f"  Current: {versioned_current[:20]}...")
            return True

        logger.debug(f"{content_type}: Hash unchanged, skip sync")
        return False

    def _sync_metadata(self) -> SyncResult | None:
        """
        Sync book and chapter metadata if changed.

        Combines book and chapter into single operation to avoid
        calling sync_metadata() twice.
        """
        from data.chapter_metadata import get_all_chapter_metadata, get_book_metadata

        # Compute combined hash for both book and chapters
        content_type = "metadata"  # Combined key
        source_data = {
            "book": get_book_metadata(),
            "chapters": get_all_chapter_metadata(),
        }
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            return SyncResult(
                name="Metadata",
                action="skipped_no_change",
                reason="Content unchanged",
            )

        # Sync needed
        from api.admin import sync_metadata

        stats = sync_metadata(self.db)
        self._update_stored_hash(content_type, current_hash)

        return SyncResult(
            name="Metadata",
            action="synced",
            reason="Content changed or first sync",
            synced=stats["chapters_synced"] + (1 if stats["book_synced"] else 0),
            created=stats["chapters_synced"] + (1 if stats["book_synced"] else 0),
        )

    def _sync_dhyanam_verses(self) -> SyncResult | None:
        """Sync Geeta Dhyanam verses if changed."""
        from data.geeta_dhyanam import get_geeta_dhyanam

        content_type = "dhyanam_verses"
        source_data = get_geeta_dhyanam()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            return SyncResult(
                name="Dhyanam Verses",
                action="skipped_no_change",
                reason="Content unchanged",
            )

        # Sync needed
        from api.admin import sync_geeta_dhyanam

        stats = sync_geeta_dhyanam(self.db)
        self._update_stored_hash(content_type, current_hash)

        return SyncResult(
            name="Dhyanam Verses",
            action="synced",
            reason="Content changed or first sync",
            synced=stats["synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    def _sync_principles(self) -> SyncResult | None:
        """Sync principle taxonomy if changed."""
        from data.principles import get_principle_groups, get_principles

        content_type = "principles"
        # Compute hash from both groups and principles data
        source_data = {
            "groups": get_principle_groups(),
            "principles": get_principles(),
        }
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            return SyncResult(
                name="Principles",
                action="skipped_no_change",
                reason="Content unchanged",
            )

        # Sync needed
        from api.admin import sync_principles

        stats = sync_principles(self.db)
        self._update_stored_hash(content_type, current_hash)

        return SyncResult(
            name="Principles",
            action="synced",
            reason="Content changed or first sync",
            synced=stats["groups_synced"] + stats["principles_synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    def _sync_featured_verses(self) -> SyncResult | None:
        """Sync featured verse flags if changed."""
        from data.featured_verses import get_featured_verse_ids
        from models import Verse

        # Check if verses exist at all
        verse_count = self.db.query(Verse).count()
        if verse_count == 0:
            return SyncResult(
                name="Featured Verses",
                action="skipped_no_data",
                reason="No verses in DB (run ingestion first)",
            )

        content_type = "featured_verses"
        source_data = get_featured_verse_ids()
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            return SyncResult(
                name="Featured Verses",
                action="skipped_no_change",
                reason="Content unchanged",
            )

        # Sync needed
        from api.admin import sync_featured_verses

        stats = sync_featured_verses(self.db)
        self._update_stored_hash(content_type, current_hash)

        return SyncResult(
            name="Featured Verses",
            action="synced",
            reason="Content changed or first sync",
            synced=stats["synced"],
        )

    def _sync_audio_metadata(self) -> SyncResult | None:
        """Sync verse audio metadata if changed."""
        from models import Verse

        # Check if verses exist at all
        verse_count = self.db.query(Verse).count()
        if verse_count == 0:
            return SyncResult(
                name="Audio Metadata",
                action="skipped_no_data",
                reason="No verses in DB (run ingestion first)",
            )

        # For audio metadata, compute hash from:
        # 1. Curated chapter metadata
        # 2. Maha vakya configs
        # 3. Speaker/chapter defaults
        # This ensures any change to audio behavior triggers re-sync
        from data.verse_audio_metadata import (
            CHAPTER_DEFAULTS,
            SPEAKER_DEFAULTS,
            get_all_metadata,
        )
        from data.verse_audio_metadata.maha_vakyas import (
            KEY_TEACHING_VERSES,
            MAHA_VAKYAS,
        )

        content_type = "audio_metadata"
        source_data = {
            "curated": get_all_metadata(),
            "maha_vakyas": MAHA_VAKYAS,
            "key_teachings": KEY_TEACHING_VERSES,
            "speaker_defaults": SPEAKER_DEFAULTS,
            "chapter_defaults": CHAPTER_DEFAULTS,
        }
        current_hash = compute_content_hash(source_data)

        if not self._needs_sync(content_type, current_hash):
            return SyncResult(
                name="Audio Metadata",
                action="skipped_no_change",
                reason="Content unchanged",
            )

        # Sync needed
        from api.admin import sync_verse_audio_metadata

        stats = sync_verse_audio_metadata(self.db)
        self._update_stored_hash(content_type, current_hash)

        return SyncResult(
            name="Audio Metadata",
            action="synced",
            reason="Content changed or first sync",
            synced=stats["synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    def _sync_audio_durations(self) -> SyncResult | None:
        """
        Sync audio file durations from MP3 files to database.

        Scans the audio directory for MP3 files, extracts durations using ffprobe,
        and updates audio_file_path and audio_duration_ms in verse_audio_metadata.

        Includes both verse audio (BG_*.mp3) and dhyanam audio (dhyanam_*.mp3).

        Hash is computed from file list (names + sizes) to detect changes.
        File scanning is required to compute hash, but ffprobe calls only happen
        when hash indicates changes.
        """
        from pathlib import Path

        from models import DhyanamVerse, VerseAudioMetadata
        from services.audio import extract_duration_ffprobe, get_audio_directory

        content_type = "audio_durations"

        # Check if audio metadata rows exist (cheap DB query)
        audio_count = self.db.query(VerseAudioMetadata).count()
        if audio_count == 0:
            return SyncResult(
                name="Audio Durations",
                action="skipped_no_data",
                reason="No audio metadata rows (sync audio metadata first)",
            )

        # Get audio directory
        audio_dir = get_audio_directory()
        mp3_dir = audio_dir / "mp3"

        if not mp3_dir.exists():
            return SyncResult(
                name="Audio Durations",
                action="skipped_no_data",
                reason=f"Audio directory not found: {mp3_dir}",
            )

        # Scan for MP3 files and build file list for hashing
        # Includes: chapters 01-18 (BG_*.mp3) and dhyanam/ (dhyanam_*.mp3)
        file_list = []
        audio_files: list[tuple[str, str, str]] = []  # (path, canonical_id, rel_path)

        # Chapter audio files (BG_1_1.mp3 through BG_18_78.mp3)
        for chapter_num in range(1, 19):
            chapter_dir = mp3_dir / f"{chapter_num:02d}"
            if chapter_dir.exists():
                for mp3_file in sorted(chapter_dir.glob("BG_*.mp3")):
                    stat = mp3_file.stat()
                    file_list.append(
                        {
                            "name": mp3_file.name,
                            "size": stat.st_size,
                            "dir": f"{chapter_num:02d}",
                        }
                    )
                    audio_files.append(
                        (
                            str(mp3_file),
                            mp3_file.stem,  # BG_2_47
                            f"mp3/{chapter_num:02d}/{mp3_file.name}",
                        )
                    )

        # Dhyanam audio files (dhyanam_1.mp3 through dhyanam_9.mp3)
        dhyanam_dir = mp3_dir / "dhyanam"
        if dhyanam_dir.exists():
            for mp3_file in sorted(dhyanam_dir.glob("dhyanam_*.mp3")):
                stat = mp3_file.stat()
                file_list.append(
                    {"name": mp3_file.name, "size": stat.st_size, "dir": "dhyanam"}
                )
                # Extract verse number from filename (dhyanam_1.mp3 -> 1)
                try:
                    verse_num = int(mp3_file.stem.split("_")[1])
                    audio_files.append(
                        (
                            str(mp3_file),
                            f"dhyanam_{verse_num}",  # Special ID for dhyanam
                            f"mp3/dhyanam/{mp3_file.name}",
                        )
                    )
                except (IndexError, ValueError):
                    logger.warning(f"Unexpected dhyanam filename: {mp3_file.name}")

        if not file_list:
            return SyncResult(
                name="Audio Durations",
                action="skipped_no_data",
                reason="No audio files found in mp3 directory",
            )

        # Compute hash from file list
        current_hash = compute_content_hash(file_list)

        if not self._needs_sync(content_type, current_hash):
            return SyncResult(
                name="Audio Durations",
                action="skipped_no_change",
                reason="Audio files unchanged",
            )

        # Sync needed - extract durations and update DB
        logger.info(
            f"STARTUP SYNC: Extracting durations from {len(audio_files)} audio files..."
        )

        updated = 0
        errors = 0

        for file_path, canonical_id, rel_path in audio_files:
            # Extract duration using ffprobe
            duration_ms = extract_duration_ffprobe(Path(file_path))
            if duration_ms is None:
                errors += 1
                logger.debug(f"Failed to extract duration: {file_path}")
                continue

            # Update database based on type
            if canonical_id.startswith("dhyanam_"):
                # Update DhyanamVerse table
                verse_num = int(canonical_id.split("_")[1])
                rows = (
                    self.db.query(DhyanamVerse)
                    .filter(DhyanamVerse.verse_number == verse_num)
                    .update(
                        {
                            "audio_url": f"/audio/{rel_path}",
                            "duration_ms": duration_ms,
                        }
                    )
                )
                if rows > 0:
                    updated += 1
            else:
                # Update VerseAudioMetadata table
                rows = (
                    self.db.query(VerseAudioMetadata)
                    .filter(VerseAudioMetadata.canonical_id == canonical_id)
                    .update(
                        {
                            "audio_file_path": rel_path,
                            "audio_duration_ms": duration_ms,
                        }
                    )
                )
                if rows > 0:
                    updated += 1

        self.db.commit()
        self._update_stored_hash(content_type, current_hash)

        if errors > 0:
            logger.warning(
                f"STARTUP SYNC: {errors} audio files failed duration extraction"
            )

        return SyncResult(
            name="Audio Durations",
            action="synced",
            reason="Extracted durations from audio files",
            synced=updated,
            updated=updated,
        )

    def _check_seo_status(self) -> SyncResult | None:
        """
        Check SEO page status on startup and auto-generate if missing.

        Auto-generates SEO pages if:
        - No pages exist (first deploy)
        - force_sync=True is set

        Otherwise just reports status (hash-based regeneration is handled
        by daily cron job and post-deploy trigger).

        Returns:
            SyncResult with SEO page status
        """
        from sqlalchemy import inspect

        from models import SeoPage, Verse

        # Check if seo_pages table exists (migration may not have run yet)
        conn = self.db.get_bind()
        if conn is None:
            return SyncResult(
                name="SEO Pages",
                action="error",
                reason="No database connection",
            )
        inspector = inspect(conn)
        if "seo_pages" not in inspector.get_table_names():
            return SyncResult(
                name="SEO Pages",
                action="skipped_no_data",
                reason="Table not created (run migration 028)",
            )

        # Check if we have verses (SEO depends on verse data)
        verse_count = self.db.query(Verse).count()
        if verse_count == 0:
            return SyncResult(
                name="SEO Pages",
                action="skipped_no_data",
                reason="No verses in DB (run ingestion first)",
            )

        # Count existing SEO pages
        seo_page_count = self.db.query(SeoPage).count()

        if seo_page_count == 0:
            # No SEO pages - auto-generate on first startup
            logger.info(
                "STARTUP SYNC: No SEO pages found. Auto-generating..."
            )
            try:
                from services.seo import GenerationInProgressError, SeoGeneratorService

                service = SeoGeneratorService(self.db)
                result = service.generate_all(force=False, trigger="startup")

                return SyncResult(
                    name="SEO Pages",
                    action="synced",
                    reason="Initial generation (no pages existed)",
                    synced=result.generated,
                    created=result.generated,
                )
            except GenerationInProgressError:
                return SyncResult(
                    name="SEO Pages",
                    action="skipped_no_change",
                    reason="Generation already in progress",
                )
            except Exception as e:
                logger.error(f"STARTUP SYNC: SEO generation failed: {e}")
                return SyncResult(
                    name="SEO Pages",
                    action="error",
                    reason=str(e)[:100],
                )

        # If force sync, trigger regeneration
        if self.force_sync:
            try:
                from services.seo import GenerationInProgressError, SeoGeneratorService

                service = SeoGeneratorService(self.db)
                result = service.generate_all(force=True)

                return SyncResult(
                    name="SEO Pages",
                    action="synced",
                    reason="Force regeneration",
                    synced=result.generated,
                    created=result.generated,
                )
            except GenerationInProgressError:
                return SyncResult(
                    name="SEO Pages",
                    action="skipped_no_change",
                    reason="Generation already in progress",
                )

        # Pages exist, just report status
        return SyncResult(
            name="SEO Pages",
            action="skipped_no_change",
            reason=f"{seo_page_count} pages exist",
        )

    def _log_summary(self, total_duration_ms: int) -> None:
        """Log summary of sync operations."""
        synced_items = [r for r in self.results if r.action == "synced"]
        skipped_unchanged = [r for r in self.results if r.action == "skipped_no_change"]
        skipped_no_data = [r for r in self.results if r.action == "skipped_no_data"]
        errors = [r for r in self.results if r.action == "error"]

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
                details.append(f"{result.duration_ms}ms")
                detail_str = f" ({', '.join(details)})"
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

        if errors:
            logger.error(f"STARTUP SYNC: {len(errors)} content types failed:")
            for result in errors:
                logger.error(f"  X {result.name}: {result.reason}")

        if not synced_items and not skipped_no_data and not errors:
            logger.info("STARTUP SYNC: All curated content up to date")

        logger.info(f"STARTUP SYNC: Completed in {total_duration_ms}ms")
        logger.info("=" * 60)


def run_startup_sync(force: bool = False) -> list[SyncResult]:
    """
    Run startup sync in a new database session.

    This is the main entry point for startup sync, meant to be called
    from the application lifespan handler.

    Args:
        force: If True, sync all content regardless of hash

    Returns:
        List of SyncResult objects
    """
    from db.connection import SessionLocal

    db = SessionLocal()
    try:
        service = StartupSyncService(db, force_sync=force)
        return service.sync_all()
    except Exception as e:
        logger.error(f"STARTUP SYNC FAILED: {e}", exc_info=True)
        return []
    finally:
        db.close()
