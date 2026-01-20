"""LLM-specific Prometheus metrics for worker service.

These metrics are separated from the main metrics module so the worker
can import only LLM metrics without registering all business metrics
(which would create duplicates with the backend).
"""

from prometheus_client import Counter, Gauge

# LLM Request Metrics
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

# LLM Fallback Metrics
llm_fallback_total = Counter(
    "geetanjali_llm_fallback_total",
    "Total LLM fallback events by primary and fallback provider",
    ["primary", "fallback", "reason"],
)

# LLM Circuit Breaker Metrics (one per provider)
# Values: 0=closed, 1=half_open, 2=open
llm_circuit_breaker_state = Gauge(
    "geetanjali_llm_circuit_breaker_state",
    "LLM circuit breaker state by provider (0=closed, 1=half_open, 2=open)",
    ["provider"],
)

# ============================================================
# Cost Tracking Metrics
# ============================================================
# Track LLM API costs for monitoring and anomaly detection

consultation_cost_total = Counter(
    "geetanjali_consultation_cost_usd_total",
    "Cumulative LLM consultation costs in USD (by provider)",
    labelnames=["provider"],
)

consultation_tokens_total = Counter(
    "geetanjali_consultation_tokens_total",
    "Total tokens used (by provider)",
    labelnames=["provider"],
)

consultation_cost_per_ip_gauge = Gauge(
    "geetanjali_consultation_cost_per_ip",
    "Estimated daily LLM cost per IP (updated after each consultation)",
    labelnames=["ip", "provider"],
)

daily_limit_hits = Counter(
    "geetanjali_daily_limit_exceeded_total",
    "Times daily consultation limit was exceeded (by tracking type)",
    labelnames=["tracking_type"],
)

request_validation_rejected = Counter(
    "geetanjali_request_validation_rejected_total",
    "Requests rejected by validation layer (by reason)",
    labelnames=["reason"],
)


def track_consultation_cost(
    ip: str,
    provider: str,
    estimated_tokens: int,
    cost_per_1k_tokens: float = 0.0015,
) -> float:
    """
    Track consultation cost after successful LLM call.

    Increments cost counters and updates per-IP gauge.

    Args:
        ip: Client IP address
        provider: LLM provider (gemini, anthropic, ollama)
        estimated_tokens: Tokens consumed
        cost_per_1k_tokens: Cost per 1K tokens (provider-specific)

    Returns:
        float: Estimated cost in USD

    Example:
        >>> # After Gemini call uses 500 tokens
        >>> cost = track_consultation_cost("203.0.113.42", "gemini", 500)
        >>> print(f"Cost: ${cost}")
        Cost: $0.00075
    """
    cost = (estimated_tokens / 1000) * cost_per_1k_tokens

    # Increment cumulative counters
    consultation_cost_total.labels(provider=provider).inc(cost)
    consultation_tokens_total.labels(provider=provider).inc(estimated_tokens)

    # Update per-IP gauge (rough daily estimate)
    consultation_cost_per_ip_gauge.labels(ip=ip, provider=provider).set(cost)

    return cost


def track_validation_rejection(reason: str) -> None:
    """
    Track request rejected by validation.

    Args:
        reason: Why rejected (token_too_large, duplicate, etc.)
    """
    request_validation_rejected.labels(reason=reason).inc()


def track_daily_limit_hit(tracking_type: str) -> None:
    """
    Track when daily limit is exceeded.

    Args:
        tracking_type: How user was tracked (ip, session)
    """
    daily_limit_hits.labels(tracking_type=tracking_type).inc()
