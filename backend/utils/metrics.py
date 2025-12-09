"""Prometheus metrics definitions for Geetanjali application."""

from prometheus_client import Gauge, Counter


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

llm_requests_total = Counter(
    "geetanjali_llm_requests_total",
    "Total LLM requests by provider and status",
    ["provider", "status"],
)

llm_tokens_total = Counter(
    "geetanjali_llm_tokens_total",
    "Total LLM tokens by provider and type",
    ["provider", "token_type"],
)

# ChromaDB/Vector Store Metrics
chromadb_up = Gauge(
    "geetanjali_chromadb_up",
    "ChromaDB availability (1=up, 0=down)",
)

chromadb_collection_count = Gauge(
    "geetanjali_chromadb_collection_count",
    "Number of vectors in ChromaDB collection",
)
