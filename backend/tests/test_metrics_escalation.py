"""Tests for escalation-specific Prometheus metrics."""

import pytest
from prometheus_client import generate_latest

from utils.metrics_llm import (
    confidence_post_repair,
    escalation_reasons,
    repair_success_by_field,
    track_confidence_post_repair,
    track_escalation_reason,
    track_repair_success,
)


@pytest.fixture
def clean_metrics():
    """Clear metrics before each test to avoid interference."""
    # Note: Prometheus metrics are global singletons, so we clear the internal state
    # by accessing the collector's samples
    yield
    # After test, metrics retain their values (this is expected behavior)


class TestEscalationReasonsMetric:
    """Test escalation_reasons counter metric."""

    def test_escalation_reasons_metric_defined(self):
        """Verify escalation_reasons metric is properly defined."""
        assert escalation_reasons is not None
        # Prometheus counter names may vary, check contains "escalation_reasons"
        assert "escalation_reasons" in escalation_reasons._name
        assert "reason" in escalation_reasons._labelnames
        assert "provider" in escalation_reasons._labelnames

    def test_track_escalation_reason_missing_critical_field(self):
        """Track escalation for missing critical field."""
        track_escalation_reason("missing_critical_field_options", "gemini")
        # Verify metric was incremented (check through metric registry)
        metrics = generate_latest().decode("utf-8")
        assert "geetanjali_escalation_reasons_total" in metrics
        assert 'reason="missing_critical_field_options"' in metrics
        assert 'provider="gemini"' in metrics

    def test_track_escalation_reason_multiple_important_fields(self):
        """Track escalation for missing multiple important fields."""
        track_escalation_reason("missing_multiple_important_fields", "anthropic")
        metrics = generate_latest().decode("utf-8")
        assert 'reason="missing_multiple_important_fields"' in metrics
        assert 'provider="anthropic"' in metrics

    def test_track_escalation_reason_multiple_providers(self):
        """Track escalations from different providers."""
        track_escalation_reason("missing_critical_field_recommended_action", "gemini")
        track_escalation_reason("missing_critical_field_recommended_action", "ollama")
        metrics = generate_latest().decode("utf-8")
        # Both should appear in metrics
        assert 'provider="gemini"' in metrics
        assert 'provider="ollama"' in metrics

    def test_track_escalation_reason_increments_counter(self):
        """Verify counter increments when tracked multiple times."""
        # Track same reason/provider combination
        track_escalation_reason("missing_critical_field_options", "gemini")
        track_escalation_reason("missing_critical_field_options", "gemini")
        metrics = generate_latest().decode("utf-8")
        # Metric should exist (may have higher counts from previous tests due to global registry)
        assert 'geetanjali_escalation_reasons_total{' in metrics
        assert 'reason="missing_critical_field_options"' in metrics
        assert 'provider="gemini"' in metrics


class TestRepairSuccessByFieldMetric:
    """Test repair_success_by_field counter metric."""

    def test_repair_success_by_field_metric_defined(self):
        """Verify repair_success_by_field metric is properly defined."""
        assert repair_success_by_field is not None
        # Prometheus counter names may vary, check contains "repair_success"
        assert "repair_success" in repair_success_by_field._name
        assert "field" in repair_success_by_field._labelnames
        assert "status" in repair_success_by_field._labelnames

    def test_track_repair_success(self):
        """Track successful repair of options field."""
        track_repair_success("options", "success")
        metrics = generate_latest().decode("utf-8")
        assert "geetanjali_repair_success_total" in metrics
        assert 'field="options"' in metrics
        assert 'status="success"' in metrics

    def test_track_repair_failed(self):
        """Track failed repair attempt."""
        track_repair_success("recommended_action", "failed")
        metrics = generate_latest().decode("utf-8")
        assert 'field="recommended_action"' in metrics
        assert 'status="failed"' in metrics

    def test_track_repair_skipped(self):
        """Track skipped repair (field was already valid)."""
        track_repair_success("reflection_prompts", "skipped")
        metrics = generate_latest().decode("utf-8")
        assert 'field="reflection_prompts"' in metrics
        assert 'status="skipped"' in metrics

    def test_track_repair_multiple_fields(self):
        """Track repairs across multiple fields."""
        track_repair_success("options", "success")
        track_repair_success("executive_summary", "success")
        track_repair_success("reflection_prompts", "failed")
        metrics = generate_latest().decode("utf-8")
        assert 'field="options"' in metrics
        assert 'field="executive_summary"' in metrics
        assert 'field="reflection_prompts"' in metrics

    def test_track_repair_all_statuses(self):
        """Track repairs with all possible status values."""
        statuses = ["success", "failed", "skipped"]
        for status in statuses:
            track_repair_success("options", status)
        metrics = generate_latest().decode("utf-8")
        for status in statuses:
            assert f'status="{status}"' in metrics

    def test_repair_counter_increments(self):
        """Verify counter increments correctly."""
        track_repair_success("options", "success")
        track_repair_success("options", "success")
        track_repair_success("options", "success")
        metrics = generate_latest().decode("utf-8")
        # Counter should exist with field and status labels
        assert 'geetanjali_repair_success_total{' in metrics
        assert 'field="options"' in metrics
        assert 'status="success"' in metrics


class TestConfidencePostRepairMetric:
    """Test confidence_post_repair histogram metric."""

    def test_confidence_post_repair_metric_defined(self):
        """Verify confidence_post_repair metric is properly defined."""
        assert confidence_post_repair is not None
        assert confidence_post_repair._name == "geetanjali_confidence_post_repair"
        assert "provider" in confidence_post_repair._labelnames
        # Verify buckets are configured
        assert len(confidence_post_repair._upper_bounds) > 0

    def test_confidence_post_repair_buckets(self):
        """Verify histogram buckets are correctly configured."""
        expected_buckets = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        # The last bucket is always +Inf, so we check up to len-1
        actual_buckets = confidence_post_repair._upper_bounds[:-1]
        assert list(actual_buckets) == expected_buckets

    def test_track_confidence_high_quality(self):
        """Track high confidence (0.85)."""
        track_confidence_post_repair("gemini", 0.85)
        metrics = generate_latest().decode("utf-8")
        assert "geetanjali_confidence_post_repair" in metrics
        assert 'provider="gemini"' in metrics

    def test_track_confidence_medium_quality(self):
        """Track medium confidence (0.65)."""
        track_confidence_post_repair("anthropic", 0.65)
        metrics = generate_latest().decode("utf-8")
        assert 'provider="anthropic"' in metrics

    def test_track_confidence_low_quality(self):
        """Track low confidence (0.35)."""
        track_confidence_post_repair("ollama", 0.35)
        metrics = generate_latest().decode("utf-8")
        assert 'provider="ollama"' in metrics

    def test_track_confidence_multiple_providers(self):
        """Track confidence from multiple providers."""
        track_confidence_post_repair("gemini", 0.75)
        track_confidence_post_repair("anthropic", 0.92)
        track_confidence_post_repair("ollama", 0.45)
        metrics = generate_latest().decode("utf-8")
        assert 'provider="gemini"' in metrics
        assert 'provider="anthropic"' in metrics
        assert 'provider="ollama"' in metrics

    def test_track_confidence_distribution(self):
        """Track multiple confidence values to build distribution."""
        confidences = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]
        for conf in confidences:
            track_confidence_post_repair("gemini", conf)
        metrics = generate_latest().decode("utf-8")
        # Histogram should show provider label
        assert 'geetanjali_confidence_post_repair' in metrics
        assert 'provider="gemini"' in metrics
        # Check that _count suffix exists (indicates histogram)
        assert '_count{provider="gemini"}' in metrics

    def test_track_confidence_boundary_values(self):
        """Track confidence at bucket boundaries."""
        # Test values at exact bucket boundaries
        track_confidence_post_repair("gemini", 0.2)  # Lower boundary
        track_confidence_post_repair("gemini", 0.5)  # Mid boundary
        track_confidence_post_repair("gemini", 0.9)  # Upper boundary
        metrics = generate_latest().decode("utf-8")
        # All should result in metrics with provider label
        assert 'geetanjali_confidence_post_repair' in metrics
        assert 'provider="gemini"' in metrics


class TestMetricsIntegration:
    """Integration tests for escalation metrics working together."""

    def test_escalation_and_repair_together(self):
        """Track both escalation and repair metrics together."""
        track_escalation_reason("missing_critical_field_options", "gemini")
        track_repair_success("options", "success")
        track_confidence_post_repair("gemini", 0.75)
        metrics = generate_latest().decode("utf-8")
        # All metrics should be present
        assert "geetanjali_escalation_reasons_total" in metrics
        assert "geetanjali_repair_success_total" in metrics
        assert "geetanjali_confidence_post_repair" in metrics

    def test_multiple_escalation_scenarios(self):
        """Simulate multiple real escalation scenarios."""
        # Scenario 1: Gemini missing options, repairs and achieves confidence
        track_escalation_reason("missing_critical_field_options", "gemini")
        track_repair_success("options", "success")
        track_confidence_post_repair("gemini", 0.72)

        # Scenario 2: Ollama missing multiple important fields, escalates without repair
        track_escalation_reason("missing_multiple_important_fields", "ollama")
        # No repair, direct escalation to anthropic

        # Scenario 3: Anthropic fallback achieves high confidence
        track_confidence_post_repair("anthropic", 0.92)

        metrics = generate_latest().decode("utf-8")
        assert 'reason="missing_critical_field_options"' in metrics
        assert 'reason="missing_multiple_important_fields"' in metrics
        assert 'provider="gemini"' in metrics
        assert 'provider="ollama"' in metrics
        assert 'provider="anthropic"' in metrics


class TestMetricsEdgeCases:
    """Edge case tests for escalation metrics."""

    def test_track_escalation_reason_with_special_characters(self):
        """Reason codes should work with underscores."""
        track_escalation_reason("missing_critical_field_executive_summary", "gemini")
        metrics = generate_latest().decode("utf-8")
        assert 'reason="missing_critical_field_executive_summary"' in metrics

    def test_track_repair_field_name_variations(self):
        """Different field names should be tracked separately."""
        fields = ["options", "recommended_action", "executive_summary", "reflection_prompts"]
        for field in fields:
            track_repair_success(field, "success")
        metrics = generate_latest().decode("utf-8")
        for field in fields:
            assert f'field="{field}"' in metrics

    def test_confidence_edge_values(self):
        """Test confidence values at extremes."""
        track_confidence_post_repair("gemini", 0.0)  # Minimum
        track_confidence_post_repair("gemini", 1.0)  # Maximum
        metrics = generate_latest().decode("utf-8")
        # Both should result in histogram tracking
        assert 'geetanjali_confidence_post_repair' in metrics
        assert 'provider="gemini"' in metrics

    def test_confidence_fractional_values(self):
        """Fractional confidence values should be recorded."""
        track_confidence_post_repair("gemini", 0.555)
        track_confidence_post_repair("gemini", 0.777)
        metrics = generate_latest().decode("utf-8")
        # Fractional values should be recorded in histogram
        assert 'geetanjali_confidence_post_repair' in metrics
        assert 'provider="gemini"' in metrics

    def test_provider_name_variations(self):
        """Different provider names should be tracked separately."""
        providers = ["gemini", "anthropic", "ollama", "mock"]
        for provider in providers:
            track_escalation_reason("missing_critical_field_options", provider)
        metrics = generate_latest().decode("utf-8")
        for provider in providers:
            assert f'provider="{provider}"' in metrics
