"""Tests for robust JSON extraction from LLM responses."""

import json

import pytest

pytestmark = pytest.mark.unit

from utils.json_parsing import extract_json_from_text


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
        response = "```json\n{MALFORMED JSON}\n```\n\n" f"{json.dumps(json_data)}"
        result = extract_json_from_text(response)
        assert result == json_data

    def test_extract_json_with_unicode_content(self):
        """Test extraction of JSON with unicode characters."""
        json_data = {
            "title": "ধর্ম",
            "options": ["सामर्थ्य", "विवेक"],
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
