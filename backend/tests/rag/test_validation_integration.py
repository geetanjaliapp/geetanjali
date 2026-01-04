"""Integration tests for validation across RAG pipeline."""

import json

import pytest
from unittest.mock import patch

pytestmark = pytest.mark.unit

from utils.json_parsing import extract_json_from_text


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
                            "canonical_id": "INVALID",
                            "paraphrase": "Test",
                            "relevance": 0.8,
                        },
                        {
                            "canonical_id": "BG_2_47",
                            "paraphrase": "Test",
                            "relevance": 0.8,
                        },
                    ],
                    "confidence": 0.8,
                }

                validated = pipeline.validate_output(output)

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
                            "title": "",
                            "description": None,
                            "pros": "not a list",
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

                option = validated["options"][0]
                assert isinstance(option["title"], str)
                assert isinstance(option["description"], str)
                assert isinstance(option["pros"], list)

    def test_markdown_json_extraction_preserves_structure(self):
        """Test that markdown-wrapped JSON extraction preserves data structure."""
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

        assert result["executive_summary"] == "Test"
        assert len(result["options"]) == 1
        assert result["options"][0]["title"] == "Option"
        assert isinstance(result["options"][0]["pros"], list)

    def test_filter_source_references_with_string_sources(self):
        """Test that _filter_source_references handles string sources (legacy format)."""
        from services.rag import _filter_source_references

        output = {
            "executive_summary": "Test",
            "options": [
                {
                    "title": "Option 1",
                    "description": "Test",
                    "pros": ["Pro"],
                    "cons": ["Con"],
                    "sources": ["BG_2_47", "BG_3_35"],
                },
                {
                    "title": "Option 2",
                    "description": "Test",
                    "pros": ["Pro"],
                    "cons": ["Con"],
                    "sources": ["INVALID", "BG_2_47"],
                },
            ],
            "recommended_action": {
                "option": 1,
                "steps": ["Step 1"],
                "sources": ["BG_2_47"],
            },
            "sources": ["BG_2_47", "BG_3_35", "BG_18_66"],
        }

        _filter_source_references(output)

        assert output["options"][0]["sources"] == ["BG_2_47", "BG_3_35"]
        assert output["options"][1]["sources"] == ["BG_2_47"]
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
            "sources": [
                {"canonical_id": "BG_2_47", "paraphrase": "Test", "relevance": 0.8},
                {"canonical_id": "BG_3_35", "paraphrase": "Test", "relevance": 0.7},
            ],
        }

        _filter_source_references(output)

        assert output["options"][0]["sources"] == ["BG_2_47"]
