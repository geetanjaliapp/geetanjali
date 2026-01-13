"""Prometheus metrics - BACKEND FACADE.

This module re-exports all metrics for backward compatibility in backend.
DO NOT import this module in worker - it will register business/infra gauges.

For worker, import from:
- utils.metrics_llm (LLM counters)
- utils.metrics_events (email, cache, circuit breaker counters)
"""

# Re-export business metrics (backend-only gauges)
from utils.metrics_business import (
    active_users_24h,
    avg_messages_per_case,
    case_views_24h,
    consultation_completion_rate,
    consultations_24h,
    consultations_total,
    exports_24h,
    exports_total,
    feedback_positive_rate,
    newsletter_emails_sent_24h,
    newsletter_subscribers_by_time,
    newsletter_subscribers_total,
    registered_users_total,
    shared_cases_total,
    signups_24h,
    verses_served_total,
)

# Re-export event metrics (shared between backend and worker)
from utils.metrics_events import (
    api_errors_total,
    cache_hits_total,
    cache_misses_total,
    chromadb_circuit_breaker_state,
    circuit_breaker_transitions_total,
    email_circuit_breaker_state,
    email_send_duration_seconds,
    email_sends_total,
    tts_request_duration_seconds,
    tts_requests_total,
    vector_search_fallback_total,
)

# Re-export infrastructure metrics (backend-only gauges)
from utils.metrics_infra import (
    chromadb_collection_count,
    chromadb_up,
    failed_jobs,
    ollama_models_loaded,
    ollama_up,
    postgres_connections_active,
    postgres_connections_idle,
    postgres_database_size_bytes,
    postgres_up,
    queue_depth,
    redis_connections,
    redis_memory_usage_percent,
    worker_count,
)

# Re-export LLM metrics for backward compatibility
from utils.metrics_llm import (
    llm_circuit_breaker_state,
    llm_fallback_total,
    llm_requests_total,
    llm_tokens_total,
)

# Re-export multipass pipeline metrics
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

__all__ = [
    # Business
    "consultations_total",
    "verses_served_total",
    "exports_total",
    "registered_users_total",
    "active_users_24h",
    "consultations_24h",
    "signups_24h",
    "consultation_completion_rate",
    "exports_24h",
    "avg_messages_per_case",
    "newsletter_subscribers_total",
    "newsletter_subscribers_by_time",
    "newsletter_emails_sent_24h",
    "shared_cases_total",
    "case_views_24h",
    "feedback_positive_rate",
    # Infrastructure
    "redis_connections",
    "redis_memory_usage_percent",
    "queue_depth",
    "worker_count",
    "failed_jobs",
    "postgres_connections_active",
    "postgres_connections_idle",
    "postgres_database_size_bytes",
    "postgres_up",
    "ollama_up",
    "ollama_models_loaded",
    "chromadb_up",
    "chromadb_collection_count",
    # Events
    "api_errors_total",
    "email_sends_total",
    "email_send_duration_seconds",
    "email_circuit_breaker_state",
    "cache_hits_total",
    "cache_misses_total",
    "vector_search_fallback_total",
    "chromadb_circuit_breaker_state",
    "circuit_breaker_transitions_total",
    "tts_requests_total",
    "tts_request_duration_seconds",
    # LLM
    "llm_requests_total",
    "llm_tokens_total",
    "llm_fallback_total",
    "llm_circuit_breaker_state",
    # Multipass Pipeline
    "multipass_pipeline_passes_total",
    "multipass_pipeline_duration_ms",
    "multipass_confidence_score",
    "multipass_scholar_flag_total",
    "multipass_pass_timeout_total",
    "multipass_fallback_total",
    "multipass_pipeline_total",
    "multipass_rejection_total",
    "multipass_tokens_total",
    "multipass_active_pipelines",
]
