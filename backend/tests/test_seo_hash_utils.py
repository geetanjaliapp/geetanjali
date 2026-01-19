"""Tests for SEO hash utility functions.

These unit tests verify the hash computation logic used for incremental
SEO page regeneration.
"""

import tempfile
from pathlib import Path

import pytest

from services.seo.hash_utils import (
    compute_combined_hash,
    compute_source_hash,
    compute_template_hash,
    compute_template_tree_hash,
)

pytestmark = pytest.mark.unit


class TestComputeSourceHash:
    """Tests for compute_source_hash function."""

    def test_dict_produces_consistent_hash(self):
        """Same dict should produce same hash."""
        data = {"key": "value", "number": 42}
        hash1 = compute_source_hash(data)
        hash2 = compute_source_hash(data)
        assert hash1 == hash2

    def test_different_dict_produces_different_hash(self):
        """Different data should produce different hash."""
        hash1 = compute_source_hash({"key": "value1"})
        hash2 = compute_source_hash({"key": "value2"})
        assert hash1 != hash2

    def test_key_order_does_not_affect_hash(self):
        """Dict key order should not affect hash (sorted internally)."""
        hash1 = compute_source_hash({"a": 1, "b": 2, "c": 3})
        hash2 = compute_source_hash({"c": 3, "b": 2, "a": 1})
        assert hash1 == hash2

    def test_handles_nested_structures(self):
        """Should handle nested dicts and lists."""
        data = {
            "nested": {"deep": {"value": 123}},
            "list": [1, 2, 3],
            "mixed": [{"a": 1}, {"b": 2}],
        }
        result = compute_source_hash(data)
        assert len(result) == 64

    def test_handles_unicode(self):
        """Should handle unicode characters (Sanskrit, etc.)."""
        data = {
            "sanskrit": "धर्म",
            "transliteration": "dharma",
        }
        result = compute_source_hash(data)
        assert len(result) == 64

    def test_handles_none_values(self):
        """Should handle None values in data."""
        data = {"key": None, "other": "value"}
        result = compute_source_hash(data)
        assert len(result) == 64

    def test_handles_empty_dict(self):
        """Should handle empty dict."""
        result = compute_source_hash({})
        assert len(result) == 64


class TestComputeTemplateHash:
    """Tests for compute_template_hash function."""

    def test_same_content_produces_same_hash(self):
        """Same file content should produce same hash."""
        content = "<html>consistent content</html>"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f1:
            f1.write(content)
            f1.flush()
            path1 = Path(f1.name)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f2:
            f2.write(content)
            f2.flush()
            path2 = Path(f2.name)

        try:
            hash1 = compute_template_hash(path1)
            hash2 = compute_template_hash(path2)
            assert hash1 == hash2
        finally:
            path1.unlink()
            path2.unlink()

    def test_different_content_produces_different_hash(self):
        """Different content should produce different hash."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f1:
            f1.write("<html>content1</html>")
            f1.flush()
            path1 = Path(f1.name)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f2:
            f2.write("<html>content2</html>")
            f2.flush()
            path2 = Path(f2.name)

        try:
            hash1 = compute_template_hash(path1)
            hash2 = compute_template_hash(path2)
            assert hash1 != hash2
        finally:
            path1.unlink()
            path2.unlink()


class TestComputeTemplateTreeHash:
    """Tests for compute_template_tree_hash function."""

    def test_includes_all_files_in_hash(self):
        """Hash should change when any file in tree changes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base = Path(tmpdir) / "base.html"
            base.write_text("<html>base</html>")
            child = Path(tmpdir) / "child.html"
            child.write_text("<html>child</html>")

            hash1 = compute_template_tree_hash([base, child])

            # Change child
            child.write_text("<html>child modified</html>")
            hash2 = compute_template_tree_hash([base, child])

            assert hash1 != hash2

    def test_order_independent(self):
        """Hash should be consistent regardless of list order (sorted internally)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path_a = Path(tmpdir) / "a.html"
            path_a.write_text("<html>a</html>")
            path_b = Path(tmpdir) / "b.html"
            path_b.write_text("<html>b</html>")

            hash1 = compute_template_tree_hash([path_a, path_b])
            hash2 = compute_template_tree_hash([path_b, path_a])
            assert hash1 == hash2

    def test_includes_filename_in_hash(self):
        """Renamed files should produce different hash."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create file with one name
            path1 = Path(tmpdir) / "original.html"
            path1.write_text("<html>content</html>")
            hash1 = compute_template_tree_hash([path1])

            # Rename to different name
            path2 = Path(tmpdir) / "renamed.html"
            path1.rename(path2)
            hash2 = compute_template_tree_hash([path2])

            assert hash1 != hash2


class TestComputeCombinedHash:
    """Tests for compute_combined_hash function."""

    def test_different_source_produces_different_combined(self):
        """Different source hash should produce different result."""
        template_hash = "b" * 16

        hash1 = compute_combined_hash("a" * 64, template_hash)
        hash2 = compute_combined_hash("c" * 64, template_hash)
        assert hash1 != hash2

    def test_different_template_produces_different_combined(self):
        """Different template hash should produce different result."""
        source_hash = "a" * 64

        hash1 = compute_combined_hash(source_hash, "b" * 16)
        hash2 = compute_combined_hash(source_hash, "c" * 16)
        assert hash1 != hash2
