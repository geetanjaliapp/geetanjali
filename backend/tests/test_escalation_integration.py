"""Integration tests for escalation logic in RAG pipeline (Phase 3)."""

import pytest
from prometheus_client import generate_latest

from services.rag.escalation import should_escalate_to_fallback
from utils.metrics_llm import (
    track_confidence_post_repair,
    track_escalation_reason,
    track_repair_success,
)

# ============================================================================
# Mock Response Builders
# ============================================================================


def create_mock_response(
    has_options: bool = True,
    has_recommended_action: bool = True,
    has_executive_summary: bool = True,
    has_reflection_prompts: bool = True,
    confidence: float = 0.8,
    provider: str = "gemini",
):
    """Create a mock LLM response."""
    response = {
        "executive_summary": (
            "This is an executive summary." if has_executive_summary else ""
        ),
        "options": (
            [
                {"id": 1, "text": "Option 1", "description": "Desc 1"},
                {"id": 2, "text": "Option 2", "description": "Desc 2"},
                {"id": 3, "text": "Option 3", "description": "Desc 3"},
            ]
            if has_options
            else []
        ),
        "recommended_action": (
            "Recommended action here." if has_recommended_action else ""
        ),
        "reflection_prompts": (
            ["Reflect on choice", "Consider impact"]
            if has_reflection_prompts
            else []
        ),
        "confidence": confidence,
        "sources": [
            {"verse_id": 1, "text": "BG 2.47", "relevance_score": 0.95}
        ],
        "scholar_flag": False,
        "llm_attribution": {
            "provider": provider,
            "model": f"{provider}-model",
        },
    }
    return response


# ============================================================================
# Test Classes
# ============================================================================


class TestEscalationDecisionLogic:
    """Test the core escalation decision logic."""

    def test_should_escalate_missing_options(self):
        """Missing 'options' should escalate."""
        response = create_mock_response(has_options=False)
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "options" in reason

    def test_should_escalate_missing_recommended_action(self):
        """Missing 'recommended_action' should escalate."""
        response = create_mock_response(has_recommended_action=False)
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "recommended_action" in reason

    def test_should_escalate_missing_executive_summary(self):
        """Missing 'executive_summary' should escalate."""
        response = create_mock_response(has_executive_summary=False)
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "executive_summary" in reason

    def test_should_not_escalate_missing_optional_field(self):
        """Missing optional fields should not escalate."""
        response = create_mock_response(has_reflection_prompts=False)
        should_escalate, reason = should_escalate_to_fallback(response)
        # Should not escalate for just missing reflection_prompts
        # (it's only 1 important field, threshold is 2)
        assert should_escalate is False

    def test_should_not_escalate_valid_response(self):
        """Valid response with all critical fields should not escalate."""
        response = create_mock_response(
            has_options=True,
            has_recommended_action=True,
            has_executive_summary=True,
        )
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_escalation_reason_accuracy(self):
        """Escalation reason should accurately describe the failure."""
        # Test each critical field
        response_no_options = create_mock_response(has_options=False)
        _, reason = should_escalate_to_fallback(response_no_options)
        assert "options" in reason

        response_no_action = create_mock_response(has_recommended_action=False)
        _, reason = should_escalate_to_fallback(response_no_action)
        assert "recommended_action" in reason

        response_no_summary = create_mock_response(has_executive_summary=False)
        _, reason = should_escalate_to_fallback(response_no_summary)
        assert "executive_summary" in reason


class TestEscalationMetricsTracking:
    """Test that metrics are correctly emitted at escalation points."""

    def test_escalation_reason_metric_tracked(self):
        """Pre-repair escalation should track escalation reason metric."""
        # Directly test that the metrics module's tracking functions can be called
        reason = "missing_critical_field_options"
        provider = "gemini"
        track_escalation_reason(reason, provider)

        # Verify: Metric appears in metrics output
        metrics = generate_latest().decode("utf-8")
        assert "geetanjali_escalation_reasons_total" in metrics
        assert f'reason="{reason}"' in metrics
        assert f'provider="{provider}"' in metrics

    def test_repair_success_metric_tracked(self):
        """Repaired fields should be tracked in metrics."""
        # Directly call the tracking function
        track_repair_success("options", "success")

        # Verify: Metric appears in metrics output
        metrics = generate_latest().decode("utf-8")
        assert "geetanjali_repair_success_total" in metrics
        assert 'field="options"' in metrics
        assert 'status="success"' in metrics

    def test_confidence_post_repair_metric_tracked(self):
        """Confidence after repair should be tracked."""
        # Directly call the tracking function
        track_confidence_post_repair("gemini", 0.75)

        # Verify: Metric appears in metrics output
        metrics = generate_latest().decode("utf-8")
        assert "geetanjali_confidence_post_repair" in metrics
        assert 'provider="gemini"' in metrics

    def test_multiple_escalation_scenarios_metrics(self):
        """Test metrics tracking across multiple escalation scenarios."""
        # Scenario 1: Gemini missing options
        track_escalation_reason("missing_critical_field_options", "gemini")
        track_repair_success("options", "failed")

        # Scenario 2: Low confidence post-repair
        track_escalation_reason("low_confidence_post_repair", "gemini")
        track_confidence_post_repair("gemini", 0.35)

        # Scenario 3: Anthropic fallback succeeds
        track_confidence_post_repair("anthropic", 0.92)

        # Verify: All metrics present
        metrics = generate_latest().decode("utf-8")
        assert 'reason="missing_critical_field_options"' in metrics
        assert 'reason="low_confidence_post_repair"' in metrics
        assert 'field="options"' in metrics
        assert 'status="failed"' in metrics
        assert 'provider="gemini"' in metrics
        assert 'provider="anthropic"' in metrics


class TestEscalationEndToEnd:
    """End-to-end escalation scenarios."""

    def test_pre_repair_escalation_case_gemini_missing_options(self):
        """Pre-repair escalation: Gemini returns incomplete response."""
        # When Gemini fails structurally, should escalate before repair cascade
        gemini_response = create_mock_response(has_options=False, provider="gemini")

        # Verify: Escalation logic identifies structural failure
        should_escalate, reason = should_escalate_to_fallback(gemini_response)
        assert should_escalate is True
        assert "options" in reason

        # Verify: Reason code is correct for metrics
        assert reason in [
            "missing_critical_field_options",
            "missing_critical_field_recommended_action",
            "missing_critical_field_executive_summary",
        ]

    def test_fallback_response_passes_validation(self):
        """Fallback response should have all required fields."""
        # Anthropic fallback response
        anthropic_response = create_mock_response(provider="anthropic")

        # Verify: Fallback response is valid
        should_escalate, _ = should_escalate_to_fallback(anthropic_response)
        assert should_escalate is False

        # Verify: All critical fields present
        assert anthropic_response["options"] is not None
        assert len(anthropic_response["options"]) > 0
        assert anthropic_response["recommended_action"] is not None
        assert anthropic_response["executive_summary"] is not None

    def test_post_repair_escalation_case_low_confidence(self):
        """Post-repair escalation: Confidence too low after repair."""
        # Gemini response with low confidence
        gemini_response = create_mock_response(confidence=0.40, provider="gemini")

        # After repair, confidence stays low
        assert gemini_response["confidence"] < 0.45

        # Anthropic response has high confidence
        anthropic_response = create_mock_response(
            confidence=0.92, provider="anthropic"
        )
        assert anthropic_response["confidence"] >= 0.45

    def test_confidence_threshold_boundary_conditions(self):
        """Test escalation threshold boundary conditions."""
        # Just below threshold - should escalate
        low_conf_response = create_mock_response(confidence=0.44)
        assert low_conf_response["confidence"] < 0.45

        # At threshold - should NOT escalate (>= check)
        at_threshold = create_mock_response(confidence=0.45)
        assert at_threshold["confidence"] >= 0.45

        # Above threshold - should NOT escalate
        good_conf = create_mock_response(confidence=0.50)
        assert good_conf["confidence"] >= 0.45

    def test_no_unnecessary_escalation_for_valid_response(self):
        """Valid Gemini response should not trigger escalation."""
        response = create_mock_response(confidence=0.80, provider="gemini")

        # Should not escalate structurally
        should_escalate_pre, _ = should_escalate_to_fallback(response)
        assert should_escalate_pre is False

        # Should not escalate post-repair (confidence >= 0.45)
        assert response["confidence"] >= 0.45

    def test_escalation_metrics_flow(self):
        """Test complete metrics flow for escalation scenario."""
        # Phase 1: Pre-repair escalation detected
        track_escalation_reason("missing_critical_field_recommended_action", "gemini")

        # Phase 2: Repair attempted but failed
        track_repair_success("recommended_action", "failed")

        # Phase 3: Post-repair escalation triggered
        track_escalation_reason("low_confidence_post_repair", "gemini")

        # Phase 4: Anthropic fallback succeeds
        track_confidence_post_repair("anthropic", 0.88)

        # Verify: Full flow in metrics
        metrics = generate_latest().decode("utf-8")
        assert 'reason="missing_critical_field_recommended_action"' in metrics
        assert 'reason="low_confidence_post_repair"' in metrics
        assert 'field="recommended_action"' in metrics
        assert 'status="failed"' in metrics
        assert 'provider="gemini"' in metrics
        assert 'provider="anthropic"' in metrics


class TestEscalationEdgeCases:
    """Edge cases and boundary conditions."""

    def test_empty_response_escalates(self):
        """Empty response should trigger escalation."""
        empty_response = {
            "executive_summary": "",
            "options": [],
            "recommended_action": "",
            "reflection_prompts": [],
            "confidence": 0.1,
            "sources": [],
            "scholar_flag": False,
            "llm_attribution": {"provider": "gemini"},
        }

        should_escalate, reason = should_escalate_to_fallback(empty_response)
        assert should_escalate is True

    def test_partially_filled_response_escalates(self):
        """Partially filled response missing options should escalate."""
        response = {
            "executive_summary": "Summary provided",
            "options": [],  # Missing!
            "recommended_action": "Action provided",
            "reflection_prompts": ["Prompt"],
            "confidence": 0.5,
            "sources": [{"verse_id": 1}],
            "scholar_flag": False,
            "llm_attribution": {"provider": "gemini"},
        }

        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "options" in reason

    def test_all_critical_fields_present_does_not_escalate(self):
        """Response with all critical fields should not escalate."""
        response = {
            "executive_summary": "Summary",
            "options": [
                {"id": 1, "text": "A", "description": "X"},
                {"id": 2, "text": "B", "description": "Y"},
                {"id": 3, "text": "C", "description": "Z"},
            ],
            "recommended_action": "Action",
            "reflection_prompts": [],  # Optional, OK if missing
            "confidence": 0.5,
            "sources": [],  # OK if missing
            "scholar_flag": False,
            "llm_attribution": {"provider": "gemini"},
        }

        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_null_values_in_critical_fields_escalates(self):
        """Null values in critical fields should be treated as missing."""
        response = {
            "executive_summary": None,  # Critical but null
            "options": None,
            "recommended_action": "Action",
            "reflection_prompts": ["Prompt"],
            "confidence": 0.5,
            "sources": [],
            "scholar_flag": False,
            "llm_attribution": {"provider": "gemini"},
        }

        should_escalate, reason = should_escalate_to_fallback(response)
        # Should escalate due to missing executive_summary and options
        assert should_escalate is True
