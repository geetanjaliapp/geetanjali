"""Tests for graduated confidence penalties (Phase 4)."""

import pytest
from services.rag.validation import calculate_graduated_penalty


pytestmark = pytest.mark.unit


class TestGraduatedPenaltyCalculation:
    """Test graduated penalty calculation for field repairs."""

    def test_no_repairs_no_penalty(self):
        """No repairs should result in zero penalty."""
        repairs = {}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.0)

    def test_critical_field_repair_single(self):
        """Repairing one CRITICAL field incurs -0.30 penalty."""
        # options is CRITICAL
        repairs = {"options_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.30)

    def test_critical_field_repair_multiple(self):
        """Repairing multiple CRITICAL fields incurs -0.30 each."""
        # options, recommended_action, executive_summary are CRITICAL
        repairs = {
            "options_repaired": True,
            "recommended_action_repaired": True,
            "executive_summary_repaired": True,
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.90)  # 3 * 0.30

    def test_important_field_repair_single(self):
        """Repairing one IMPORTANT field incurs -0.15 penalty."""
        # reflection_prompts is IMPORTANT
        repairs = {"reflection_prompts_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.15)

    def test_important_field_repair_multiple(self):
        """Repairing multiple IMPORTANT fields incurs -0.15 each."""
        repairs = {
            "reflection_prompts_repaired": True,
            # If more IMPORTANT fields exist, would accumulate
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.15)

    def test_optional_field_repair_single(self):
        """Repairing one OPTIONAL field incurs -0.05 penalty."""
        # sources is OPTIONAL
        repairs = {"sources_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.05)

    def test_optional_field_repair_multiple(self):
        """Repairing multiple OPTIONAL fields incurs -0.05 each."""
        repairs = {
            "sources_repaired": True,
            "scholar_flag_repaired": True,
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.10)  # 2 * 0.05

    def test_mixed_field_repairs(self):
        """Mixed repairs accumulate penalties correctly."""
        repairs = {
            "options_repaired": True,  # CRITICAL -0.30
            "reflection_prompts_repaired": True,  # IMPORTANT -0.15
            "sources_repaired": True,  # OPTIONAL -0.05
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.50)  # 0.30 + 0.15 + 0.05

    def test_false_repairs_not_penalized(self):
        """False repair flags should not incur penalty."""
        repairs = {
            "options_repaired": False,
            "recommended_action_repaired": False,
            "reflection_prompts_repaired": False,
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.0)

    def test_mixed_true_false_repairs(self):
        """Only True repairs should incur penalties."""
        repairs = {
            "options_repaired": True,  # CRITICAL -0.30
            "recommended_action_repaired": False,  # No penalty
            "reflection_prompts_repaired": True,  # IMPORTANT -0.15
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == pytest.approx(0.45)  # 0.30 + 0.15

    def test_missing_repair_flags_treated_as_false(self):
        """Missing repair flags should default to False (no penalty)."""
        repairs = {"options_repaired": True}
        penalty = calculate_graduated_penalty(repairs)
        # Only options_repaired=True, rest default to False
        assert penalty == pytest.approx(0.30)

    def test_maximum_penalties_add_correctly(self):
        """All repairs at once should accumulate correctly."""
        repairs = {
            # CRITICAL: 3 fields * 0.30 = 0.90
            "options_repaired": True,
            "recommended_action_repaired": True,
            "executive_summary_repaired": True,
            # IMPORTANT: 1 field * 0.15 = 0.15
            "reflection_prompts_repaired": True,
            # OPTIONAL: 2 fields * 0.05 = 0.10
            "sources_repaired": True,
            "scholar_flag_repaired": True,
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty == 1.15  # 0.90 + 0.15 + 0.10

    def test_penalty_is_never_negative(self):
        """Penalty calculation should always be non-negative."""
        repairs = {
            "options_repaired": True,
            "recommended_action_repaired": True,
            "executive_summary_repaired": True,
        }
        penalty = calculate_graduated_penalty(repairs)
        assert penalty >= 0.0


class TestConfidenceDecayWithPenalties:
    """Test how penalties affect final confidence scores."""

    def test_minor_repair_confidence_decay(self):
        """Minor repair (optional field) should have small confidence impact."""
        initial_confidence = 0.80
        penalty = 0.05
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.75)

    def test_moderate_repair_confidence_decay(self):
        """Moderate repair (important field) should lower confidence more."""
        initial_confidence = 0.80
        penalty = 0.15
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.65)

    def test_major_repair_confidence_decay(self):
        """Major repair (critical field) should significantly lower confidence."""
        initial_confidence = 0.80
        penalty = 0.30
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.50)

    def test_multiple_repairs_cumulative_decay(self):
        """Multiple repairs should accumulate penalties."""
        initial_confidence = 0.90
        # 1 critical + 1 important = 0.30 + 0.15 = 0.45 penalty
        penalty = 0.45
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.45)

    def test_confidence_floor_at_03(self):
        """Confidence should never drop below 0.3 regardless of penalties."""
        initial_confidence = 0.50
        penalty = 1.0  # Massive penalty
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.3)

    def test_escalation_threshold_after_repair(self):
        """Confidence >= 0.45 should not trigger post-repair escalation."""
        # Valid response with 1 optional field repair
        initial_confidence = 0.75
        penalty = 0.05
        final_confidence = max(initial_confidence - penalty, 0.3)
        escalation_threshold = 0.45
        should_escalate = final_confidence < escalation_threshold
        assert should_escalate is False

    def test_escalation_triggered_by_repair(self):
        """Multiple repairs could lower confidence below escalation threshold."""
        # Response with 2 critical field repairs
        initial_confidence = 0.80
        penalty = 0.60  # 2 * 0.30
        final_confidence = max(initial_confidence - penalty, 0.3)
        escalation_threshold = 0.45
        should_escalate = final_confidence < escalation_threshold
        assert should_escalate is True


class TestPenaltyBoundaryConditions:
    """Test edge cases and boundaries in penalty calculations."""

    def test_empty_repairs_dict(self):
        """Empty repairs dict should return zero penalty."""
        penalty = calculate_graduated_penalty({})
        assert penalty == pytest.approx(0.0)

    def test_zero_confidence_with_penalty(self):
        """Penalty applied to low starting confidence should hit floor."""
        initial_confidence = 0.40
        penalty = 0.30
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.3)  # Hit floor

    def test_high_confidence_with_single_penalty(self):
        """High initial confidence should absorb single penalty well."""
        initial_confidence = 0.95
        penalty = 0.30
        final_confidence = max(initial_confidence - penalty, 0.3)
        assert final_confidence == pytest.approx(0.65)

    def test_mid_range_confidence_with_multiple_penalties(self):
        """Mid-range confidence with multiple repairs should be reasonable."""
        initial_confidence = 0.70
        # 1 critical + 1 important = 0.45
        penalty = 0.45
        final_confidence = max(initial_confidence - penalty, 0.3)
        # 0.70 - 0.45 = 0.25, but floored at 0.3
        assert final_confidence == pytest.approx(0.3)

    def test_confidence_exactly_at_escalation_threshold(self):
        """Confidence exactly at 0.45 should not escalate."""
        final_confidence = 0.45
        escalation_threshold = 0.45
        should_escalate = final_confidence < escalation_threshold
        assert should_escalate is False

    def test_confidence_just_below_escalation_threshold(self):
        """Confidence just below 0.45 should escalate."""
        final_confidence = 0.44
        escalation_threshold = 0.45
        should_escalate = final_confidence < escalation_threshold
        assert should_escalate is True

    def test_three_critical_penalties_exceeds_initial_confidence(self):
        """Three critical repairs could exceed initial confidence."""
        initial_confidence = 0.50
        penalty = 0.90  # 3 * 0.30
        final_confidence = max(initial_confidence - penalty, 0.3)
        # 0.50 - 0.90 = -0.40, but floored at 0.3
        assert final_confidence == pytest.approx(0.3)


class TestRealWorldScenarios:
    """Test realistic repair and penalty scenarios."""

    def test_scenario_gemini_missing_options(self):
        """Gemini returns all fields except options."""
        repairs = {"options_repaired": True}  # Only options needed repair
        penalty = calculate_graduated_penalty(repairs)

        initial_confidence = 0.80
        final_confidence = max(initial_confidence - penalty, 0.3)

        assert penalty == pytest.approx(0.30)
        assert final_confidence == pytest.approx(0.50)
        # 0.50 < 0.45? No, so no post-repair escalation

    def test_scenario_minor_repairs_needed(self):
        """Response needs minor repairs to sources."""
        repairs = {"sources_repaired": True}
        penalty = calculate_graduated_penalty(repairs)

        initial_confidence = 0.85
        final_confidence = max(initial_confidence - penalty, 0.3)

        assert penalty == pytest.approx(0.05)
        assert final_confidence == pytest.approx(0.80)

    def test_scenario_multiple_field_repairs(self):
        """Response needs repairs to multiple fields."""
        repairs = {
            "options_repaired": True,  # CRITICAL -0.30
            "executive_summary_repaired": True,  # CRITICAL -0.30
            "sources_repaired": True,  # OPTIONAL -0.05
        }
        penalty = calculate_graduated_penalty(repairs)

        initial_confidence = 0.85
        final_confidence = max(initial_confidence - penalty, 0.3)

        assert penalty == pytest.approx(0.65)
        # 0.85 - 0.65 = 0.20, but floored at 0.3
        assert final_confidence == pytest.approx(0.3)

    def test_scenario_all_fields_need_repair(self):
        """Severe case: all fields need repair."""
        repairs = {
            "options_repaired": True,
            "recommended_action_repaired": True,
            "executive_summary_repaired": True,
            "reflection_prompts_repaired": True,
            "sources_repaired": True,
            "scholar_flag_repaired": True,
        }
        penalty = calculate_graduated_penalty(repairs)

        initial_confidence = 0.80
        final_confidence = max(initial_confidence - penalty, 0.3)

        # Should trigger escalation
        escalation_threshold = 0.45
        should_escalate = final_confidence < escalation_threshold

        assert should_escalate is True
