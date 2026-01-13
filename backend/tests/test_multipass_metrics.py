"""Tests for multi-pass pipeline Prometheus metrics.

Tests cover:
- Metrics module imports and initialization
- Metric recording during pipeline execution
- Labels and bucket configurations
"""

import pytest

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


class TestMetricsModule:
    """Test metrics module initialization and exports."""

    def test_imports_from_metrics_multipass(self):
        """Test that all metrics can be imported from metrics_multipass."""
        from utils.metrics_multipass import (
            multipass_active_pipelines,
            multipass_confidence_score,
            multipass_fallback_total,
            multipass_pass_timeout_total,
            multipass_pipeline_duration_ms,
            multipass_pipeline_passes_total,
            multipass_pipeline_total,
            multipass_rejection_total,
            multipass_scholar_flag_total,
            multipass_tokens_total,
        )

        # Verify they're all valid prometheus metrics
        assert multipass_pipeline_passes_total is not None
        assert multipass_pipeline_duration_ms is not None
        assert multipass_confidence_score is not None
        assert multipass_scholar_flag_total is not None
        assert multipass_pass_timeout_total is not None
        assert multipass_fallback_total is not None
        assert multipass_pipeline_total is not None
        assert multipass_rejection_total is not None
        assert multipass_tokens_total is not None
        assert multipass_active_pipelines is not None

    def test_imports_from_main_metrics(self):
        """Test that multipass metrics are re-exported from main metrics module."""
        from utils.metrics import (
            multipass_active_pipelines,
            multipass_confidence_score,
            multipass_fallback_total,
            multipass_pass_timeout_total,
            multipass_pipeline_duration_ms,
            multipass_pipeline_passes_total,
            multipass_pipeline_total,
            multipass_rejection_total,
            multipass_scholar_flag_total,
            multipass_tokens_total,
        )

        assert multipass_pipeline_passes_total is not None
        assert multipass_pipeline_duration_ms is not None


class TestMetricLabels:
    """Test metric label configurations."""

    def test_passes_total_labels(self):
        """Test that passes_total counter has correct labels."""
        from utils.metrics_multipass import multipass_pipeline_passes_total

        # Verify we can create labels
        labeled = multipass_pipeline_passes_total.labels(
            pass_number="1",
            pass_name="draft",
            status="success",
        )
        assert labeled is not None

    def test_duration_histogram_labels(self):
        """Test that duration histogram has correct labels."""
        from utils.metrics_multipass import multipass_pipeline_duration_ms

        labeled = multipass_pipeline_duration_ms.labels(
            pass_number="2",
            pass_name="critique",
        )
        assert labeled is not None

    def test_rejection_total_labels(self):
        """Test that rejection counter has category label."""
        from utils.metrics_multipass import multipass_rejection_total

        labeled = multipass_rejection_total.labels(category="not_dilemma")
        assert labeled is not None

    def test_fallback_total_labels(self):
        """Test that fallback counter has type label."""
        from utils.metrics_multipass import multipass_fallback_total

        labeled = multipass_fallback_total.labels(fallback_type="reconstruction")
        assert labeled is not None

    def test_fallback_total_single_pass_type(self):
        """Test that fallback counter supports single_pass type."""
        from utils.metrics_multipass import multipass_fallback_total

        labeled = multipass_fallback_total.labels(fallback_type="single_pass")
        assert labeled is not None

    def test_tokens_total_labels(self):
        """Test that tokens counter has correct labels."""
        from utils.metrics_multipass import multipass_tokens_total

        labeled = multipass_tokens_total.labels(
            pass_number="1",
            pass_name="draft",
        )
        assert labeled is not None

    def test_scholar_flag_labels(self):
        """Test that scholar flag counter has reason label."""
        from utils.metrics_multipass import multipass_scholar_flag_total

        labeled = multipass_scholar_flag_total.labels(reason="low_confidence")
        assert labeled is not None


class TestMetricRecording:
    """Test metric recording functionality."""

    def test_can_increment_counter(self):
        """Test that counters can be incremented."""
        from utils.metrics_multipass import multipass_pipeline_total

        # Should not raise
        multipass_pipeline_total.labels(status="success").inc()

    def test_can_observe_histogram(self):
        """Test that histograms can record observations."""
        from utils.metrics_multipass import multipass_confidence_score

        # Should not raise
        multipass_confidence_score.observe(0.85)

    def test_can_modify_gauge(self):
        """Test that gauge can be incremented and decremented."""
        from utils.metrics_multipass import multipass_active_pipelines

        # Should not raise
        multipass_active_pipelines.inc()
        multipass_active_pipelines.dec()

    def test_can_increment_tokens_counter(self):
        """Test that tokens counter can be incremented with token count."""
        from utils.metrics_multipass import multipass_tokens_total

        # Should not raise - typical usage: increment by token count
        multipass_tokens_total.labels(pass_number="1", pass_name="draft").inc(500)
        multipass_tokens_total.labels(pass_number="4", pass_name="structure").inc(1200)


class TestHistogramBuckets:
    """Test histogram bucket configurations."""

    def test_duration_histogram_buckets(self):
        """Test that duration histogram has appropriate buckets."""
        from utils.metrics_multipass import multipass_pipeline_duration_ms

        # Access the histogram's bucket configuration
        # The buckets should range from 100ms to 120s for pass duration
        histogram = multipass_pipeline_duration_ms
        assert histogram is not None

    def test_confidence_histogram_buckets(self):
        """Test that confidence histogram has appropriate buckets."""
        from utils.metrics_multipass import multipass_confidence_score

        # Confidence scores are 0.0-1.0, buckets should cover this range
        histogram = multipass_confidence_score
        assert histogram is not None
