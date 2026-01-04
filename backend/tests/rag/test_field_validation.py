"""Tests for RAG field validation functions."""

import pytest

pytestmark = pytest.mark.unit

from services.rag import (
    _validate_option_structure,
    _validate_relevance,
    _validate_source_object_structure,
    _validate_source_reference,
)
from utils.validation import validate_canonical_id


class TestCanonicalIDValidation:
    """Tests for canonical ID format validation."""

    def test_valid_canonical_id(self):
        """Test valid BG_X_Y format."""
        assert validate_canonical_id("BG_2_47") is True
        assert validate_canonical_id("BG_18_63") is True
        assert validate_canonical_id("BG_1_1") is True

    def test_invalid_canonical_id_wrong_prefix(self):
        """Test rejection of wrong prefix."""
        assert validate_canonical_id("GK_2_47") is False
        assert validate_canonical_id("BG2_47") is False
        assert validate_canonical_id("bg_2_47") is False

    def test_invalid_canonical_id_non_numeric(self):
        """Test rejection of non-numeric chapters/verses."""
        assert validate_canonical_id("BG_a_b") is False
        assert validate_canonical_id("BG_2_47x") is False
        assert validate_canonical_id("BG_x_47") is False

    def test_invalid_canonical_id_non_string(self):
        """Test rejection of non-string input."""
        assert validate_canonical_id(12345) is False
        assert validate_canonical_id(None) is False
        assert validate_canonical_id({"id": "BG_2_47"}) is False


class TestRelevanceValidation:
    """Tests for relevance score validation."""

    def test_valid_relevance_bounds(self):
        """Test valid relevance values in [0.0, 1.0]."""
        assert _validate_relevance(0.0) is True
        assert _validate_relevance(0.5) is True
        assert _validate_relevance(1.0) is True
        assert _validate_relevance(0.75) is True

    def test_invalid_relevance_out_of_bounds(self):
        """Test rejection of out-of-bounds values."""
        assert _validate_relevance(-0.1) is False
        assert _validate_relevance(1.1) is False
        assert _validate_relevance(2.0) is False

    def test_valid_relevance_accepts_integers(self):
        """Test that integers in valid range are accepted."""
        assert _validate_relevance(0) is True
        assert _validate_relevance(1) is True

    def test_invalid_relevance_non_numeric(self):
        """Test rejection of non-numeric values."""
        assert _validate_relevance("0.75") is False
        assert _validate_relevance(None) is False
        assert _validate_relevance([0.75]) is False


class TestSourceReferenceValidation:
    """Tests for source reference validation."""

    def test_valid_source_reference(self):
        """Test valid source reference."""
        sources = [
            {"canonical_id": "BG_2_47", "paraphrase": "Test"},
            {"canonical_id": "BG_3_35", "paraphrase": "Test"},
        ]
        assert _validate_source_reference("BG_2_47", sources) is True
        assert _validate_source_reference("BG_3_35", sources) is True

    def test_invalid_source_reference_not_in_list(self):
        """Test rejection of undefined source reference."""
        sources = [
            {"canonical_id": "BG_2_47", "paraphrase": "Test"},
        ]
        assert _validate_source_reference("BG_18_63", sources) is False

    def test_invalid_source_reference_empty_sources(self):
        """Test rejection when source list is empty."""
        assert _validate_source_reference("BG_2_47", []) is False

    def test_invalid_source_reference_non_string(self):
        """Test rejection of non-string source reference."""
        sources = [{"canonical_id": "BG_2_47", "paraphrase": "Test"}]
        assert _validate_source_reference(123, sources) is False
        assert _validate_source_reference(None, sources) is False


class TestOptionStructureValidation:
    """Tests for option structure validation."""

    def test_valid_option_structure(self):
        """Test valid option structure."""
        option = {
            "title": "Option 1",
            "description": "Test description",
            "pros": ["Pro 1", "Pro 2"],
            "cons": ["Con 1"],
            "sources": ["BG_2_47"],
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is True
        assert msg == ""

    def test_invalid_option_not_dict(self):
        """Test rejection of non-dict option."""
        is_valid, msg = _validate_option_structure("not a dict")
        assert is_valid is False
        assert "not a dict" in msg

    def test_invalid_option_missing_title(self):
        """Test rejection of option without title."""
        option = {
            "description": "Test",
            "pros": [],
            "cons": [],
            "sources": [],
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is False
        assert "title" in msg

    def test_invalid_option_empty_title(self):
        """Test rejection of option with empty title."""
        option = {
            "title": "",
            "description": "Test",
            "pros": [],
            "cons": [],
            "sources": [],
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is False

    def test_invalid_option_pros_not_list(self):
        """Test rejection of non-list pros."""
        option = {
            "title": "Option",
            "description": "Test",
            "pros": "not a list",
            "cons": [],
            "sources": [],
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is False
        assert "pros" in msg

    def test_invalid_option_cons_not_list(self):
        """Test rejection of non-list cons."""
        option = {
            "title": "Option",
            "description": "Test",
            "pros": [],
            "cons": {"con": "value"},
            "sources": [],
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is False
        assert "cons" in msg

    def test_invalid_option_sources_not_list(self):
        """Test rejection of non-list sources."""
        option = {
            "title": "Option",
            "description": "Test",
            "pros": [],
            "cons": [],
            "sources": "BG_2_47",
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is False
        assert "sources" in msg

    def test_invalid_option_source_not_string(self):
        """Test rejection of non-string source reference in option."""
        option = {
            "title": "Option",
            "description": "Test",
            "pros": [],
            "cons": [],
            "sources": [123, "BG_2_47"],
        }
        is_valid, msg = _validate_option_structure(option)
        assert is_valid is False
        assert "source" in msg


class TestSourceObjectValidation:
    """Tests for source object (metadata) validation."""

    def test_valid_source_object(self):
        """Test valid source object structure."""
        source = {
            "canonical_id": "BG_2_47",
            "paraphrase": "Act focused on duty, not fruits.",
            "relevance": 0.95,
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is True
        assert msg == ""

    def test_invalid_source_not_dict(self):
        """Test rejection of non-dict source."""
        is_valid, msg = _validate_source_object_structure("BG_2_47")
        assert is_valid is False
        assert "not a dict" in msg

    def test_invalid_source_missing_canonical_id(self):
        """Test rejection of source without canonical_id."""
        source = {
            "paraphrase": "Test",
            "relevance": 0.8,
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is False
        assert "canonical_id" in msg

    def test_invalid_source_malformed_canonical_id(self):
        """Test rejection of malformed canonical_id."""
        source = {
            "canonical_id": "INVALID",
            "paraphrase": "Test",
            "relevance": 0.8,
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is False
        assert "invalid format" in msg

    def test_invalid_source_missing_paraphrase(self):
        """Test rejection of source without paraphrase."""
        source = {
            "canonical_id": "BG_2_47",
            "relevance": 0.8,
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is False
        assert "paraphrase" in msg

    def test_invalid_source_empty_paraphrase(self):
        """Test rejection of source with empty paraphrase."""
        source = {
            "canonical_id": "BG_2_47",
            "paraphrase": "",
            "relevance": 0.8,
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is False

    def test_invalid_source_missing_relevance(self):
        """Test rejection of source without relevance."""
        source = {
            "canonical_id": "BG_2_47",
            "paraphrase": "Test",
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is False
        assert "relevance" in msg

    def test_invalid_source_out_of_range_relevance(self):
        """Test rejection of out-of-range relevance."""
        source = {
            "canonical_id": "BG_2_47",
            "paraphrase": "Test",
            "relevance": 1.5,
        }
        is_valid, msg = _validate_source_object_structure(source)
        assert is_valid is False
        assert "relevance" in msg
