"""Multi-pass pipeline Prometheus metrics.

These metrics track the 5-pass consultation pipeline performance:
- Pass 0: Acceptance (validation gate)
- Pass 1: Draft (creative reasoning)
- Pass 2: Critique (analytical review)
- Pass 3: Refine (disciplined rewrite)
- Pass 4: Structure (JSON formatting)

Metrics are separated from main metrics module so worker can import
only multipass metrics without registering all business metrics.
"""

from prometheus_client import Counter, Gauge, Histogram

# Pass execution metrics
multipass_pipeline_passes_total = Counter(
    "geetanjali_multipass_passes_total",
    "Multi-pass pipeline passes executed",
    ["pass_number", "pass_name", "status"],  # status: success, error, timeout, retry
)

multipass_pipeline_duration_ms = Histogram(
    "geetanjali_multipass_duration_ms",
    "Multi-pass pipeline execution time in milliseconds",
    ["pass_number", "pass_name"],
    buckets=[100, 500, 1000, 2000, 5000, 10000, 30000, 60000, 120000],
)

# Quality metrics
multipass_confidence_score = Histogram(
    "geetanjali_multipass_confidence_score",
    "Confidence scores from multi-pass pipeline outputs",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0],
)

multipass_scholar_flag_total = Counter(
    "geetanjali_multipass_scholar_flag_total",
    "Multi-pass outputs flagged for expert review",
    ["reason"],  # reason: low_confidence, reconstruction, pass_failure
)

# Error and fallback metrics
multipass_pass_timeout_total = Counter(
    "geetanjali_multipass_timeout_total",
    "Multi-pass pass timeouts",
    ["pass_number", "pass_name"],
)

multipass_fallback_total = Counter(
    "geetanjali_multipass_fallback_total",
    "Multi-pass pipeline fallback events",
    ["fallback_type"],  # fallback_type: reconstruction, single_pass, generic_response
)

# Pipeline-level metrics
multipass_pipeline_total = Counter(
    "geetanjali_multipass_pipeline_total",
    "Total multi-pass pipeline executions",
    ["status"],  # status: success, partial_success, failed
)

multipass_rejection_total = Counter(
    "geetanjali_multipass_rejection_total",
    "Pass 0 rejections by category",
    ["category"],  # not_dilemma, unethical_core, too_vague, harmful_intent, format_error
)

# Token usage tracking
multipass_tokens_total = Counter(
    "geetanjali_multipass_tokens_total",
    "Tokens used in multi-pass pipeline",
    ["pass_number", "pass_name"],
)

# Current state gauge (for dashboard)
multipass_active_pipelines = Gauge(
    "geetanjali_multipass_active_pipelines",
    "Number of currently running multi-pass pipelines",
)
