"""Tests for consultation pipeline routing logic.

Tests cover:
- Config-based routing between single-pass and multi-pass
- Fallback behavior when multi-pass fails
- Error handling during pipeline execution
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


class TestPipelineRouting:
    """Test pipeline routing based on config."""

    @patch("api.outputs.settings")
    @patch("api.outputs.get_rag_pipeline")
    def test_uses_single_pass_when_disabled(self, mock_get_pipeline, mock_settings):
        """Test that single-pass is used when MULTIPASS_ENABLED is False."""
        from api.outputs import _run_consultation_pipeline

        mock_settings.MULTIPASS_ENABLED = False
        mock_pipeline = MagicMock()
        mock_pipeline.run.return_value = ({"result": "test"}, False)
        mock_get_pipeline.return_value = mock_pipeline

        result, is_violation = _run_consultation_pipeline(
            case_id="test-case-id",
            case_data={"title": "Test", "description": "Test desc"},
        )

        assert result == {"result": "test"}
        assert is_violation is False
        mock_get_pipeline.assert_called_once()
        mock_pipeline.run.assert_called_once()

    @patch("api.outputs.asyncio.run")
    @patch("api.outputs.settings")
    def test_uses_multipass_when_enabled(self, mock_settings, mock_asyncio_run):
        """Test that multi-pass is used when MULTIPASS_ENABLED is True."""
        from api.outputs import _run_consultation_pipeline
        from services.rag.multipass import MultiPassResult

        mock_settings.MULTIPASS_ENABLED = True
        mock_settings.MULTIPASS_FALLBACK_TO_SINGLE_PASS = True

        # Mock successful multipass result
        mock_result = MultiPassResult(
            success=True,
            result_json={"suggested_title": "Multipass Result"},
            is_policy_violation=False,
        )
        mock_asyncio_run.return_value = mock_result

        result, is_violation = _run_consultation_pipeline(
            case_id="test-case-id",
            case_data={"title": "Test", "description": "Test desc"},
        )

        assert result == {"suggested_title": "Multipass Result"}
        assert is_violation is False
        mock_asyncio_run.assert_called_once()

    @patch("api.outputs.get_rag_pipeline")
    @patch("api.outputs.asyncio.run")
    @patch("api.outputs.settings")
    def test_fallback_to_single_pass_on_failure(
        self, mock_settings, mock_asyncio_run, mock_get_pipeline
    ):
        """Test fallback to single-pass when multi-pass fails."""
        from api.outputs import _run_consultation_pipeline
        from services.rag.multipass import MultiPassResult

        mock_settings.MULTIPASS_ENABLED = True
        mock_settings.MULTIPASS_FALLBACK_TO_SINGLE_PASS = True

        # Mock failed multipass result
        mock_result = MultiPassResult(
            success=False,
            result_json=None,
            is_policy_violation=False,
            fallback_reason="Pass 4 JSON parse failed",
        )
        mock_asyncio_run.return_value = mock_result

        # Mock single-pass fallback
        mock_pipeline = MagicMock()
        mock_pipeline.run.return_value = ({"result": "single-pass"}, False)
        mock_get_pipeline.return_value = mock_pipeline

        result, is_violation = _run_consultation_pipeline(
            case_id="test-case-id",
            case_data={"title": "Test", "description": "Test desc"},
        )

        assert result == {"result": "single-pass"}
        assert is_violation is False
        mock_get_pipeline.assert_called_once()

    @patch("api.outputs.asyncio.run")
    @patch("api.outputs.settings")
    def test_no_fallback_when_disabled(self, mock_settings, mock_asyncio_run):
        """Test no fallback when MULTIPASS_FALLBACK_TO_SINGLE_PASS is False."""
        from api.outputs import _run_consultation_pipeline
        from services.rag.multipass import MultiPassResult

        mock_settings.MULTIPASS_ENABLED = True
        mock_settings.MULTIPASS_FALLBACK_TO_SINGLE_PASS = False

        # Mock failed multipass result
        mock_result = MultiPassResult(
            success=False,
            result_json={"partial": "result"},
            is_policy_violation=False,
        )
        mock_asyncio_run.return_value = mock_result

        result, is_violation = _run_consultation_pipeline(
            case_id="test-case-id",
            case_data={"title": "Test", "description": "Test desc"},
        )

        # Should return partial result, not fallback
        assert result == {"partial": "result"}

    @patch("api.outputs.get_rag_pipeline")
    @patch("api.outputs.asyncio.run")
    @patch("api.outputs.settings")
    def test_fallback_on_exception(
        self, mock_settings, mock_asyncio_run, mock_get_pipeline
    ):
        """Test fallback to single-pass when multi-pass raises exception."""
        from api.outputs import _run_consultation_pipeline

        mock_settings.MULTIPASS_ENABLED = True
        mock_settings.MULTIPASS_FALLBACK_TO_SINGLE_PASS = True

        # Mock multipass raising exception
        mock_asyncio_run.side_effect = Exception("LLM service unavailable")

        # Mock single-pass fallback
        mock_pipeline = MagicMock()
        mock_pipeline.run.return_value = ({"result": "fallback"}, False)
        mock_get_pipeline.return_value = mock_pipeline

        result, is_violation = _run_consultation_pipeline(
            case_id="test-case-id",
            case_data={"title": "Test", "description": "Test desc"},
        )

        assert result == {"result": "fallback"}
        mock_get_pipeline.assert_called_once()

    @patch("api.outputs.asyncio.run")
    @patch("api.outputs.settings")
    def test_exception_propagates_without_fallback(
        self, mock_settings, mock_asyncio_run
    ):
        """Test exception propagates when fallback is disabled."""
        from api.outputs import _run_consultation_pipeline

        mock_settings.MULTIPASS_ENABLED = True
        mock_settings.MULTIPASS_FALLBACK_TO_SINGLE_PASS = False

        mock_asyncio_run.side_effect = Exception("LLM service unavailable")

        with pytest.raises(Exception, match="LLM service unavailable"):
            _run_consultation_pipeline(
                case_id="test-case-id",
                case_data={"title": "Test", "description": "Test desc"},
            )

    @patch("api.outputs.asyncio.run")
    @patch("api.outputs.settings")
    def test_policy_violation_from_multipass(self, mock_settings, mock_asyncio_run):
        """Test policy violation flag is propagated from multi-pass."""
        from api.outputs import _run_consultation_pipeline
        from services.rag.multipass import MultiPassResult

        mock_settings.MULTIPASS_ENABLED = True

        mock_result = MultiPassResult(
            success=True,
            result_json={"rejection": "Policy violation"},
            is_policy_violation=True,
        )
        mock_asyncio_run.return_value = mock_result

        result, is_violation = _run_consultation_pipeline(
            case_id="test-case-id",
            case_data={"title": "Test", "description": "Test desc"},
        )

        assert is_violation is True
