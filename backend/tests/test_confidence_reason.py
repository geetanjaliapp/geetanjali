"""Tests for confidence_reason generation (Phase 5)."""

import pytest
from services.rag.validation import generate_confidence_reason


pytestmark = pytest.mark.unit


class TestConfidenceReasonEscalated:
    """Test confidence_reason for escalated responses."""

    def test_escalated_response_reason(self):
        """Escalated response should explain fallback provider."""
        reason = generate_confidence_reason(
            confidence=0.92,
            is_escalated=True,
            repairs_count=0,
            rag_injected=False,
            provider="anthropic",
        )
        assert "highest-quality provider" in reason.lower()
        assert "escalation" in reason.lower()

    def test_escalated_low_confidence_reason(self):
        """Even low confidence after escalation should mention fallback quality."""
        reason = generate_confidence_reason(
            confidence=0.50,
            is_escalated=True,
            repairs_count=2,
            rag_injected=False,
            provider="anthropic",
        )
        assert "highest-quality provider" in reason.lower()
        assert "escalation" in reason.lower()


class TestConfidenceReasonHighQuality:
    """Test confidence_reason for high-confidence responses."""

    def test_high_confidence_no_repairs(self):
        """High confidence with no repairs should praise reasoning."""
        reason = generate_confidence_reason(
            confidence=0.95,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert "high-quality" in reason.lower() or "excellent" in reason.lower()
        assert "no repairs" in reason.lower()

    def test_high_confidence_minor_repair(self):
        """High confidence (0.80+) with 1 repair should note core soundness."""
        reason = generate_confidence_reason(
            confidence=0.82,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert "minor repair" in reason.lower()
        assert "core" in reason.lower() or "sound" in reason.lower()

    def test_very_high_confidence(self):
        """Confidence >= 0.85 should indicate strong reasoning."""
        reason = generate_confidence_reason(
            confidence=0.88,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert len(reason) > 10
        assert "confidence" not in reason.lower() or "high" in reason.lower()


class TestConfidenceReasonModerate:
    """Test confidence_reason for moderate-confidence responses."""

    def test_moderate_confidence_65_one_repair(self):
        """Confidence 0.65-0.85 with 1 repair should note field repair."""
        reason = generate_confidence_reason(
            confidence=0.70,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert "1 field repair" in reason or "1 repair" in reason
        assert "sound" in reason.lower() or "valid" in reason.lower()

    def test_moderate_confidence_multiple_repairs(self):
        """Confidence 0.65-0.85 with multiple repairs should note repair count."""
        reason = generate_confidence_reason(
            confidence=0.72,
            is_escalated=False,
            repairs_count=3,
            rag_injected=False,
            provider="gemini",
        )
        assert "3 field" in reason or "3 repairs" in reason
        assert "repairs" in reason.lower() or "repair" in reason.lower()

    def test_moderate_confidence_rag_injected(self):
        """Confidence 0.65-0.85 with RAG injection should note sources."""
        reason = generate_confidence_reason(
            confidence=0.72,
            is_escalated=False,
            repairs_count=0,
            rag_injected=True,
            provider="gemini",
        )
        assert "source" in reason.lower() or "verse" in reason.lower()


class TestConfidenceReasonLowQuality:
    """Test confidence_reason for low-confidence responses."""

    def test_low_confidence_45_to_65(self):
        """Confidence 0.45-0.65 should warn about reviewing."""
        reason = generate_confidence_reason(
            confidence=0.55,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert "review" in reason.lower() or "moderate" in reason.lower()

    def test_low_confidence_multiple_repairs(self):
        """Low confidence with many repairs should recommend caution."""
        reason = generate_confidence_reason(
            confidence=0.50,
            is_escalated=False,
            repairs_count=3,
            rag_injected=False,
            provider="gemini",
        )
        assert "multiple" in reason.lower() or "3" in reason
        assert "review" in reason.lower() or "consider" in reason.lower()

    def test_very_low_confidence_30_to_45(self):
        """Confidence 0.30-0.45 should strongly recommend caution."""
        reason = generate_confidence_reason(
            confidence=0.35,
            is_escalated=False,
            repairs_count=2,
            rag_injected=False,
            provider="gemini",
        )
        assert "low confidence" in reason.lower()
        assert "scholar review" in reason.lower() or "expert" in reason.lower()

    def test_extremely_low_confidence_floor(self):
        """Confidence at floor (0.3) should strongly warn."""
        reason = generate_confidence_reason(
            confidence=0.30,
            is_escalated=False,
            repairs_count=3,
            rag_injected=False,
            provider="gemini",
        )
        assert "substantial" in reason.lower() or "expert" in reason.lower()


class TestConfidenceReasonThresholds:
    """Test confidence_reason at key thresholds."""

    def test_confidence_exactly_85(self):
        """Confidence exactly at 0.85 should be high-confidence message."""
        reason = generate_confidence_reason(
            confidence=0.85,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert "high" in reason.lower()

    def test_confidence_exactly_65(self):
        """Confidence exactly at 0.65 should be moderate message."""
        reason = generate_confidence_reason(
            confidence=0.65,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert len(reason) > 10

    def test_confidence_exactly_45(self):
        """Confidence exactly at 0.45 should be low-confidence message."""
        reason = generate_confidence_reason(
            confidence=0.45,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert "moderate" in reason.lower() or "review" in reason.lower()

    def test_confidence_exactly_30(self):
        """Confidence exactly at 0.30 (floor) should warn strongly."""
        reason = generate_confidence_reason(
            confidence=0.30,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert "low" in reason.lower() or "expert" in reason.lower()


class TestConfidenceReasonScenarios:
    """Test real-world confidence_reason scenarios."""

    def test_scenario_gemini_valid_response(self):
        """Gemini returns valid response with good confidence."""
        reason = generate_confidence_reason(
            confidence=0.85,
            is_escalated=False,
            repairs_count=0,
            rag_injected=False,
            provider="gemini",
        )
        assert "high" in reason.lower()
        assert "no repairs" in reason.lower()

    def test_scenario_gemini_minor_repair(self):
        """Gemini response needs minor repair (optional field)."""
        reason = generate_confidence_reason(
            confidence=0.80,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert "minor repair" in reason.lower() or "1" in reason
        assert "sound" in reason.lower()

    def test_scenario_gemini_critical_repair(self):
        """Gemini response needs critical field repair."""
        reason = generate_confidence_reason(
            confidence=0.50,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        assert "field repair" in reason.lower()
        assert ("review" in reason.lower() or "caution" in reason.lower())

    def test_scenario_escalated_to_anthropic(self):
        """Response escalated to Anthropic fallback."""
        reason = generate_confidence_reason(
            confidence=0.92,
            is_escalated=True,
            repairs_count=0,
            rag_injected=False,
            provider="anthropic",
        )
        assert "highest-quality" in reason.lower()
        assert "escalation" in reason.lower()

    def test_scenario_heavy_repairs_needed(self):
        """Response requires many repairs (likely would escalate)."""
        reason = generate_confidence_reason(
            confidence=0.40,
            is_escalated=False,
            repairs_count=4,
            rag_injected=False,
            provider="gemini",
        )
        assert "multiple" in reason.lower() or "4" in reason
        assert "review" in reason.lower() or "expert" in reason.lower()

    def test_scenario_rag_verses_injected(self):
        """Response had RAG verses injected for sources."""
        reason = generate_confidence_reason(
            confidence=0.75,
            is_escalated=False,
            repairs_count=0,
            rag_injected=True,
            provider="gemini",
        )
        assert "source" in reason.lower() or "verse" in reason.lower()


class TestConfidenceReasonUserFriendly:
    """Test that confidence_reason is user-friendly and helpful."""

    def test_all_reasons_are_non_empty(self):
        """All generated reasons should be non-empty."""
        for confidence in [0.30, 0.45, 0.65, 0.85, 0.95]:
            for is_escalated in [True, False]:
                for repairs_count in [0, 1, 3]:
                    reason = generate_confidence_reason(
                        confidence=confidence,
                        is_escalated=is_escalated,
                        repairs_count=repairs_count,
                        rag_injected=False,
                        provider="gemini",
                    )
                    assert len(reason) > 0
                    assert isinstance(reason, str)

    def test_reasons_are_readable_length(self):
        """Generated reasons should be short and readable."""
        reason = generate_confidence_reason(
            confidence=0.75,
            is_escalated=False,
            repairs_count=2,
            rag_injected=False,
            provider="gemini",
        )
        # Should be roughly 50-300 characters (readable but informative)
        assert 20 < len(reason) < 400

    def test_reasons_avoid_technical_jargon(self):
        """Reasons should be understandable to non-technical users."""
        reason = generate_confidence_reason(
            confidence=0.60,
            is_escalated=False,
            repairs_count=1,
            rag_injected=False,
            provider="gemini",
        )
        # Should explain in plain language
        assert "repair" in reason.lower() or "field" in reason.lower()
        # Should not have overly technical terms
        assert "gradient" not in reason.lower()
        assert "hyperparameter" not in reason.lower()
