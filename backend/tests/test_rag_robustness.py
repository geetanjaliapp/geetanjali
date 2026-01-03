"""
Tests for RAG robustness enhancements: JSON extraction and field validation.

Tests the three-layer defense architecture:
1. Prompt Clarity (tested via integration with prompt fixtures)
2. Robust JSON Extraction (unit and integration tests)
3. Comprehensive Field Validation (unit and integration tests)
"""

import json

import pytest

# Mark all tests in this module as unit tests (fast, no DB required)
pytestmark = pytest.mark.unit
from unittest.mock import patch

from services.rag import (
    _validate_option_structure,
    _validate_relevance,
    _validate_source_object_structure,
    _validate_source_reference,
)
from utils.json_parsing import extract_json_from_text
from utils.validation import validate_canonical_id


class TestJSONExtraction:
    """Tests for robust JSON extraction from LLM responses."""

    def test_extract_direct_json(self):
        """Test extraction of direct JSON (perfect LLM compliance)."""
        json_data = {"title": "Test", "options": []}
        response = json.dumps(json_data)
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_with_markdown_block(self):
        """Test extraction of JSON wrapped in ```json code block."""
        json_data = {"title": "Test", "options": []}
        response = f"```json\n{json.dumps(json_data)}\n```"
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_with_generic_markdown_block(self):
        """Test extraction of JSON wrapped in generic ``` code block."""
        json_data = {"title": "Test", "options": []}
        response = f"```\n{json.dumps(json_data)}\n```"
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_in_explanation_text(self):
        """Test extraction of JSON wrapped in explanation text."""
        json_data = {"title": "Test", "options": []}
        response = (
            "Here is the JSON response:\n"
            f"{json.dumps(json_data)}\n"
            "This is the end of the response."
        )
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_multiple_markdown_blocks_returns_first_valid(self):
        """Test extraction returns first valid JSON when multiple blocks exist."""
        json_data_1 = {"id": 1, "title": "First"}
        json_data_2 = {"id": 2, "title": "Second"}
        response = (
            f"```json\n{json.dumps(json_data_1)}\n```\n\n"
            f"```json\n{json.dumps(json_data_2)}\n```"
        )
        result = extract_json_from_text(response)
        assert result == json_data_1

    def test_extract_json_with_text_before_and_after(self):
        """Test extraction of JSON with surrounding explanation text."""
        json_data = {"title": "Test", "confidence": 0.85}
        response = (
            "Based on the analysis, here is the recommendation:\n\n"
            f"{json.dumps(json_data)}\n\n"
            "Please review this carefully."
        )
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_with_nested_objects(self):
        """Test extraction of JSON with deeply nested structures."""
        json_data = {
            "options": [
                {
                    "title": "Option 1",
                    "sources": [{"id": "BG_2_47", "paraphrase": "Test"}],
                }
            ],
            "confidence": 0.92,
        }
        response = json.dumps(json_data)
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_failure_raises_valueerror(self):
        """Test that invalid JSON raises ValueError."""
        response = "This is not JSON at all, just text."
        with pytest.raises(ValueError, match="No valid JSON found"):
            extract_json_from_text(response)

    def test_extract_json_malformed_markdown_tries_next_strategy(self):
        """Test that malformed markdown blocks don't crash, try next strategy."""
        json_data = {"title": "Test"}
        # Malformed markdown followed by valid JSON
        response = "```json\n{MALFORMED JSON}\n```\n\n" f"{json.dumps(json_data)}"
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_with_unicode_content(self):
        """Test extraction of JSON with unicode characters."""
        json_data = {
            "title": "ধর্ম",  # Devanagari script
            "options": ["सामर्थ्य", "विवेक"],  # Sanskrit
        }
        response = json.dumps(json_data, ensure_ascii=False)
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_handles_escaped_quotes_in_markdown(self):
        """Test extraction of JSON with escaped quotes in markdown blocks."""
        json_data = {"title": 'Test with "quotes"', "value": 'and "double" quotes'}
        response = f"```json\n{json.dumps(json_data)}\n```"
        result = extract_json_from_text(response)
        assert result == json_data


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
        assert validate_canonical_id("bg_2_47") is False  # Case sensitive

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


class TestValidationIntegration:
    """Integration tests for validation across RAG pipeline."""

    def test_validate_output_with_invalid_sources(self):
        """Test that validate_output handles invalid sources gracefully."""
        from services.rag import RAGPipeline

        with patch("services.rag.pipeline.get_vector_store"):
            with patch("services.rag.pipeline.get_llm_service"):
                pipeline = RAGPipeline()

                output = {
                    "executive_summary": "Test",
                    "options": [
                        {
                            "title": "Option 1",
                            "description": "Test",
                            "pros": ["Pro"],
                            "cons": ["Con"],
                            "sources": ["BG_2_47"],
                        },
                        {
                            "title": "Option 2",
                            "description": "Test",
                            "pros": ["Pro"],
                            "cons": ["Con"],
                            "sources": ["BG_2_47"],
                        },
                        {
                            "title": "Option 3",
                            "description": "Test",
                            "pros": ["Pro"],
                            "cons": ["Con"],
                            "sources": ["BG_2_47"],
                        },
                    ],
                    "recommended_action": {
                        "option": 1,
                        "steps": ["Step 1"],
                        "sources": ["BG_2_47"],
                    },
                    "reflection_prompts": ["Reflect"],
                    "sources": [
                        {
                            "canonical_id": "INVALID",  # Invalid format
                            "paraphrase": "Test",
                            "relevance": 0.8,
                        },
                        {
                            "canonical_id": "BG_2_47",  # Valid
                            "paraphrase": "Test",
                            "relevance": 0.8,
                        },
                    ],
                    "confidence": 0.8,
                }

                validated = pipeline.validate_output(output)

                # Only valid source should remain
                assert len(validated["sources"]) == 1
                assert validated["sources"][0]["canonical_id"] == "BG_2_47"

    def test_validate_output_with_invalid_options_gets_fixed(self):
        """Test that validate_output fixes invalid options."""
        from services.rag import RAGPipeline

        with patch("services.rag.pipeline.get_vector_store"):
            with patch("services.rag.pipeline.get_llm_service"):
                pipeline = RAGPipeline()

                output = {
                    "executive_summary": "Test",
                    "options": [
                        {
                            "title": "",  # Empty title
                            "description": None,  # None description
                            "pros": "not a list",  # Wrong type
                            "cons": [],
                            "sources": [],
                        },
                    ],
                    "recommended_action": {"option": 1, "steps": [], "sources": []},
                    "reflection_prompts": [],
                    "sources": [],
                    "confidence": 0.8,
                }

                validated = pipeline.validate_output(output)

                # Option should be fixed
                option = validated["options"][0]
                assert isinstance(option["title"], str)
                assert isinstance(option["description"], str)
                assert isinstance(option["pros"], list)

    def test_markdown_json_extraction_preserves_structure(self):
        """Test that markdown-wrapped JSON extraction preserves data structure."""
        from utils.json_parsing import extract_json_from_text

        response_data = {
            "executive_summary": "Test",
            "options": [
                {
                    "title": "Option",
                    "description": "Test",
                    "pros": ["Pro 1"],
                    "cons": ["Con 1"],
                    "sources": ["BG_2_47"],
                }
            ],
            "recommended_action": {"option": 1, "steps": ["Step 1"], "sources": []},
            "reflection_prompts": ["Reflect"],
            "sources": [
                {
                    "canonical_id": "BG_2_47",
                    "paraphrase": "Test",
                    "relevance": 0.8,
                }
            ],
            "confidence": 0.8,
        }
        response = f"```json\n{json.dumps(response_data)}\n```"

        result = extract_json_from_text(response)

        # Verify structure is preserved through extraction
        assert result["executive_summary"] == "Test"
        assert len(result["options"]) == 1
        assert result["options"][0]["title"] == "Option"
        assert isinstance(result["options"][0]["pros"], list)

    def test_filter_source_references_with_string_sources(self):
        """Test that _filter_source_references handles string sources (legacy format)."""
        from services.rag import _filter_source_references

        # Simulate LLM returning string sources instead of dict sources
        output = {
            "executive_summary": "Test",
            "options": [
                {
                    "title": "Option 1",
                    "description": "Test",
                    "pros": ["Pro"],
                    "cons": ["Con"],
                    "sources": ["BG_2_47", "BG_3_35"],  # Valid refs
                },
                {
                    "title": "Option 2",
                    "description": "Test",
                    "pros": ["Pro"],
                    "cons": ["Con"],
                    "sources": ["INVALID", "BG_2_47"],  # One invalid
                },
            ],
            "recommended_action": {
                "option": 1,
                "steps": ["Step 1"],
                "sources": ["BG_2_47"],
            },
            # Legacy string sources format (not dict format)
            "sources": ["BG_2_47", "BG_3_35", "BG_18_66"],
        }

        # Should not raise "'str' object has no attribute 'get'"
        _filter_source_references(output)

        # Option 1 sources should remain (both valid)
        assert output["options"][0]["sources"] == ["BG_2_47", "BG_3_35"]
        # Option 2 should have invalid source removed
        assert output["options"][1]["sources"] == ["BG_2_47"]
        # recommended_action sources should remain valid
        assert output["recommended_action"]["sources"] == ["BG_2_47"]

    def test_filter_source_references_with_mixed_sources(self):
        """Test that _filter_source_references handles mix of dict and string sources."""
        from services.rag import _filter_source_references

        output = {
            "executive_summary": "Test",
            "options": [
                {
                    "title": "Option 1",
                    "description": "Test",
                    "pros": ["Pro"],
                    "cons": ["Con"],
                    "sources": ["BG_2_47"],
                },
            ],
            "recommended_action": {
                "option": 1,
                "steps": ["Step 1"],
                "sources": ["BG_2_47"],
            },
            # Dict format sources (normal case)
            "sources": [
                {"canonical_id": "BG_2_47", "paraphrase": "Test", "relevance": 0.8},
                {"canonical_id": "BG_3_35", "paraphrase": "Test", "relevance": 0.7},
            ],
        }

        # Should not raise any errors
        _filter_source_references(output)

        # Option sources should remain valid
        assert output["options"][0]["sources"] == ["BG_2_47"]
