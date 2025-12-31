"""Tests to ensure worker doesn't expose backend-only metrics.

This test prevents regressions where worker accidentally imports
business/infrastructure gauges that should only come from backend.
"""


class TestWorkerMetricsIsolation:
    """Verify worker only registers event-based metrics."""

    def test_worker_does_not_import_business_metrics(self):
        """Worker should NOT register business gauges."""
        # Import worker metrics module (simulates what worker_api.py does)

        # Clear any existing metrics first by getting a fresh count
        # Note: We can't fully clear the registry, so we check what's registered

        # These business metrics should NOT be registered by worker imports
        business_metrics = [
            "geetanjali_consultations_total",
            "geetanjali_registered_users_total",
            "geetanjali_signups_24h",
            "geetanjali_consultations_24h",
            "geetanjali_feedback_positive_rate",
            "geetanjali_newsletter_subscribers_total",
        ]

        # Import worker module
        import utils.metrics_worker  # noqa: F401

        # Check that business metrics are NOT in worker's imports
        # by verifying the worker module doesn't re-export them
        worker_exports = dir(utils.metrics_worker)

        for metric in business_metrics:
            # Remove prefix for attribute name check
            attr_name = metric.replace("geetanjali_", "")
            assert attr_name not in worker_exports, (
                f"Worker should not export {attr_name}. "
                f"Business metrics belong in metrics_business.py only."
            )

    def test_worker_does_not_import_infra_metrics(self):
        """Worker should NOT register infrastructure gauges."""
        import utils.metrics_worker  # noqa: F401

        infra_metrics = [
            "postgres_up",
            "postgres_connections_active",
            "redis_connections",
            "redis_memory_usage_percent",
            "ollama_up",
            "chromadb_up",
            "queue_depth",
            "worker_count",
            "failed_jobs",
        ]

        worker_exports = dir(utils.metrics_worker)

        for metric in infra_metrics:
            assert metric not in worker_exports, (
                f"Worker should not export {metric}. "
                f"Infrastructure metrics belong in metrics_infra.py only."
            )

    def test_worker_exports_only_event_metrics(self):
        """Worker should only export event-based counters and CB states."""
        import utils.metrics_worker

        # These are the ONLY metrics worker should export
        allowed_exports = {
            # LLM
            "llm_requests_total",
            "llm_tokens_total",
            "llm_fallback_total",
            "llm_circuit_breaker_state",
            # Email
            "email_sends_total",
            "email_send_duration_seconds",
            "email_circuit_breaker_state",
            # Cache
            "cache_hits_total",
            "cache_misses_total",
            # Vector/RAG
            "vector_search_fallback_total",
            "chromadb_circuit_breaker_state",
            # Circuit Breakers
            "circuit_breaker_transitions_total",
        }

        # Get actual exports (filter out dunder methods and module imports)
        actual_exports = {
            name
            for name in dir(utils.metrics_worker)
            if not name.startswith("_") and name not in {"annotations"}
        }

        # Check for unexpected exports
        unexpected = actual_exports - allowed_exports
        assert not unexpected, (
            f"Worker exports unexpected metrics: {unexpected}. "
            f"Only event-based metrics should be in metrics_worker.py"
        )

    def test_metrics_module_structure(self):
        """Verify metrics are split into correct modules."""
        # Business metrics should be in metrics_business
        from utils.metrics_business import consultations_total, registered_users_total

        assert consultations_total is not None
        assert registered_users_total is not None

        # Infra metrics should be in metrics_infra
        from utils.metrics_infra import postgres_up, redis_connections

        assert postgres_up is not None
        assert redis_connections is not None

        # Event metrics should be in metrics_events
        from utils.metrics_events import cache_hits_total, email_sends_total

        assert email_sends_total is not None
        assert cache_hits_total is not None

        # LLM metrics should be in metrics_llm
        from utils.metrics_llm import llm_requests_total

        assert llm_requests_total is not None

    def test_backend_facade_exports_all(self):
        """Backend metrics.py facade should export all metrics."""
        from utils import metrics

        # Should have business metrics
        assert hasattr(metrics, "consultations_total")
        assert hasattr(metrics, "registered_users_total")

        # Should have infra metrics
        assert hasattr(metrics, "postgres_up")
        assert hasattr(metrics, "redis_connections")

        # Should have event metrics
        assert hasattr(metrics, "email_sends_total")
        assert hasattr(metrics, "cache_hits_total")

        # Should have LLM metrics
        assert hasattr(metrics, "llm_requests_total")
