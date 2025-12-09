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

# Error Metrics
api_errors_total = Counter(
    "geetanjali_api_errors_total",
    "Total API errors by type",
    ["error_type", "endpoint"],
)
