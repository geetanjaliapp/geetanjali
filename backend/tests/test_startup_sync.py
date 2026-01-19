"""Tests for startup synchronization service.

These tests verify that:
1. Hash-based change detection works correctly
2. Content is synced when missing or changed
3. Content is skipped when unchanged
4. Dependencies are respected (featured/audio need verses)
5. Errors in one sync don't block others
6. Force sync option bypasses hash check
"""

import pytest
from sqlalchemy.orm import Session

from services.startup_sync import (
    StartupSyncService,
    SyncResult,
    compute_content_hash,
)

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


class TestComputeContentHash:
    """Tests for the hash computation function."""

    def test_hash_is_deterministic(self):
        """Same data produces same hash."""
        data = {"key": "value", "list": [1, 2, 3]}
        hash1 = compute_content_hash(data)
        hash2 = compute_content_hash(data)
        assert hash1 == hash2

    def test_hash_is_order_independent(self):
        """Dict order doesn't affect hash (uses sort_keys)."""
        data1 = {"a": 1, "b": 2}
        data2 = {"b": 2, "a": 1}
        assert compute_content_hash(data1) == compute_content_hash(data2)

    def test_different_data_produces_different_hash(self):
        """Different data produces different hash."""
        data1 = {"key": "value1"}
        data2 = {"key": "value2"}
        assert compute_content_hash(data1) != compute_content_hash(data2)

    def test_hash_is_sha256_format(self):
        """Hash is 64 character hex string (SHA256)."""
        data = {"test": "data"}
        hash_value = compute_content_hash(data)
        assert len(hash_value) == 64
        assert all(c in "0123456789abcdef" for c in hash_value)


class TestStartupSyncService:
    """Tests for the StartupSyncService."""

    def test_first_sync_creates_content(self, db_session: Session):
        """First run syncs all content (no stored hashes)."""
        from models import BookMetadata, ChapterMetadata, DhyanamVerse, SyncHash

        # Verify tables are empty
        assert db_session.query(SyncHash).count() == 0
        assert db_session.query(BookMetadata).count() == 0
        assert db_session.query(ChapterMetadata).count() == 0
        assert db_session.query(DhyanamVerse).count() == 0

        # Run sync
        service = StartupSyncService(db_session)
        results = service.sync_all()

        # Verify results - 7 content types:
        # metadata, dhyanam, principles, featured, audio metadata, audio durations, seo pages
        assert len(results) == 7

        # Metadata (book + chapters) should be synced
        metadata_result = next(r for r in results if r.name == "Metadata")
        assert metadata_result.action == "synced"
        assert metadata_result.synced == 19  # 1 book + 18 chapters
        assert metadata_result.duration_ms >= 0

        # Dhyanam should be synced
        dhyanam_result = next(r for r in results if r.name == "Dhyanam Verses")
        assert dhyanam_result.action == "synced"
        assert dhyanam_result.synced == 9  # 9 dhyanam verses

        # Featured/Audio/AudioDurations should be skipped (no verses in DB)
        featured_result = next(r for r in results if r.name == "Featured Verses")
        assert featured_result.action == "skipped_no_data"

        audio_result = next(r for r in results if r.name == "Audio Metadata")
        assert audio_result.action == "skipped_no_data"

        durations_result = next(r for r in results if r.name == "Audio Durations")
        assert durations_result.action == "skipped_no_data"

        # Verify data was created
        assert db_session.query(BookMetadata).count() == 1
        assert db_session.query(ChapterMetadata).count() == 18
        assert db_session.query(DhyanamVerse).count() == 9

        # Verify Principles were synced
        principles_result = next(r for r in results if r.name == "Principles")
        assert principles_result.action == "synced"
        assert principles_result.synced == 20  # 4 groups + 16 principles

        # SEO Pages should be skipped (no verses in DB)
        seo_result = next(r for r in results if r.name == "SEO Pages")
        assert seo_result.action == "skipped_no_data"

        # Verify hashes were stored (metadata, dhyanam, principles)
        assert db_session.query(SyncHash).count() == 3

    def test_second_sync_skips_unchanged(self, db_session: Session):
        """Second run skips unchanged content (hash matches)."""
        # First sync
        service1 = StartupSyncService(db_session)
        results1 = service1.sync_all()

        synced_first = [r for r in results1 if r.action == "synced"]
        assert len(synced_first) == 3  # metadata, dhyanam, principles

        # Second sync
        service2 = StartupSyncService(db_session)
        results2 = service2.sync_all()

        # All should be skipped (unchanged) or skipped_no_data
        synced_second = [r for r in results2 if r.action == "synced"]
        assert len(synced_second) == 0

        unchanged = [r for r in results2 if r.action == "skipped_no_change"]
        assert len(unchanged) == 3  # metadata, dhyanam, principles

    def test_sync_detects_hash_change(self, db_session: Session):
        """Sync detects when stored hash differs from current."""
        from models import SyncHash

        # First sync
        service1 = StartupSyncService(db_session)
        service1.sync_all()

        # Manually corrupt the dhyanam hash to simulate a change
        dhyanam_hash = (
            db_session.query(SyncHash)
            .filter(SyncHash.content_type == "dhyanam_verses")
            .first()
        )
        assert dhyanam_hash is not None, "Dhyanam hash should exist after first sync"
        original_hash = dhyanam_hash.content_hash
        dhyanam_hash.content_hash = "corrupted_hash_value_that_differs"
        db_session.commit()

        # Second sync should detect the change
        service2 = StartupSyncService(db_session)
        results2 = service2.sync_all()

        dhyanam_result = next(r for r in results2 if r.name == "Dhyanam Verses")
        assert dhyanam_result.action == "synced"
        assert dhyanam_result.reason == "Content changed or first sync"

        # Hash should be updated back to correct value
        db_session.refresh(dhyanam_hash)
        assert dhyanam_hash.content_hash == original_hash

    def test_force_sync_ignores_hash(self, db_session: Session):
        """Force sync option syncs regardless of hash match."""
        # First sync
        service1 = StartupSyncService(db_session)
        service1.sync_all()

        # Second sync with force=True
        service2 = StartupSyncService(db_session, force_sync=True)
        results2 = service2.sync_all()

        # Should sync even though hash matches
        synced = [r for r in results2 if r.action == "synced"]
        assert len(synced) == 3  # metadata, dhyanam, principles (not featured/audio/seo - no verses)

    def test_error_in_one_sync_doesnt_block_others(
        self, db_session: Session, monkeypatch
    ):
        """Error in one sync operation doesn't prevent others from running."""
        from models import DhyanamVerse

        # Make _sync_metadata raise an exception
        def mock_sync_metadata():
            raise Exception("Simulated failure")

        # Run sync with patched method
        service = StartupSyncService(db_session)
        monkeypatch.setattr(service, "_sync_metadata", mock_sync_metadata)
        results = service.sync_all()

        # Should have 7 results (metadata, dhyanam, principles, featured, audio, durations, seo)
        assert len(results) == 7

        # Metadata should have error
        metadata_result = next(r for r in results if r.name == "Metadata")
        assert metadata_result.action == "error"
        assert "Simulated failure" in metadata_result.reason

        # Dhyanam should still sync successfully
        dhyanam_result = next(r for r in results if r.name == "Dhyanam Verses")
        assert dhyanam_result.action == "synced"
        assert db_session.query(DhyanamVerse).count() == 9


class TestSyncHashModel:
    """Tests for the SyncHash model."""

    def test_sync_hash_creation(self, db_session: Session):
        """SyncHash model can be created and retrieved."""
        from models import SyncHash

        hash_record = SyncHash(
            content_type="test_content",
            content_hash="a" * 64,  # Valid SHA256 hex
        )
        db_session.add(hash_record)
        db_session.commit()

        retrieved = (
            db_session.query(SyncHash)
            .filter(SyncHash.content_type == "test_content")
            .first()
        )
        assert retrieved is not None
        assert retrieved.content_hash == "a" * 64
        assert retrieved.synced_at is not None
        assert retrieved.created_at is not None

    def test_sync_hash_update(self, db_session: Session):
        """SyncHash hash can be updated."""
        from datetime import datetime

        from models import SyncHash

        hash_record = SyncHash(
            content_type="update_test",
            content_hash="a" * 64,
        )
        db_session.add(hash_record)
        db_session.commit()

        # Update
        hash_record.content_hash = "b" * 64
        hash_record.synced_at = datetime.utcnow()
        db_session.commit()

        # Verify update
        db_session.refresh(hash_record)
        assert hash_record.content_hash == "b" * 64


class TestSyncResultTiming:
    """Tests for sync operation timing."""

    def test_sync_results_include_timing(self, db_session: Session):
        """All sync results include duration_ms field."""
        service = StartupSyncService(db_session)
        results = service.sync_all()

        for result in results:
            assert hasattr(result, "duration_ms")
            assert isinstance(result.duration_ms, int)
            assert result.duration_ms >= 0
