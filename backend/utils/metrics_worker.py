"""Worker-specific metrics imports for the RQ worker service.

This module imports ONLY event-based metrics that worker should expose.
It does NOT import from utils.metrics (which would register business gauges).

## Metrics Architecture

Each Python process has its OWN Prometheus registry. When both are scraped:

1. **Counters/Histograms**: Prometheus aggregates from both sources.
   Use `sum()` in queries to get total.

2. **Circuit Breaker State Gauges**: Both expose these. Use `max()` to see worst state.

3. **Business/Infra Gauges**: Only backend exposes. Worker does NOT import these.

## What This Module Registers

Importing this module registers these metrics in the worker's registry:
- LLM counters (llm_requests_total, llm_tokens_total, llm_fallback_total)
- LLM circuit breaker state
- Email counters and histogram
- Email circuit breaker state
- Cache hit/miss counters
- Vector search fallback counter
- ChromaDB circuit breaker state
- Circuit breaker transition counter
"""

# LLM Metrics - from dedicated module
# Event Metrics - from dedicated module (NOT from utils.metrics!)
from utils.metrics_events import (
    cache_hits_total,
    cache_misses_total,
    chromadb_circuit_breaker_state,
    circuit_breaker_transitions_total,
    email_circuit_breaker_state,
    email_send_duration_seconds,
    email_sends_total,
    vector_search_fallback_total,
)
from utils.metrics_llm import (
    llm_circuit_breaker_state,
    llm_fallback_total,
    llm_requests_total,
    llm_tokens_total,
)

__all__ = [
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
]
