"""LLM-specific Prometheus metrics for worker service.

These metrics are separated from the main metrics module so the worker
can import only LLM metrics without registering all business metrics
(which would create duplicates with the backend).
"""

from prometheus_client import Counter, Gauge, Histogram

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

# JSON Extraction Failure Metrics
json_extraction_failed = Counter(
    "geetanjali_json_extraction_failed_total",
    "JSON extraction failures from LLM responses (by provider)",
    labelnames=["provider"],
)

json_extraction_escalation = Counter(
    "geetanjali_json_extraction_escalation_total",
    "Escalations to fallback provider due to JSON extraction failure",
    labelnames=["primary_provider", "fallback_provider", "status"],
)

# ============================================================
# Intelligent Escalation Metrics (v1.34.0+)
# ============================================================

escalation_reasons = Counter(
    "geetanjali_escalation_reasons_total",
    "Escalation events by reason (structural failures)",
    labelnames=["reason", "provider"],
)

repair_success_by_field = Counter(
    "geetanjali_repair_success_total",
    "Repair attempts by field and outcome",
    labelnames=["field", "status"],  # status: success, failed, skipped
)

confidence_post_repair = Histogram(
    "geetanjali_confidence_post_repair",
    "Confidence distribution after repair by provider",
    labelnames=["provider"],
    buckets=[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
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


def track_json_extraction_failure(provider: str) -> None:
    """
    Track JSON extraction failure from LLM response.

    Args:
        provider: LLM provider that returned unparseable JSON
    """
    json_extraction_failed.labels(provider=provider).inc()


def track_json_extraction_escalation(
    primary_provider: str, fallback_provider: str, status: str
) -> None:
    """
    Track escalation to fallback provider due to extraction failure.

    Args:
        primary_provider: Provider that failed
        fallback_provider: Provider being escalated to
        status: Escalation result (success, failed)
    """
    json_extraction_escalation.labels(
        primary_provider=primary_provider,
        fallback_provider=fallback_provider,
        status=status,
    ).inc()


def track_escalation_reason(reason: str, provider: str) -> None:
    """
    Track escalation event by reason and provider.

    Args:
        reason: Escalation reason code (missing_critical_field_*, missing_multiple_important_fields, etc.)
        provider: Primary provider that triggered escalation (e.g., 'gemini', 'anthropic')

    Example:
        >>> track_escalation_reason("missing_critical_field_options", "gemini")
    """
    escalation_reasons.labels(reason=reason, provider=provider).inc()


def track_repair_success(field: str, status: str) -> None:
    """
    Track repair attempt outcome by field.

    Args:
        field: Field that was repaired (options, recommended_action, executive_summary, etc.)
        status: Repair outcome (success, failed, skipped)

    Example:
        >>> track_repair_success("options", "success")
        >>> track_repair_success("reflection_prompts", "skipped")
    """
    repair_success_by_field.labels(field=field, status=status).inc()


def track_confidence_post_repair(provider: str, confidence: float) -> None:
    """
    Track confidence distribution after repair.

    Args:
        provider: LLM provider (gemini, anthropic, ollama)
        confidence: Final confidence value (0.0-1.0)

    Example:
        >>> track_confidence_post_repair("gemini", 0.72)
    """
    confidence_post_repair.labels(provider=provider).observe(confidence)
