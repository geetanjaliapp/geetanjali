"""Tests for Pass 0 rejection message generation.

Tests cover:
- LLM-generated contextual rejection messages
- Fallback to static templates
- Rejection output structure
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.rag.multipass.acceptance import AcceptanceResult, RejectionCategory
from services.rag.multipass.rejection_response import (
    create_rejection_output,
    generate_rejection_message,
    get_fallback_message,
)

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


class TestGetFallbackMessage:
    """Test static fallback messages."""

    def test_not_dilemma_fallback(self):
        """Test fallback for NOT_DILEMMA category."""
        message = get_fallback_message(RejectionCategory.NOT_DILEMMA)
        assert "factual question" in message.lower()
        assert "stakeholders" in message.lower()

    def test_unethical_core_fallback(self):
        """Test fallback for UNETHICAL_CORE category."""
        message = get_fallback_message(RejectionCategory.UNETHICAL_CORE)
        assert "harmful" in message.lower() or "illegal" in message.lower()

    def test_too_vague_fallback(self):
        """Test fallback for TOO_VAGUE category."""
        message = get_fallback_message(RejectionCategory.TOO_VAGUE)
        assert "stakeholders" in message.lower()
        assert "values" in message.lower()

    def test_harmful_intent_fallback(self):
        """Test fallback for HARMFUL_INTENT category."""
        message = get_fallback_message(RejectionCategory.HARMFUL_INTENT)
        assert "harm" in message.lower()

    def test_format_error_fallback(self):
        """Test fallback for FORMAT_ERROR category."""
        message = get_fallback_message(RejectionCategory.FORMAT_ERROR)
        assert "50-5000 characters" in message

    def test_unknown_category_fallback(self):
        """Test fallback for unknown category returns generic message."""
        # ACCEPTED is not a rejection category, but tests fallback path
        message = get_fallback_message(RejectionCategory.ACCEPTED)
        assert "ethical dilemma" in message.lower()


class TestGenerateRejectionMessage:
    """Test LLM-generated rejection messages."""

    @pytest.mark.asyncio
    async def test_successful_llm_generation(self):
        """Test successful LLM message generation."""
        mock_llm = MagicMock()  # LLM service generate() is synchronous
        mock_llm.generate.return_value = {
            "text": (
                "Thank you for reaching out. Your question seems to be seeking "
                "factual information rather than exploring an ethical dilemma. "
                "We'd love to help if you can share more about the competing values "
                "or duties you're wrestling with."
            )
        }

        message = await generate_rejection_message(
            case_description="What is the meaning of dharma?",
            rejection_reason="Query is factual, not an ethical dilemma",
            category=RejectionCategory.NOT_DILEMMA,
            llm_service=mock_llm,
        )

        assert len(message) >= 50
        assert "factual" in message.lower() or "dilemma" in message.lower()
        mock_llm.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_llm_timeout_uses_fallback(self):
        """Test that timeout falls back to static message."""
        mock_llm = MagicMock()  # LLM service generate() is synchronous
        mock_llm.generate.side_effect = TimeoutError("Request timed out")

        message = await generate_rejection_message(
            case_description="Some case description",
            rejection_reason="too_vague",
            category=RejectionCategory.TOO_VAGUE,
            llm_service=mock_llm,
        )

        # Should get fallback message
        assert "stakeholders" in message.lower()

    @pytest.mark.asyncio
    async def test_llm_error_uses_fallback(self):
        """Test that LLM error falls back to static message."""
        mock_llm = MagicMock()  # LLM service generate() is synchronous
        mock_llm.generate.side_effect = Exception("LLM service unavailable")

        message = await generate_rejection_message(
            case_description="Some case description",
            rejection_reason="harmful_intent",
            category=RejectionCategory.HARMFUL_INTENT,
            llm_service=mock_llm,
        )

        # Should get fallback message
        assert "harm" in message.lower()

    @pytest.mark.asyncio
    async def test_short_llm_response_uses_fallback(self):
        """Test that too-short LLM response falls back."""
        mock_llm = MagicMock()  # LLM service generate() is synchronous
        mock_llm.generate.return_value = {"text": "Too short"}

        message = await generate_rejection_message(
            case_description="Some case description",
            rejection_reason="not_dilemma",
            category=RejectionCategory.NOT_DILEMMA,
            llm_service=mock_llm,
        )

        # Should get fallback message (response was too short)
        assert "factual" in message.lower()

    @pytest.mark.asyncio
    async def test_truncates_long_description(self):
        """Test that long descriptions are truncated."""
        mock_llm = MagicMock()  # LLM service generate() is synchronous
        mock_llm.generate.return_value = {"text": "A" * 100}  # Valid length

        long_description = "word " * 200  # ~1000 chars

        await generate_rejection_message(
            case_description=long_description,
            rejection_reason="too_vague",
            category=RejectionCategory.TOO_VAGUE,
            llm_service=mock_llm,
        )

        # Check that the prompt was called with truncated description
        call_args = mock_llm.generate.call_args
        prompt = call_args.kwargs.get("prompt", call_args.args[0] if call_args.args else "")
        assert "..." in prompt  # Truncation indicator


class TestCreateRejectionOutput:
    """Test rejection output structure."""

    @pytest.mark.asyncio
    async def test_creates_valid_output_structure(self):
        """Test that output has all required fields."""
        acceptance_result = AcceptanceResult(
            accepted=False,
            category=RejectionCategory.NOT_DILEMMA,
            reason="This is a factual question, not an ethical dilemma",
            stage_failed=1,
        )

        output = await create_rejection_output(
            case_description="What is karma?",
            acceptance_result=acceptance_result,
            llm_service=None,  # Use fallback
        )

        # Check required fields
        assert "suggested_title" in output
        assert "executive_summary" in output
        assert "options" in output
        assert len(output["options"]) == 3
        assert "recommended_action" in output
        assert "reflection_prompts" in output
        assert "sources" in output
        assert "confidence" in output
        assert "scholar_flag" in output

        # Check rejection-specific fields
        assert output["confidence"] == 0.0
        assert output["scholar_flag"] is True
        assert output["rejection_category"] == "not_dilemma"

    @pytest.mark.asyncio
    async def test_options_have_required_fields(self):
        """Test that each option has required fields."""
        acceptance_result = AcceptanceResult(
            accepted=False,
            category=RejectionCategory.TOO_VAGUE,
            reason="Not enough detail",
            stage_failed=1,
        )

        output = await create_rejection_output(
            case_description="Help me",
            acceptance_result=acceptance_result,
            llm_service=None,
        )

        for option in output["options"]:
            assert "title" in option
            assert "description" in option
            assert "pros" in option
            assert "cons" in option
            assert "sources" in option

    @pytest.mark.asyncio
    async def test_uses_llm_for_message_when_provided(self):
        """Test that LLM is used when service is provided."""
        mock_llm = MagicMock()  # LLM service generate() is synchronous
        mock_llm.generate.return_value = {
            "text": "Custom rejection message from LLM that is long enough to pass validation."
        }

        acceptance_result = AcceptanceResult(
            accepted=False,
            category=RejectionCategory.NOT_DILEMMA,
            reason="Factual question",
            stage_failed=2,
        )

        output = await create_rejection_output(
            case_description="What is the capital of India?",
            acceptance_result=acceptance_result,
            llm_service=mock_llm,
        )

        assert "Custom rejection message" in output["executive_summary"]
        mock_llm.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_recommended_action_has_steps(self):
        """Test that recommended action has guidance steps."""
        acceptance_result = AcceptanceResult(
            accepted=False,
            category=RejectionCategory.TOO_VAGUE,
            reason="Too vague",
            stage_failed=1,
        )

        output = await create_rejection_output(
            case_description="Help",
            acceptance_result=acceptance_result,
            llm_service=None,
        )

        assert "option" in output["recommended_action"]
        assert "steps" in output["recommended_action"]
        assert len(output["recommended_action"]["steps"]) >= 3
