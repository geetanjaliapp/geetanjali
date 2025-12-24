"""Prometheus metrics definitions for Geetanjali application."""

from prometheus_client import Gauge, Counter, Histogram


# Business Metrics
consultations_total = Gauge(
    "geetanjali_consultations_total",
    "Total number of consultations in the system",
)

verses_served_total = Gauge(
    "geetanjali_verses_served_total",
    "Total number of verses served across all consultations",
)

exports_total = Gauge(
    "geetanjali_exports_total",
    "Total number of exports generated",
)

registered_users_total = Gauge(
    "geetanjali_registered_users_total",
    "Total number of registered users",
)

active_users_24h = Gauge(
    "geetanjali_active_users_24h",
    "Number of users active in the last 24 hours",
)

consultations_24h = Gauge(
    "geetanjali_consultations_24h",
    "Number of consultations completed in the last 24 hours",
)

signups_24h = Gauge(
    "geetanjali_signups_24h",
    "Number of new user registrations in the last 24 hours",
)

consultation_completion_rate = Gauge(
    "geetanjali_consultation_completion_rate",
    "Ratio of completed to total consultations (0-1)",
)

exports_24h = Gauge(
    "geetanjali_exports_24h",
    "Number of exports generated in the last 24 hours",
)

avg_messages_per_case = Gauge(
    "geetanjali_avg_messages_per_case",
    "Average number of messages per consultation",
)

# Infrastructure Metrics
redis_connections = Gauge(
    "geetanjali_redis_connections",
    "Number of active Redis connections",
)

redis_memory_usage_percent = Gauge(
    "geetanjali_redis_memory_usage_percent",
    "Redis memory usage as percentage of maxmemory",
)

# Worker/Queue Metrics
queue_depth = Gauge(
    "geetanjali_queue_depth",
    "Number of jobs in the RQ queue",
)

worker_count = Gauge(
    "geetanjali_worker_count",
    "Number of active RQ workers",
)

# Error Metrics
api_errors_total = Counter(
    "geetanjali_api_errors_total",
    "Total API errors by type",
    ["error_type", "endpoint"],
)

# PostgreSQL Metrics
postgres_connections_active = Gauge(
    "geetanjali_postgres_connections_active",
    "Number of active PostgreSQL connections",
)

postgres_connections_idle = Gauge(
    "geetanjali_postgres_connections_idle",
    "Number of idle PostgreSQL connections",
)

postgres_database_size_bytes = Gauge(
    "geetanjali_postgres_database_size_bytes",
    "PostgreSQL database size in bytes",
)

postgres_up = Gauge(
    "geetanjali_postgres_up",
    "PostgreSQL availability (1=up, 0=down)",
)

# LLM/Ollama Metrics
ollama_up = Gauge(
    "geetanjali_ollama_up",
    "Ollama availability (1=up, 0=down)",
)

ollama_models_loaded = Gauge(
    "geetanjali_ollama_models_loaded",
    "Number of models loaded in Ollama",
)

# LLM request/token metrics are defined in metrics_llm.py
# Re-export for backward compatibility with existing imports
from utils.metrics_llm import llm_requests_total, llm_tokens_total  # noqa: E402, F401

# ChromaDB/Vector Store Metrics
chromadb_up = Gauge(
    "geetanjali_chromadb_up",
    "ChromaDB availability (1=up, 0=down)",
)

chromadb_collection_count = Gauge(
    "geetanjali_chromadb_collection_count",
    "Number of vectors in ChromaDB collection",
)

chromadb_circuit_breaker_state = Gauge(
    "geetanjali_chromadb_circuit_breaker_state",
    "ChromaDB circuit breaker state (0=closed, 1=half_open, 2=open)",
)

# Newsletter & Engagement Metrics
newsletter_subscribers_total = Gauge(
    "geetanjali_newsletter_subscribers_total",
    "Total active newsletter subscribers",
)

newsletter_subscribers_by_time = Gauge(
    "geetanjali_newsletter_subscribers_by_time",
    "Newsletter subscribers by preferred send time",
    ["send_time"],
)

newsletter_emails_sent_24h = Gauge(
    "geetanjali_newsletter_emails_sent_24h",
    "Newsletter emails sent in the last 24 hours",
)

shared_cases_total = Gauge(
    "geetanjali_shared_cases_total",
    "Total shared cases by visibility mode",
    ["mode"],
)

case_views_24h = Gauge(
    "geetanjali_case_views_24h",
    "Views on shared cases in the last 24 hours",
)

feedback_positive_rate = Gauge(
    "geetanjali_feedback_positive_rate",
    "Percentage of positive feedback (0-1)",
)

# Email Metrics
email_sends_total = Counter(
    "geetanjali_email_sends_total",
    "Total email send attempts by type and result",
    ["email_type", "result"],  # result: success, failure, circuit_open
)

email_send_duration_seconds = Histogram(
    "geetanjali_email_send_duration_seconds",
    "Email send duration in seconds",
    ["email_type"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

email_circuit_breaker_state = Gauge(
    "geetanjali_email_circuit_breaker_state",
    "Email circuit breaker state (0=closed, 1=half_open, 2=open)",
)
