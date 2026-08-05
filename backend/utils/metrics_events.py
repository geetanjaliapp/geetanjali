"""Event-based metrics - BOTH BACKEND AND WORKER.

These counters/histograms/gauges track events that can occur in either process.
Prometheus aggregates counters from both sources using sum().
Circuit breaker states use max() to show worst state across processes.
"""

from prometheus_client import Counter, Gauge, Histogram

# API Error Counter (backend only in practice, but safe to import)
api_errors_total = Counter(
    "geetanjali_api_errors_total",
    "Total API errors by type",
    ["error_type", "endpoint"],
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

# Cache Metrics
cache_hits_total = Counter(
    "geetanjali_cache_hits_total",
    "Total cache hits by key type",
    ["key_type"],  # verse, search, metadata, case, rag
)

cache_misses_total = Counter(
    "geetanjali_cache_misses_total",
    "Total cache misses by key type",
    ["key_type"],
)

# Vector Search Metrics
vector_search_fallback_total = Counter(
    "geetanjali_vector_search_fallback_total",
    "Total vector search fallbacks to SQL by reason",
    ["reason"],  # circuit_open, error
)

chromadb_circuit_breaker_state = Gauge(
    "geetanjali_chromadb_circuit_breaker_state",
    "ChromaDB circuit breaker state (0=closed, 1=half_open, 2=open)",
)

# Circuit Breaker Transitions (all services)
circuit_breaker_transitions_total = Counter(
    "geetanjali_circuit_breaker_transitions_total",
    "Circuit breaker state transitions by service and transition type",
    ["service", "from_state", "to_state"],
)

# TTS (Text-to-Speech) Metrics
tts_requests_total = Counter(
    "geetanjali_tts_requests_total",
    "Total TTS API requests by language and result",
    ["lang", "result"],  # result: success, error, cache_hit
)

tts_request_duration_seconds = Histogram(
    "geetanjali_tts_request_duration_seconds",
    "TTS generation duration in seconds (excludes cache hits)",
    ["lang"],
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 30.0],
)

# Client-Side Degradation Metrics
#
# Reported by the browser to a same-origin endpoint rather than to third-party analytics.
# The CSP added in d8c34a5 blocked Umami, which is where TTS fallbacks were being reported --
# so the signal that would have revealed the outage shared a failure domain with the outage.
# A same-origin counter cannot be blocked by a policy that leaves the app itself working.
#
# `path` is a closed set (see api/telemetry.py); anything unrecognised is bucketed as "other"
# so a stale client cannot inflate label cardinality.
client_degradation_total = Counter(
    "geetanjali_client_degradation_total",
    "Client-side graceful-degradation events reported by the browser",
    ["path"],
)
