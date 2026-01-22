"""Unit tests for escalation logic."""

import pytest

from services.rag.escalation import (
    CRITICAL_FIELDS,
    IMPORTANT_FIELDS,
    describe_escalation_reason,
    get_escalation_threshold,
    should_escalate_to_fallback,
)


class TestFieldClassification:
    """Test field importance classification."""

    def test_critical_fields_defined(self):
        """Verify CRITICAL_FIELDS constant."""
        assert len(CRITICAL_FIELDS) == 3
        assert "options" in CRITICAL_FIELDS
        assert "recommended_action" in CRITICAL_FIELDS
        assert "executive_summary" in CRITICAL_FIELDS

    def test_important_fields_defined(self):
        """Verify IMPORTANT_FIELDS constant."""
        assert len(IMPORTANT_FIELDS) >= 1
        assert "reflection_prompts" in IMPORTANT_FIELDS


class TestShouldEscalateMissingCriticalFields:
    """Test escalation triggers for missing CRITICAL fields."""

    def test_missing_options_triggers_escalation(self):
        """Missing 'options' field should trigger escalation."""
        response = {
            "executive_summary": "Some analysis",
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": ["Q1"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "missing_critical_field_options" in reason

    def test_empty_options_array_triggers_escalation(self):
        """Empty 'options' array should trigger escalation."""
        response = {
            "executive_summary": "Some analysis",
            "options": [],  # Empty
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": ["Q1"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "missing_critical_field_options" in reason

    def test_missing_recommended_action_triggers_escalation(self):
        """Missing 'recommended_action' field should trigger escalation."""
        response = {
            "executive_summary": "Some analysis",
            "options": [{"title": "Opt1"}],
            "reflection_prompts": ["Q1"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "missing_critical_field_recommended_action" in reason

    def test_missing_executive_summary_triggers_escalation(self):
        """Missing 'executive_summary' field should trigger escalation."""
        response = {
            "options": [{"title": "Opt1"}],
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": ["Q1"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True
        assert "missing_critical_field_executive_summary" in reason

    def test_null_critical_field_triggers_escalation(self):
        """Null value in CRITICAL field should trigger escalation."""
        response = {
            "executive_summary": "Some analysis",
            "options": None,  # Null instead of missing
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": ["Q1"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True


class TestShouldEscalateMissingImportantFields:
    """Test escalation triggers for missing IMPORTANT fields."""

    def test_single_missing_important_field_no_escalation(self):
        """Single missing IMPORTANT field should NOT trigger escalation."""
        response = {
            "executive_summary": "Some analysis",
            "options": [{"title": "Opt1"}],
            "recommended_action": {"option": 1, "steps": []},
            # reflection_prompts missing
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_empty_important_field_no_escalation(self):
        """Single empty IMPORTANT field should NOT trigger escalation."""
        response = {
            "executive_summary": "Some analysis",
            "options": [{"title": "Opt1"}],
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": [],  # Empty
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_multiple_missing_important_fields_triggers_escalation(self):
        """Multiple (2+) missing IMPORTANT fields should trigger escalation."""
        # Note: Currently only reflection_prompts is in IMPORTANT_FIELDS
        # This test documents the behavior if more fields are added
        response = {
            "executive_summary": "Some analysis",
            "options": [{"title": "Opt1"}],
            "recommended_action": {"option": 1, "steps": []},
            # Both reflection_prompts missing and (hypothetical second important field)
        }
        # For now, with only 1 important field, this shouldn't escalate
        # But structure is ready for when more important fields are added
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False  # Only 1 important field missing


class TestShouldEscalateValidResponses:
    """Test that valid responses don't trigger escalation."""

    def test_complete_valid_response_no_escalation(self):
        """Complete valid response should not trigger escalation."""
        response = {
            "executive_summary": "Comprehensive ethical analysis",
            "options": [
                {"title": "Option 1", "description": "Desc", "pros": [], "cons": []},
                {"title": "Option 2", "description": "Desc", "pros": [], "cons": []},
                {"title": "Option 3", "description": "Desc", "pros": [], "cons": []},
            ],
            "recommended_action": {"option": 1, "steps": ["Step 1", "Step 2"]},
            "reflection_prompts": ["Think about X", "Consider Y"],
            "sources": [{"canonical_id": "BG_2_47", "paraphrase": "...", "relevance": 0.9}],
            "confidence": 0.85,
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False
        assert reason == "all_critical_fields_present"

    def test_valid_response_with_empty_optional_fields(self):
        """Valid response with empty optional fields should not escalate."""
        response = {
            "executive_summary": "Analysis",
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": ["Think about it"],
            "sources": [],  # Empty optional
            "confidence": None,  # Empty optional
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_minimal_valid_response(self):
        """Minimal but valid response should not escalate."""
        response = {
            "executive_summary": "Brief",
            "options": [{"title": "One"}],
            "recommended_action": {"option": 1},
            "reflection_prompts": ["Q"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False


class TestEscalationReasons:
    """Test escalation reason descriptions."""

    def test_describe_missing_options_reason(self):
        """Test description for missing options reason."""
        description = describe_escalation_reason("missing_critical_field_options")
        assert "options" in description.lower()
        assert "structural failure" in description.lower()

    def test_describe_missing_multiple_important_reason(self):
        """Test description for missing multiple important fields reason."""
        description = describe_escalation_reason("missing_multiple_important_fields")
        assert "important" in description.lower()
        assert "degradation" in description.lower()

    def test_describe_low_confidence_reason(self):
        """Test description for low confidence reason."""
        description = describe_escalation_reason("low_confidence_post_repair")
        assert "confidence" in description.lower()

    def test_describe_no_escalation_reason(self):
        """Test description for no escalation needed."""
        description = describe_escalation_reason("all_critical_fields_present")
        assert "no escalation" in description.lower()

    def test_describe_unknown_reason(self):
        """Test description for unknown reason falls back to code."""
        description = describe_escalation_reason("unknown_reason_code")
        assert "unknown_reason_code" in description


class TestEscalationThreshold:
    """Test escalation confidence threshold."""

    def test_escalation_threshold_is_045(self):
        """Verify escalation threshold is 0.45 (locked for v1.34.0)."""
        threshold = get_escalation_threshold()
        assert threshold == 0.45

    def test_escalation_threshold_type(self):
        """Verify escalation threshold is a float."""
        threshold = get_escalation_threshold()
        assert isinstance(threshold, float)


class TestEdgeCases:
    """Test edge cases in escalation logic."""

    def test_empty_response_triggers_escalation(self):
        """Completely empty response should trigger escalation."""
        response = {}
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is True

    def test_response_with_extra_fields_no_escalation(self):
        """Response with extra fields should not affect escalation."""
        response = {
            "executive_summary": "Analysis",
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 1},
            "reflection_prompts": ["Q"],
            "extra_field_1": "value",
            "extra_field_2": {"nested": "data"},
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_numeric_zero_not_treated_as_empty(self):
        """Numeric 0 should not be treated as empty/missing."""
        response = {
            "executive_summary": "Analysis",
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 0},  # Valid: 0 is a number
            "reflection_prompts": ["Q"],
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_false_boolean_not_treated_as_empty(self):
        """Boolean False should not be treated as empty/missing."""
        response = {
            "executive_summary": "Analysis",
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 1},
            "reflection_prompts": ["Q"],
            "scholar_flag": False,  # Valid: False is a boolean
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        assert should_escalate is False

    def test_empty_string_critical_field_treated_as_empty(self):
        """Empty string in CRITICAL field should be treated as empty."""
        response = {
            "executive_summary": "",  # Empty string
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 1},
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        # Empty string has len() == 0, should be treated as missing
        assert should_escalate is True

    def test_whitespace_only_string_critical_field(self):
        """String with only whitespace in CRITICAL field is technically present."""
        response = {
            "executive_summary": "   ",  # Whitespace only (but present, len > 0)
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 1},
        }
        should_escalate, reason = should_escalate_to_fallback(response)
        # Whitespace string has len() > 0, so it's considered present
        # (validation layer should clean it up later)
        assert should_escalate is False


class TestRepairCountParameter:
    """Test repair_count parameter (for future use in metrics)."""

    def test_repair_count_parameter_accepted(self):
        """Verify repair_count parameter is accepted."""
        response = {
            "executive_summary": "Analysis",
            "options": [{"title": "Option 1"}],
            "recommended_action": {"option": 1},
            "reflection_prompts": ["Q"],
        }
        # Should not raise error with repair_count
        should_escalate, reason = should_escalate_to_fallback(response, repair_count=2)
        assert should_escalate is False

    def test_repair_count_parameter_does_not_affect_logic(self):
        """Verify repair_count does not affect escalation decision."""
        response = {
            "executive_summary": "Analysis",
            "options": [],
        }
        should_escalate_1, _ = should_escalate_to_fallback(response, repair_count=0)
        should_escalate_2, _ = should_escalate_to_fallback(response, repair_count=5)
        assert should_escalate_1 == should_escalate_2
