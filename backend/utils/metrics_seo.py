"""SEO generation Prometheus metrics.

These metrics track SEO page generation performance and health.
"""

from prometheus_client import Counter, Gauge, Histogram

# SEO Generation Duration Metrics
seo_generation_duration_seconds = Histogram(
    "geetanjali_seo_generation_duration_seconds",
    "Time to generate SEO pages in seconds",
    ["page_type"],  # verse, chapter, topic, featured, daily, static
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# SEO Pages Total (Gauge - current state)
seo_pages_total = Gauge(
    "geetanjali_seo_pages_total",
    "Total SEO pages tracked by type",
    ["page_type"],  # verse, chapter, topic, featured, daily, static
)

# SEO Generation Events (Counter - cumulative)
seo_generation_total = Counter(
    "geetanjali_seo_generation_total",
    "Total SEO generation events by trigger and result",
    [
        "trigger",
        "result",
    ],  # trigger: startup, admin, deploy; result: success, error, skipped
)

# SEO Generation Batch Metrics
seo_generation_pages_generated = Gauge(
    "geetanjali_seo_generation_pages_generated",
    "Number of pages generated in last batch",
)

seo_generation_pages_skipped = Gauge(
    "geetanjali_seo_generation_pages_skipped",
    "Number of pages skipped in last batch (unchanged)",
)

seo_generation_pages_errors = Gauge(
    "geetanjali_seo_generation_pages_errors",
    "Number of page errors in last batch",
)

seo_generation_last_duration_seconds = Gauge(
    "geetanjali_seo_generation_last_duration_seconds",
    "Duration of last complete SEO generation run",
)

# SEO Health Metrics
seo_generation_last_success_timestamp = Gauge(
    "geetanjali_seo_generation_last_success_timestamp",
    "Unix timestamp of last successful generation",
)

seo_pages_stale = Gauge(
    "geetanjali_seo_pages_stale",
    "Number of SEO pages that need regeneration",
)
