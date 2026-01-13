"""Tests for multi-pass consultation orchestrator.

Tests cover:
- Full pipeline execution with mocked passes
- Acceptance rejection handling
- Pass failure and fallback behavior
- Audit trail creation
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.rag.multipass.acceptance import AcceptanceResult, RejectionCategory
from services.rag.multipass.orchestrator import (
    MultiPassOrchestrator,
    MultiPassResult,
    run_multipass_consultation,
)
from services.rag.multipass.passes import PassResult, PassStatus

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.commit = MagicMock()
    session.refresh = MagicMock()
    session.close = MagicMock()
    return session


@pytest.fixture
def mock_consultation():
    """Create a mock consultation object."""
    consultation = MagicMock()
    consultation.id = "test-consultation-id"
    return consultation


class TestMultiPassResult:
    """Test MultiPassResult dataclass."""

    def test_success_result(self):
        """Test creating a successful result."""
        result = MultiPassResult(
            success=True,
            result_json={"executive_summary": "Test"},
            consultation_id="test-id",
            passes_completed=4,
            total_duration_ms=5000,
        )
        assert result.success
        assert result.result_json is not None
        assert result.passes_completed == 4
        assert not result.fallback_used

    def test_failure_result(self):
        """Test creating a failure result."""
        result = MultiPassResult(
            success=False,
            is_policy_violation=True,
            rejection_reason="Not a dilemma",
            consultation_id="test-id",
            passes_completed=0,
        )
        assert not result.success
        assert result.is_policy_violation
        assert result.rejection_reason == "Not a dilemma"

    def test_fallback_result(self):
        """Test creating a fallback result."""
        result = MultiPassResult(
            success=True,
            result_json={"confidence": 0.4},
            consultation_id="test-id",
            passes_completed=3,
            fallback_used=True,
            fallback_reason="Structure pass failed",
        )
        assert result.success
        assert result.fallback_used
        assert result.fallback_reason is not None


@pytest.mark.asyncio
class TestMultiPassOrchestrator:
    """Test MultiPassOrchestrator class."""

    @patch("services.rag.multipass.orchestrator.SessionLocal")
    @patch("services.rag.multipass.orchestrator.get_llm_service")
    @patch("services.rag.multipass.orchestrator.RAGPipeline")
    async def test_successful_pipeline(
        self,
        mock_rag_pipeline,
        mock_llm_service,
        mock_session_local,
        mock_db_session,
        mock_consultation,
    ):
        """Test successful execution of all passes."""
        # Setup mocks
        mock_session_local.return_value = mock_db_session
        mock_db_session.refresh = lambda x: setattr(x, 'id', mock_consultation.id)

        mock_rag = MagicMock()
        mock_rag.retrieve_verses.return_value = [
            {"canonical_id": "BG_2_47", "metadata": {"translation_en": "Test verse"}}
        ]
        mock_rag.enrich_verses_with_translations.return_value = mock_rag.retrieve_verses.return_value
        mock_rag_pipeline.return_value = mock_rag

        # Mock all passes
        with patch("services.rag.multipass.orchestrator.run_acceptance_pass") as mock_acceptance, \
             patch("services.rag.multipass.orchestrator.run_draft_pass") as mock_draft, \
             patch("services.rag.multipass.orchestrator.run_critique_pass") as mock_critique, \
             patch("services.rag.multipass.orchestrator.run_refine_pass") as mock_refine, \
             patch("services.rag.multipass.orchestrator.run_structure_pass") as mock_structure:

            # Configure pass results
            mock_acceptance.return_value = AcceptanceResult(
                accepted=True,
                category=RejectionCategory.ACCEPTED,
                reason="Valid dilemma",
            )

            mock_draft.return_value = PassResult(
                pass_number=1,
                pass_name="draft",
                status=PassStatus.SUCCESS,
                output_text="This is a draft response about ethical considerations...",
            )

            mock_critique.return_value = PassResult(
                pass_number=2,
                pass_name="critique",
                status=PassStatus.SUCCESS,
                output_text="The draft could be improved by...",
            )

            mock_refine.return_value = PassResult(
                pass_number=3,
                pass_name="refine",
                status=PassStatus.SUCCESS,
                output_text="This is the refined response with improvements...",
            )

            mock_structure.return_value = PassResult(
                pass_number=4,
                pass_name="structure",
                status=PassStatus.SUCCESS,
                output_json={
                    "executive_summary": "Test summary",
                    "options": [
                        {"title": "Option 1", "description": "First path"},
                        {"title": "Option 2", "description": "Second path"},
                        {"title": "Option 3", "description": "Third path"},
                    ],
                    "recommended_action": {"option": 1, "steps": ["Step 1"]},
                    "reflection_prompts": ["Question 1"],
                    "sources": [{"canonical_id": "BG_2_47"}],
                    "confidence": 0.85,
                },
            )

            # Run orchestrator
            orchestrator = MultiPassOrchestrator("test-case-id")
            result = await orchestrator.run("Test Title", "Test description")

            # Verify result
            assert result.success
            assert result.result_json is not None
            assert result.passes_completed == 4
            assert not result.fallback_used

            # Verify all passes were called
            mock_acceptance.assert_called_once()
            mock_draft.assert_called_once()
            mock_critique.assert_called_once()
            mock_refine.assert_called_once()
            mock_structure.assert_called_once()

    @patch("services.rag.multipass.orchestrator.SessionLocal")
    @patch("services.rag.multipass.orchestrator.get_llm_service")
    @patch("services.rag.multipass.orchestrator.RAGPipeline")
    async def test_acceptance_rejection(
        self,
        mock_rag_pipeline,
        mock_llm_service,
        mock_session_local,
        mock_db_session,
        mock_consultation,
    ):
        """Test pipeline stops when acceptance rejects."""
        # Setup mocks
        mock_session_local.return_value = mock_db_session
        mock_db_session.refresh = lambda x: setattr(x, 'id', mock_consultation.id)

        mock_rag = MagicMock()
        mock_rag.retrieve_verses.return_value = []
        mock_rag.enrich_verses_with_translations.return_value = []
        mock_rag_pipeline.return_value = mock_rag

        with patch("services.rag.multipass.orchestrator.run_acceptance_pass", new_callable=AsyncMock) as mock_acceptance, \
             patch("services.rag.multipass.orchestrator.run_draft_pass") as mock_draft:

            mock_acceptance.return_value = AcceptanceResult(
                accepted=False,
                category=RejectionCategory.NOT_DILEMMA,
                reason="This is a factual question",
                stage_failed=1,
            )

            orchestrator = MultiPassOrchestrator("test-case-id")
            result = await orchestrator.run("Test", "What is 2+2?")

            # Verify result - rejection returns success=True with is_policy_violation=True
            # (policy violation is not a failure, it's a successful rejection)
            assert result.success
            assert result.is_policy_violation
            assert result.rejection_reason == "This is a factual question"
            assert result.passes_completed == 0

            # Draft should not be called
            mock_draft.assert_not_called()

    @patch("services.rag.multipass.orchestrator.SessionLocal")
    @patch("services.rag.multipass.orchestrator.get_llm_service")
    @patch("services.rag.multipass.orchestrator.RAGPipeline")
    async def test_draft_failure(
        self,
        mock_rag_pipeline,
        mock_llm_service,
        mock_session_local,
        mock_db_session,
        mock_consultation,
    ):
        """Test pipeline fails when draft pass fails."""
        # Setup mocks
        mock_session_local.return_value = mock_db_session
        mock_db_session.refresh = lambda x: setattr(x, 'id', mock_consultation.id)

        mock_rag = MagicMock()
        mock_rag.retrieve_verses.return_value = [{"canonical_id": "BG_2_47"}]
        mock_rag.enrich_verses_with_translations.return_value = mock_rag.retrieve_verses.return_value
        mock_rag_pipeline.return_value = mock_rag

        with patch("services.rag.multipass.orchestrator.run_acceptance_pass") as mock_acceptance, \
             patch("services.rag.multipass.orchestrator.run_draft_pass") as mock_draft:

            mock_acceptance.return_value = AcceptanceResult(
                accepted=True,
                category=RejectionCategory.ACCEPTED,
                reason="Valid",
            )

            mock_draft.return_value = PassResult(
                pass_number=1,
                pass_name="draft",
                status=PassStatus.ERROR,
                error_message="LLM timeout",
            )

            orchestrator = MultiPassOrchestrator("test-case-id")
            result = await orchestrator.run("Test", "Ethical dilemma description")

            # Verify result
            assert not result.success
            assert result.passes_completed == 0
            assert "failed_pass" in result.metadata

    @patch("services.rag.multipass.orchestrator.SessionLocal")
    @patch("services.rag.multipass.orchestrator.get_llm_service")
    @patch("services.rag.multipass.orchestrator.RAGPipeline")
    async def test_critique_timeout_recoverable(
        self,
        mock_rag_pipeline,
        mock_llm_service,
        mock_session_local,
        mock_db_session,
        mock_consultation,
    ):
        """Test pipeline continues when critique times out (SKIPPED is recoverable)."""
        # Setup mocks
        mock_session_local.return_value = mock_db_session
        mock_db_session.refresh = lambda x: setattr(x, 'id', mock_consultation.id)

        mock_rag = MagicMock()
        mock_rag.retrieve_verses.return_value = [{"canonical_id": "BG_2_47"}]
        mock_rag.enrich_verses_with_translations.return_value = mock_rag.retrieve_verses.return_value
        mock_rag_pipeline.return_value = mock_rag

        with patch("services.rag.multipass.orchestrator.run_acceptance_pass") as mock_acceptance, \
             patch("services.rag.multipass.orchestrator.run_draft_pass") as mock_draft, \
             patch("services.rag.multipass.orchestrator.run_critique_pass") as mock_critique, \
             patch("services.rag.multipass.orchestrator.run_refine_pass") as mock_refine, \
             patch("services.rag.multipass.orchestrator.run_structure_pass") as mock_structure:

            mock_acceptance.return_value = AcceptanceResult(
                accepted=True,
                category=RejectionCategory.ACCEPTED,
                reason="Valid",
            )

            mock_draft.return_value = PassResult(
                pass_number=1,
                pass_name="draft",
                status=PassStatus.SUCCESS,
                output_text="Draft text here",
            )

            # Critique times out - should be recoverable
            mock_critique.return_value = PassResult(
                pass_number=2,
                pass_name="critique",
                status=PassStatus.SKIPPED,
                output_text="Critique skipped due to timeout.",
                error_message="Timeout",
            )

            mock_refine.return_value = PassResult(
                pass_number=3,
                pass_name="refine",
                status=PassStatus.SUCCESS,
                output_text="Refined text",
            )

            mock_structure.return_value = PassResult(
                pass_number=4,
                pass_name="structure",
                status=PassStatus.SUCCESS,
                output_json={"confidence": 0.8},
            )

            orchestrator = MultiPassOrchestrator("test-case-id")
            result = await orchestrator.run("Test", "Ethical dilemma")

            # Pipeline should still succeed
            assert result.success
            assert result.passes_completed == 4

    @patch("services.rag.multipass.orchestrator.SessionLocal")
    @patch("services.rag.multipass.orchestrator.get_llm_service")
    @patch("services.rag.multipass.orchestrator.RAGPipeline")
    @patch("services.rag.multipass.orchestrator.settings")
    async def test_structure_failure_triggers_fallback(
        self,
        mock_settings,
        mock_rag_pipeline,
        mock_llm_service,
        mock_session_local,
        mock_db_session,
        mock_consultation,
    ):
        """Test fallback reconstruction when structure pass fails."""
        # Setup mocks
        mock_session_local.return_value = mock_db_session
        mock_db_session.refresh = lambda x: setattr(x, 'id', mock_consultation.id)
        mock_settings.MULTIPASS_RETRIES_STRUCTURE = 0  # No retries

        mock_rag = MagicMock()
        mock_rag.retrieve_verses.return_value = [
            {"canonical_id": "BG_2_47", "metadata": {"translation_en": "Test"}}
        ]
        mock_rag.enrich_verses_with_translations.return_value = mock_rag.retrieve_verses.return_value
        mock_rag_pipeline.return_value = mock_rag

        with patch("services.rag.multipass.orchestrator.run_acceptance_pass") as mock_acceptance, \
             patch("services.rag.multipass.orchestrator.run_draft_pass") as mock_draft, \
             patch("services.rag.multipass.orchestrator.run_critique_pass") as mock_critique, \
             patch("services.rag.multipass.orchestrator.run_refine_pass") as mock_refine, \
             patch("services.rag.multipass.orchestrator.run_structure_pass") as mock_structure:

            mock_acceptance.return_value = AcceptanceResult(
                accepted=True,
                category=RejectionCategory.ACCEPTED,
                reason="Valid",
            )

            mock_draft.return_value = PassResult(
                pass_number=1,
                pass_name="draft",
                status=PassStatus.SUCCESS,
                output_text="Draft text",
            )

            mock_critique.return_value = PassResult(
                pass_number=2,
                pass_name="critique",
                status=PassStatus.SUCCESS,
                output_text="Critique",
            )

            mock_refine.return_value = PassResult(
                pass_number=3,
                pass_name="refine",
                status=PassStatus.SUCCESS,
                output_text="Refined text",
            )

            # Structure fails
            mock_structure.return_value = PassResult(
                pass_number=4,
                pass_name="structure",
                status=PassStatus.ERROR,
                error_message="JSON parse failed",
            )

            orchestrator = MultiPassOrchestrator("test-case-id")
            result = await orchestrator.run("Test", "Ethical dilemma")

            # Should use fallback
            assert result.success
            assert result.fallback_used
            assert result.result_json is not None
            assert result.result_json.get("scholar_flag") is True
            assert result.result_json.get("confidence") == 0.4


class TestGenericFallback:
    """Test generic fallback response creation."""

    def test_fallback_has_required_fields(self):
        """Test that generic fallback has all required fields."""
        orchestrator = MultiPassOrchestrator("test-case-id")
        verses = [
            {"canonical_id": "BG_2_47", "metadata": {"translation_en": "Test verse 1"}},
            {"canonical_id": "BG_3_35", "metadata": {"translation_en": "Test verse 2"}},
        ]

        fallback = orchestrator._create_generic_fallback(verses)

        # Check required fields
        assert "suggested_title" in fallback
        assert "executive_summary" in fallback
        assert "options" in fallback
        assert len(fallback["options"]) == 3
        assert "recommended_action" in fallback
        assert "reflection_prompts" in fallback
        assert "sources" in fallback
        assert fallback["confidence"] == 0.4
        assert fallback["scholar_flag"] is True

    def test_fallback_with_empty_verses(self):
        """Test fallback handles empty verses gracefully."""
        orchestrator = MultiPassOrchestrator("test-case-id")

        fallback = orchestrator._create_generic_fallback([])

        # Should still have structure
        assert "options" in fallback
        assert len(fallback["options"]) == 3
        assert fallback["scholar_flag"] is True


@pytest.mark.asyncio
class TestRunMultipassConsultation:
    """Test the entry point function."""

    @patch("services.rag.multipass.orchestrator.MultiPassOrchestrator")
    async def test_entry_point_calls_orchestrator(self, mock_orchestrator_class):
        """Test that entry point creates orchestrator and runs it."""
        mock_orchestrator = MagicMock()
        mock_orchestrator.run = AsyncMock(return_value=MultiPassResult(
            success=True,
            result_json={"test": "data"},
        ))
        mock_orchestrator_class.return_value = mock_orchestrator

        result = await run_multipass_consultation(
            case_id="test-case-id",
            title="Test Title",
            description="Test description",
        )

        # Verify orchestrator was created and run
        mock_orchestrator_class.assert_called_once_with("test-case-id")
        mock_orchestrator.run.assert_called_once_with(
            "Test Title",
            "Test description",
            False,  # skip_acceptance_llm default
        )
        assert result.success
