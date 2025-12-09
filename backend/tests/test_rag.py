"""Tests for RAG pipeline with mocked vector store and LLM."""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock


# Sample case data for testing
SAMPLE_CASE = {
    "id": "test-case-123",
    "title": "Ethical dilemma at work",
    "description": "I discovered my colleague is taking credit for my work. Should I confront them?",
    "role": "Employee",
    "stakeholders": ["self", "colleague", "manager"],
    "constraints": ["workplace relationships", "career growth"],
    "horizon": "short_term",
    "sensitivity": "medium",
}

# Sample vector store results
MOCK_VECTOR_RESULTS = {
    "ids": ["ch02_v47", "ch03_v35", "ch18_v66"],
    "documents": [
        "You have the right to action, but never to its fruits.",
        "Better is one's own dharma, though imperfectly performed.",
        "Abandon all dharmas and surrender to Me alone.",
    ],
    "distances": [0.15, 0.22, 0.28],
    "metadatas": [
        {"chapter": 2, "verse": 47, "canonical_id": "ch02_v47"},
        {"chapter": 3, "verse": 35, "canonical_id": "ch03_v35"},
        {"chapter": 18, "verse": 66, "canonical_id": "ch18_v66"},
    ],
}

# Sample LLM response
MOCK_LLM_RESPONSE = {
    "executive_summary": "Consider approaching this situation with clarity of purpose while maintaining dharmic conduct.",
    "options": [
        {
            "title": "Direct Approach",
            "description": "Have a private conversation with your colleague.",
            "pros": ["Clear communication", "Immediate resolution"],
            "cons": ["Potential conflict", "May strain relationship"],
            "sources": ["ch02_v47"],
        },
        {
            "title": "Document and Escalate",
            "description": "Document your contributions and discuss with your manager.",
            "pros": ["Official record", "Manager awareness"],
            "cons": ["May seem adversarial", "Office politics"],
            "sources": ["ch03_v35"],
        },
        {
            "title": "Focus on Future",
            "description": "Let go of past incidents and ensure proper attribution going forward.",
            "pros": ["Peace of mind", "Forward-looking"],
            "cons": ["Past injustice unaddressed"],
            "sources": ["ch18_v66"],
        },
    ],
    "recommended_action": {
        "option": 1,
        "steps": [
            "Reflect on your intentions and desired outcome",
            "Choose a neutral time and place for the conversation",
            "Express your observations without accusations",
            "Listen to their perspective",
            "Agree on fair attribution going forward",
        ],
        "sources": ["ch02_v47", "ch03_v35"],
    },
    "reflection_prompts": [
        "What outcome truly serves your growth?",
        "How would you want to be approached in their position?",
        "What does righteousness look like in this situation?",
    ],
    "sources": [
        {"canonical_id": "ch02_v47", "paraphrase": "Focus on your duty, not the results."},
        {"canonical_id": "ch03_v35", "paraphrase": "Your own dharma is best."},
        {"canonical_id": "ch18_v66", "paraphrase": "Surrender attachment to outcomes."},
    ],
    "confidence": 0.82,
}


class MockVectorStore:
    """Mock vector store for testing."""

    def search(self, query: str, top_k: int = 5):
        return MOCK_VECTOR_RESULTS


class MockLLMService:
    """Mock LLM service for testing."""

    def generate(self, prompt: str, system_prompt: str, temperature: float = 0.7, **kwargs):
        return {
            "response": json.dumps(MOCK_LLM_RESPONSE),
            "provider": "mock",
        }


@pytest.fixture
def mock_vector_store():
    """Fixture for mocked vector store."""
    return MockVectorStore()


@pytest.fixture
def mock_llm_service():
    """Fixture for mocked LLM service."""
    return MockLLMService()


class TestRAGPipelineUnit:
    """Unit tests for RAG pipeline components."""

    def test_retrieve_verses_formats_results(self, mock_vector_store):
        """Test that vector store results are formatted correctly."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=MockLLMService()):
                pipeline = RAGPipeline()
                verses = pipeline.retrieve_verses("test query", top_k=3)

        assert len(verses) == 3
        assert verses[0]["canonical_id"] == "ch02_v47"
        assert verses[0]["relevance"] == pytest.approx(0.85, rel=0.01)
        assert "document" in verses[0]
        assert "metadata" in verses[0]

    def test_retrieve_verses_converts_distance_to_relevance(self, mock_vector_store):
        """Test distance to relevance conversion."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=MockLLMService()):
                pipeline = RAGPipeline()
                verses = pipeline.retrieve_verses("test query")

        # relevance = 1.0 - distance
        assert verses[0]["relevance"] == pytest.approx(1.0 - 0.15, rel=0.01)
        assert verses[1]["relevance"] == pytest.approx(1.0 - 0.22, rel=0.01)

    def test_construct_context_builds_prompt(self, mock_vector_store, mock_llm_service):
        """Test context construction from case data and verses."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                pipeline = RAGPipeline()
                verses = pipeline.retrieve_verses("test query")
                prompt = pipeline.construct_context(SAMPLE_CASE, verses)

        assert "Ethical dilemma" in prompt
        assert "Employee" in prompt
        assert "ch02_v47" in prompt or "Chapter 2" in prompt

    def test_generate_brief_parses_json(self, mock_vector_store, mock_llm_service):
        """Test LLM response parsing."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                pipeline = RAGPipeline()
                result, is_policy_violation = pipeline.generate_brief("test prompt")

        assert is_policy_violation is False
        assert "executive_summary" in result
        assert "options" in result
        assert len(result["options"]) == 3
        assert result["confidence"] == 0.82

    def test_generate_brief_handles_markdown_wrapped_json(self, mock_vector_store):
        """Test parsing JSON wrapped in markdown code blocks."""
        from services.rag import RAGPipeline

        class MarkdownLLM:
            def generate(self, **kwargs):
                return {
                    "response": f"```json\n{json.dumps(MOCK_LLM_RESPONSE)}\n```",
                    "provider": "mock",
                }

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=MarkdownLLM()):
                pipeline = RAGPipeline()
                result, is_policy_violation = pipeline.generate_brief("test prompt")

        assert is_policy_violation is False
        assert "executive_summary" in result
        assert result["confidence"] == 0.82

    def test_validate_output_sets_scholar_flag(self, mock_vector_store, mock_llm_service):
        """Test scholar flag is set for low confidence outputs."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                pipeline = RAGPipeline()

                # Test high confidence - no scholar flag
                high_conf_output = {**MOCK_LLM_RESPONSE, "confidence": 0.85}
                validated = pipeline.validate_output(high_conf_output)
                assert validated["scholar_flag"] is False

                # Test low confidence - scholar flag set
                low_conf_output = {**MOCK_LLM_RESPONSE, "confidence": 0.4}
                validated = pipeline.validate_output(low_conf_output)
                assert validated["scholar_flag"] is True

    def test_validate_output_sets_defaults(self, mock_vector_store, mock_llm_service):
        """Test missing fields get defaults."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                pipeline = RAGPipeline()

                incomplete_output = {"executive_summary": "Test"}
                validated = pipeline.validate_output(incomplete_output)

        # When all options are missing (num_options == 0), confidence is set to 0.4
        # (lower confidence for completely generated default options)
        assert validated["confidence"] == 0.4
        assert validated["scholar_flag"] is True


class TestRAGPipelineIntegration:
    """Integration tests for full RAG pipeline."""

    def test_full_pipeline_run(self, mock_vector_store, mock_llm_service):
        """Test complete pipeline execution."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                with patch("services.rag.SessionLocal") as mock_session:
                    # Mock database session for enrichment
                    mock_session.return_value.__enter__ = Mock(return_value=MagicMock())
                    mock_session.return_value.__exit__ = Mock(return_value=None)
                    mock_session.return_value.close = Mock()

                    pipeline = RAGPipeline()
                    result, is_policy_violation = pipeline.run(SAMPLE_CASE)

        # Verify result structure
        assert is_policy_violation is False
        assert "executive_summary" in result
        assert "options" in result
        assert "recommended_action" in result
        assert "reflection_prompts" in result
        assert "sources" in result
        assert "confidence" in result
        assert len(result["options"]) == 3

    def test_pipeline_fallback_on_vector_failure(self, mock_llm_service):
        """Test graceful degradation when vector store fails."""
        from services.rag import RAGPipeline

        class FailingVectorStore:
            def search(self, query, top_k=5):
                raise Exception("Vector store unavailable")

        with patch("services.rag.get_vector_store", return_value=FailingVectorStore()):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                pipeline = RAGPipeline()
                result, is_policy_violation = pipeline.run(SAMPLE_CASE)

        # Should still return a valid response
        assert is_policy_violation is False
        assert "executive_summary" in result
        # Should be flagged as degraded
        assert result.get("scholar_flag", False) is True or result.get("confidence", 1.0) <= 0.5

    def test_pipeline_fallback_on_llm_failure(self, mock_vector_store):
        """Test fallback response when LLM fails."""
        from services.rag import RAGPipeline

        class FailingLLM:
            def generate(self, **kwargs):
                raise Exception("LLM unavailable")

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=FailingLLM()):
                with patch("services.rag.SessionLocal") as mock_session:
                    mock_session.return_value.close = Mock()

                    pipeline = RAGPipeline()
                    result, is_policy_violation = pipeline.run(SAMPLE_CASE)

        # Should return fallback response (not policy violation, just failure)
        assert is_policy_violation is False
        assert "executive_summary" in result
        assert result["scholar_flag"] is True
        assert result["confidence"] < 0.5

    def test_pipeline_handles_empty_verses(self, mock_llm_service):
        """Test pipeline behavior with empty verse results."""
        from services.rag import RAGPipeline

        class EmptyVectorStore:
            def search(self, query, top_k=5):
                return {"ids": [], "documents": [], "distances": [], "metadatas": []}

        with patch("services.rag.get_vector_store", return_value=EmptyVectorStore()):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                pipeline = RAGPipeline()
                result, is_policy_violation = pipeline.run(SAMPLE_CASE)

        # Should complete with warning (not policy violation)
        assert is_policy_violation is False
        assert "executive_summary" in result
        # Should flag low confidence
        assert result.get("warning") == "Generated without verse retrieval" or result["confidence"] <= 0.5


class TestLLMRefusalDetection:
    """Tests for LLM refusal detection (content policy violations)."""

    def test_detects_llm_refusal_response(self, mock_vector_store):
        """Test that LLM refusal is detected and returns policy violation response."""
        from services.rag import RAGPipeline

        class RefusingLLM:
            def generate(self, **kwargs):
                return {
                    "response": "I can't assist with this request as it contains inappropriate content.",
                    "provider": "mock",
                }

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=RefusingLLM()):
                with patch("services.rag.SessionLocal") as mock_session:
                    mock_session.return_value.close = Mock()
                    pipeline = RAGPipeline()
                    result, is_policy_violation = pipeline.run(SAMPLE_CASE)

        # Should detect as policy violation
        assert is_policy_violation is True
        assert result.get("policy_violation") is True
        assert result["confidence"] == 0.0
        assert "executive_summary" in result

    def test_normal_response_not_flagged_as_refusal(self, mock_vector_store, mock_llm_service):
        """Test that normal responses are not flagged as refusals."""
        from services.rag import RAGPipeline

        with patch("services.rag.get_vector_store", return_value=mock_vector_store):
            with patch("services.rag.get_llm_service", return_value=mock_llm_service):
                with patch("services.rag.SessionLocal") as mock_session:
                    mock_session.return_value.__enter__ = Mock(return_value=MagicMock())
                    mock_session.return_value.__exit__ = Mock(return_value=None)
                    mock_session.return_value.close = Mock()

                    pipeline = RAGPipeline()
                    result, is_policy_violation = pipeline.run(SAMPLE_CASE)

        assert is_policy_violation is False
        assert result.get("policy_violation") is not True


class TestPromptConstruction:
    """Tests for prompt building."""

    def test_build_user_prompt_includes_case_fields(self):
        """Test user prompt includes all case fields."""
        from services.prompts import build_user_prompt

        prompt = build_user_prompt(SAMPLE_CASE, [])

        assert "Ethical dilemma" in prompt
        assert "Employee" in prompt
        assert "colleague" in prompt or "manager" in prompt
        assert "workplace relationships" in prompt or "career growth" in prompt

    def test_build_user_prompt_includes_verses(self):
        """Test user prompt includes retrieved verses."""
        from services.prompts import build_user_prompt

        verses = [
            {
                "document": "You have the right to action, but never to its fruits.",
                "relevance": 0.85,
                "metadata": {
                    "canonical_id": "ch02_v47",
                    "chapter": 2,
                    "verse": 47,
                    "paraphrase": "Focus on your actions, not outcomes",
                },
            }
        ]

        prompt = build_user_prompt(SAMPLE_CASE, verses)

        assert "ch02_v47" in prompt or "Chapter 2" in prompt
        assert "action" in prompt.lower()

    def test_build_ollama_prompt_is_simplified(self):
        """Test Ollama prompt is shorter/simpler."""
        from services.prompts import build_user_prompt, build_ollama_prompt

        verses = [
            {
                "canonical_id": "ch02_v47",
                "document": "Test verse content",
                "relevance": 0.85,
                "metadata": {},
            }
        ]

        full_prompt = build_user_prompt(SAMPLE_CASE, verses)
        ollama_prompt = build_ollama_prompt(SAMPLE_CASE, verses)

        # Ollama prompt should be more concise
        assert len(ollama_prompt) <= len(full_prompt)
