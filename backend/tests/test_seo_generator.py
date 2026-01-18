"""Tests for SEO Generator Service.

Tests the core SEO page generation functionality including:
- Atomic file writes with path traversal protection
- Hash-based regeneration detection
- Page recording and status tracking
- Duration conversion utilities

Note: Full generation tests require PostgreSQL for advisory locks.
These unit tests focus on the testable logic without PostgreSQL features.
"""

import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from models import SeoPage
from services.seo.generator import (
    SeoGenerationResult,
    SeoGeneratorService,
    ms_to_iso8601_duration,
)

pytestmark = pytest.mark.unit


class TestMsToIso8601Duration:
    """Tests for ms_to_iso8601_duration utility function."""

    def test_returns_none_for_none_input(self):
        """None input should return None."""
        assert ms_to_iso8601_duration(None) is None

    def test_returns_none_for_negative(self):
        """Negative input should return None."""
        assert ms_to_iso8601_duration(-1) is None
        assert ms_to_iso8601_duration(-1000) is None

    def test_zero_milliseconds(self):
        """Zero should return PT0S."""
        assert ms_to_iso8601_duration(0) == "PT0S"

    def test_seconds_only(self):
        """Values under 60 seconds should use seconds only."""
        assert ms_to_iso8601_duration(1000) == "PT1S"
        assert ms_to_iso8601_duration(30000) == "PT30S"
        assert ms_to_iso8601_duration(59000) == "PT59S"

    def test_minutes_and_seconds(self):
        """Values over 60 seconds should include minutes."""
        assert ms_to_iso8601_duration(60000) == "PT1M0S"
        assert ms_to_iso8601_duration(90000) == "PT1M30S"
        assert ms_to_iso8601_duration(125000) == "PT2M5S"

    def test_milliseconds_truncated(self):
        """Milliseconds portion should be truncated, not rounded."""
        assert ms_to_iso8601_duration(1500) == "PT1S"  # Not 2S
        assert ms_to_iso8601_duration(999) == "PT0S"


class TestAtomicWrite:
    """Tests for _write_atomic method."""

    def test_creates_file(self, db_session):
        """Should create the file with content."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            service = SeoGeneratorService(db_session, output_dir=output_dir)

            file_path = output_dir / "test.html"
            content = "<html>test content</html>"

            size = service._write_atomic(file_path, content, create_gzip=False)

            assert file_path.exists()
            assert file_path.read_text() == content
            assert size == len(content.encode("utf-8"))

    def test_creates_parent_dirs(self, db_session):
        """Should create parent directories if they don't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            service = SeoGeneratorService(db_session, output_dir=output_dir)

            file_path = output_dir / "deep" / "nested" / "test.html"
            content = "<html>nested</html>"

            service._write_atomic(file_path, content, create_gzip=False)

            assert file_path.exists()
            assert file_path.read_text() == content

    def test_creates_gzip_version(self, db_session):
        """Should create gzip version when requested."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            service = SeoGeneratorService(db_session, output_dir=output_dir)

            file_path = output_dir / "test.html"
            content = "<html>test</html>"

            service._write_atomic(file_path, content, create_gzip=True)

            gz_path = Path(str(file_path) + ".gz")
            assert file_path.exists()
            assert gz_path.exists()

    def test_path_traversal_rejected(self, db_session):
        """Should reject paths that escape output directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir) / "seo"
            output_dir.mkdir()
            service = SeoGeneratorService(db_session, output_dir=output_dir)

            # Attempt to write outside output_dir
            evil_path = output_dir / ".." / "escaped.html"

            with pytest.raises(ValueError, match="Path traversal"):
                service._write_atomic(evil_path, "evil content", create_gzip=False)

    def test_no_temp_file_left_on_success(self, db_session):
        """Should not leave temp files after successful write."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            service = SeoGeneratorService(db_session, output_dir=output_dir)

            file_path = output_dir / "test.html"
            service._write_atomic(file_path, "content", create_gzip=False)

            # Check no .tmp files remain
            tmp_files = list(output_dir.glob("*.tmp"))
            assert len(tmp_files) == 0

    def test_handles_unicode(self, db_session):
        """Should handle unicode content (Sanskrit text)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            service = SeoGeneratorService(db_session, output_dir=output_dir)

            file_path = output_dir / "verse.html"
            content = "<html><h1>धर्म</h1><p>dharma</p></html>"

            service._write_atomic(file_path, content, create_gzip=False)

            assert file_path.read_text(encoding="utf-8") == content


class TestNeedsRegeneration:
    """Tests for _needs_regeneration method."""

    def test_new_page_needs_regeneration(self, db_session):
        """Page not in database should need regeneration."""
        service = SeoGeneratorService(db_session)

        result = service._needs_regeneration(
            page_key="new_page",
            source_hash="abc123",
            template_hash="def456",
        )

        assert result is True

    def test_unchanged_page_skipped(self, db_session):
        """Page with matching hashes should be skipped."""
        # Create existing page record
        page = SeoPage(
            page_key="existing_page",
            page_type="test",
            source_hash="abc123",
            template_hash="def456",
            generated_at=datetime.utcnow(),
            file_path="test.html",
        )
        db_session.add(page)
        db_session.commit()

        service = SeoGeneratorService(db_session)

        result = service._needs_regeneration(
            page_key="existing_page",
            source_hash="abc123",
            template_hash="def456",
        )

        assert result is False

    def test_changed_source_needs_regeneration(self, db_session):
        """Page with changed source hash should need regeneration."""
        page = SeoPage(
            page_key="page1",
            page_type="test",
            source_hash="old_hash",
            template_hash="template",
            generated_at=datetime.utcnow(),
            file_path="test.html",
        )
        db_session.add(page)
        db_session.commit()

        service = SeoGeneratorService(db_session)

        result = service._needs_regeneration(
            page_key="page1",
            source_hash="new_hash",
            template_hash="template",
        )

        assert result is True

    def test_changed_template_needs_regeneration(self, db_session):
        """Page with changed template hash should need regeneration."""
        page = SeoPage(
            page_key="page2",
            page_type="test",
            source_hash="source",
            template_hash="old_template",
            generated_at=datetime.utcnow(),
            file_path="test.html",
        )
        db_session.add(page)
        db_session.commit()

        service = SeoGeneratorService(db_session)

        result = service._needs_regeneration(
            page_key="page2",
            source_hash="source",
            template_hash="new_template",
        )

        assert result is True


class TestRecordPage:
    """Tests for _record_page method."""

    def test_creates_new_record(self, db_session):
        """Should create new SeoPage record for new page."""
        service = SeoGeneratorService(db_session)

        service._record_page(
            page_key="new_page",
            page_type="verse",
            source_hash="abc123",
            template_hash="def456",
            file_path="verses/new_page.html",
            file_size=1024,
            generation_ms=50,
        )

        # Flush to ensure the record is written before querying
        db_session.flush()

        page = db_session.query(SeoPage).filter_by(page_key="new_page").first()
        assert page is not None
        assert page.page_type == "verse"
        assert page.source_hash == "abc123"
        assert page.template_hash == "def456"
        assert page.file_size_bytes == 1024
        assert page.generation_ms == 50

    def test_updates_existing_record(self, db_session):
        """Should update existing SeoPage record."""
        # Create existing record
        page = SeoPage(
            page_key="existing_page",
            page_type="verse",
            source_hash="old_source",
            template_hash="old_template",
            generated_at=datetime(2020, 1, 1),
            file_path="old/path.html",
            file_size_bytes=500,
            generation_ms=20,
        )
        db_session.add(page)
        db_session.commit()

        service = SeoGeneratorService(db_session)

        service._record_page(
            page_key="existing_page",
            page_type="verse",
            source_hash="new_source",
            template_hash="new_template",
            file_path="new/path.html",
            file_size=2000,
            generation_ms=100,
        )

        updated = db_session.query(SeoPage).filter_by(page_key="existing_page").first()
        assert updated.source_hash == "new_source"
        assert updated.template_hash == "new_template"
        assert updated.file_path == "new/path.html"
        assert updated.file_size_bytes == 2000
        assert updated.generation_ms == 100
        assert updated.generated_at > datetime(2020, 1, 1)


class TestGetStatus:
    """Tests for get_status method."""

    def test_empty_database(self, db_session):
        """Should return zeros for empty database."""
        service = SeoGeneratorService(db_session)

        status = service.get_status()

        assert status["total_pages"] == 0
        assert status["total_size_bytes"] == 0
        assert status["last_generated_at"] is None
        assert status["pages_by_type"] == {}

    def test_counts_by_type(self, db_session):
        """Should count pages by type."""
        # Add some pages
        for i in range(5):
            page = SeoPage(
                page_key=f"verse_{i}",
                page_type="verse",
                source_hash="hash",
                template_hash="template",
                generated_at=datetime.utcnow(),
                file_path=f"verses/{i}.html",
                file_size_bytes=1000,
            )
            db_session.add(page)

        for i in range(2):
            page = SeoPage(
                page_key=f"chapter_{i}",
                page_type="chapter",
                source_hash="hash",
                template_hash="template",
                generated_at=datetime.utcnow(),
                file_path=f"chapters/{i}.html",
                file_size_bytes=2000,
            )
            db_session.add(page)

        db_session.commit()

        service = SeoGeneratorService(db_session)
        status = service.get_status()

        assert status["total_pages"] == 7
        assert status["pages_by_type"]["verse"] == 5
        assert status["pages_by_type"]["chapter"] == 2

    def test_sums_file_sizes(self, db_session):
        """Should sum total file sizes."""
        for i in range(3):
            page = SeoPage(
                page_key=f"page_{i}",
                page_type="test",
                source_hash="hash",
                template_hash="template",
                generated_at=datetime.utcnow(),
                file_path=f"test/{i}.html",
                file_size_bytes=1000 * (i + 1),  # 1000, 2000, 3000
            )
            db_session.add(page)

        db_session.commit()

        service = SeoGeneratorService(db_session)
        status = service.get_status()

        assert status["total_size_bytes"] == 6000  # 1000 + 2000 + 3000

    def test_last_generated_at(self, db_session):
        """Should return most recent generation time."""
        # Add pages with different times
        page1 = SeoPage(
            page_key="old_page",
            page_type="test",
            source_hash="hash",
            template_hash="template",
            generated_at=datetime(2020, 1, 1, 12, 0, 0),
            file_path="old.html",
        )
        page2 = SeoPage(
            page_key="new_page",
            page_type="test",
            source_hash="hash",
            template_hash="template",
            generated_at=datetime(2025, 6, 15, 12, 0, 0),
            file_path="new.html",
        )
        db_session.add_all([page1, page2])
        db_session.commit()

        service = SeoGeneratorService(db_session)
        status = service.get_status()

        assert status["last_generated_at"] == "2025-06-15T12:00:00"
