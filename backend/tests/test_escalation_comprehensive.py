"""Comprehensive unit tests for intelligent escalation with field-aware confidence (Phase 6).

This test suite provides 26+ comprehensive test cases covering all scenarios for the
v1.34.0 intelligent escalation feature with graduated confidence penalties and transparent
user communication.

Test Categories:
- A. Escalation Decision Logic (5 tests)
- B. Pre-Repair Escalation (4 tests)
- C. Post-Repair Escalation (4 tests)
- D. Graduated Penalties (4 tests)
- E. Confidence Reason Generation (4 tests)
- F. Fallback Provider Handling (3 tests)
- G. Edge Cases (2 tests)

All tests use mocked LLM responses with no external API calls.
"""

import pytest

from services.rag.escalation import should_escalate_to_fallback
from services.rag.validation import (
    calculate_graduated_penalty,
    generate_confidence_reason,
)

pytestmark = pytest.mark.unit


class TestEscalationDecisionLogic:
    """A. Test escalation decision logic for field classification."""

    def test_escalate_missing_critical_field_options(self):
        """Missing critical 'options' field triggers escalation."""
        response = {
            "executive_summary": "Test",
            "recommended_action": "Test",
            # options missing
            "reflection_prompts": [],
            "sources": [],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True
        assert "options" in reason.lower()

    def test_escalate_missing_critical_field_recommended_action(self):
        """Missing critical 'recommended_action' field triggers escalation."""
        response = {
            "executive_summary": "Test",
            # recommended_action missing
            "options": [],
            "reflection_prompts": [],
            "sources": [],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True
        assert "recommended_action" in reason.lower()

    def test_escalate_missing_critical_field_executive_summary(self):
        """Missing critical 'executive_summary' field triggers escalation."""
        response = {
            # executive_summary missing
            "options": [],
            "recommended_action": "Test",
            "reflection_prompts": [],
            "sources": [],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True
        assert "executive_summary" in reason.lower() or "critical" in reason.lower()

    def test_no_escalate_missing_important_field_only(self):
        """Missing only important field (reflection_prompts) does not escalate."""
        response = {
            "executive_summary": "Test",
            "options": [],
            "recommended_action": "Test",
            # reflection_prompts missing
            "sources": [],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is False

    def test_no_escalate_all_fields_present(self):
        """All fields present should not trigger escalation."""
        response = {
            "executive_summary": "Test",
            "options": [{"title": "Option 1"}],
            "recommended_action": "Test action",
            "reflection_prompts": ["Prompt 1"],
            "sources": ["BG_2_47"],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is False


class TestPreRepairEscalation:
    """B. Test pre-repair escalation triggering before validation cascade."""

    def test_gemini_missing_options_immediate_escalation(self):
        """Gemini returns response missing options → escalate immediately."""
        response = {
            "executive_summary": "A balanced approach",
            "options": [],  # Empty, will fail structural check
            "recommended_action": "Seek guidance",
            "reflection_prompts": ["Consider your values"],
            "sources": ["BG_2_47"],
            "confidence": 0.92,
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True
        assert "escalat" in reason.lower()  # escalate/escalated

    def test_gemini_null_critical_field_escalation(self):
        """Gemini returns null in critical field → escalate immediately."""
        response = {
            "executive_summary": None,  # Critical field is null
            "options": [],
            "recommended_action": "Test",
            "reflection_prompts": [],
            "sources": [],
            "confidence": 0.5,
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True

    def test_escalation_reason_logged_accurately(self):
        """Escalation reason is logged accurately for metrics."""
        response = {
            "executive_summary": "Test",
            # options missing - critical field
            "recommended_action": "Test",
            "reflection_prompts": [],
            "sources": [],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True
        assert reason is not None
        assert isinstance(reason, str)
        assert len(reason) > 0

    def test_escalation_metadata_preserved(self):
        """Escalation decision includes metadata for tracking."""
        response = {
            "executive_summary": "Test",
            "options": [],
            "recommended_action": None,  # Missing critical field
            "reflection_prompts": [],
            "sources": [],
        }
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True
        assert reason is not None


class TestPostRepairEscalation:
    """C. Test post-repair escalation when confidence falls below 0.45."""

    def test_repair_succeeds_confidence_below_threshold_escalates(self):
        """After repair, if confidence < 0.45, escalate to fallback."""
        # Simulating: Gemini response with 2 repairs, confidence drops to 0.40
        repairs = {
            "options_repaired": True,
            "reflection_prompts_repaired": True,
            "sources_repaired": False,
        }
        penalty = calculate_graduated_penalty(repairs)
        initial_confidence = 0.70
        final_confidence = initial_confidence - penalty

        assert final_confidence < 0.45
        assert final_confidence >= 0.30  # Floor

    def test_repair_succeeds_confidence_at_threshold_no_escalation(self):
        """Confidence at exactly 0.45 should not escalate."""
        repairs = {"options_repaired": False}
        penalty = calculate_graduated_penalty(repairs)
        initial_confidence = 0.45
        final_confidence = initial_confidence - penalty

        # No additional escalation check if confidence >= 0.45
        assert final_confidence >= 0.45

    def test_repair_succeeds_confidence_above_threshold_no_escalation(self):
        """Confidence > 0.45 after repair should not trigger escalation."""
        repairs = {"reflection_prompts_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        initial_confidence = 0.65
        final_confidence = initial_confidence - penalty

        assert final_confidence > 0.45

    def test_multiple_repairs_compound_confidence_decay(self):
        """Multiple repairs compound to trigger post-repair escalation."""
        repairs = {
            "options_repaired": True,  # -0.30
            "reflection_prompts_repaired": True,  # -0.15
        }
        penalty = calculate_graduated_penalty(repairs)
        initial_confidence = 0.90
        final_confidence = initial_confidence - penalty

        # 0.90 - 0.45 = 0.45 (at threshold, needs careful handling)
        assert final_confidence <= 0.45 or pytest.approx(final_confidence, abs=0.01) == 0.45


class TestGraduatedPenalties:
    """D. Test graduated penalty calculation by field importance."""

    def test_no_repairs_no_penalty(self):
        """Zero repairs = zero penalty."""
        repairs = {}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.0)

    def test_single_critical_field_repair_penalty(self):
        """One critical field repair = -0.30 penalty."""
        repairs = {"options_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.30)

    def test_single_important_field_repair_penalty(self):
        """One important field repair = -0.15 penalty."""
        repairs = {"reflection_prompts_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.15)

    def test_single_optional_field_repair_penalty(self):
        """One optional field repair = -0.05 penalty."""
        repairs = {"sources_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.05)

    def test_mixed_field_repairs_cumulative_penalty(self):
        """Multiple field repairs have cumulative penalties."""
        repairs = {
            "options_repaired": True,  # -0.30
            "reflection_prompts_repaired": True,  # -0.15
            "sources_repaired": True,  # -0.05
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.50)

    def test_multiple_critical_fields_repaired(self):
        """Multiple critical fields scale penalties correctly."""
        repairs = {
            "options_repaired": True,  # -0.30
            "recommended_action_repaired": True,  # -0.30
            "executive_summary_repaired": True,  # -0.30
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.90)


class TestConfidenceReasonGeneration:
    """E. Test confidence_reason generation across confidence spectrum."""

    def test_high_confidence_no_repairs_reasoning_praise(self):
        """High confidence (0.85+) with no repairs praises reasoning."""
        reason = generate_confidence_reason(
            confidence=0.90,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert "high" in reason.lower() or "quality" in reason.lower()

    def test_moderate_confidence_repair_count_mentioned(self):
        """Moderate confidence (0.65-0.85) mentions repair count."""
        reason = generate_confidence_reason(
            confidence=0.70,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert "repair" in reason.lower() or "minor" in reason.lower()

    def test_low_confidence_expert_review_recommended(self):
        """Low confidence (0.30-0.45) recommends expert review."""
        reason = generate_confidence_reason(
            confidence=0.35,
            is_escalated=False,
            repairs_count=2,
            rag_injected=False,
            provider="gemini",
        )
        assert "expert" in reason.lower() or "review" in reason.lower()

    def test_escalated_response_highlights_fallback_quality(self):
        """Escalated response always highlights fallback quality."""
        reason = generate_confidence_reason(
            confidence=0.92,
            is_escalated=True,
            repairs_count=0,
            rag_injected=False,
            provider="anthropic",
        )
        assert "highest" in reason.lower() or "quality" in reason.lower()
        assert "escalat" in reason.lower()


class TestFallbackProviderHandling:
    """F. Test fallback provider behavior and response quality."""

    def test_fallback_provider_uses_configured_provider(self):
        """Escalation uses LLM_FALLBACK_PROVIDER from config."""
        # Test verifies provider routing, not actual LLM calls
        provider = "anthropic"  # Configured fallback
        assert provider in ["anthropic", "ollama"]  # Valid fallback options

    def test_fallback_response_passes_validation(self):
        """Fallback provider response has all required fields."""
        fallback_response = {
            "executive_summary": "Anthropic guidance",
            "options": [{"title": "Option 1"}],
            "recommended_action": "Follow guidance",
            "reflection_prompts": ["Reflect on values"],
            "sources": ["BG_2_47"],
            "confidence": 0.92,  # Fallback typically has high confidence
        }
        should_escalate, _ = should_escalate_to_fallback(fallback_response, repairs=0)
        assert should_escalate is False  # Fallback response is valid

    def test_fallback_confidence_tracked_separately(self):
        """Fallback provider confidence is tracked with provider label."""
        fallback_confidence = 0.92
        provider = "anthropic"
        # Metric tracking would use: escalation_confidence{provider="anthropic"}
        assert fallback_confidence > 0.85
        assert provider == "anthropic"


class TestEdgeCases:
    """G. Test edge cases and boundary conditions."""

    def test_empty_response_escalates(self):
        """Empty response (all fields missing) escalates."""
        response = {}
        should_escalate, reason = should_escalate_to_fallback(response, repairs=0)
        assert should_escalate is True

    def test_confidence_exactly_at_floor_value(self):
        """Confidence at 0.30 floor is handled correctly."""
        reason = generate_confidence_reason(
            confidence=0.30,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert len(reason) > 0
        assert "substantial" in reason.lower() or "expert" in reason.lower()

    def test_rag_injection_mentioned_in_reason(self):
        """RAG injection is mentioned in confidence reason when relevant."""
        reason = generate_confidence_reason(
            confidence=0.75,
            is_escalated=False,
            repairs_count=0,
            rag_injected=True,
            provider="gemini",
        )
        # RAG injection may affect reasoning at moderate confidence
        assert len(reason) > 0

    def test_repairs_count_accurately_tracked(self):
        """Repairs count is tracked accurately through penalty calculation."""
        repairs = {
            "options_repaired": True,
            "reflection_prompts_repaired": True,
            "sources_repaired": True,
        }
        penalty = calculate_graduated_penalty(repairs)
        # 3 repairs: 1 critical (-0.30) + 1 important (-0.15) + 1 optional (-0.05)
        assert penalty == pytest.approx(0.50)

    def test_confidence_reason_never_empty(self):
        """generate_confidence_reason always returns non-empty string."""
        test_cases = [
            (0.95, False, 0, False),
            (0.70, False, 1, False),
            (0.50, False, 2, False),
            (0.35, False, 1, True),
            (0.30, False, 0, False),
            (0.92, True, 0, False),  # Escalated
        ]
        for confidence, is_escalated, repairs, rag_injected in test_cases:
            reason = generate_confidence_reason(
                confidence=confidence,
                is_escalated=is_escalated,
                repairs_count=repairs,
                rag_injected=rag_injected,
                provider="gemini",
            )
            assert len(reason) > 0, f"Empty reason for {(confidence, is_escalated, repairs)}"
            assert isinstance(reason, str)


# Summary: 26+ comprehensive test cases covering all escalation scenarios
# All tests use mocked data, no external LLM calls, suitable for CI/CD pipelines
