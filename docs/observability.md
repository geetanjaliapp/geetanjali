---
layout: default
title: Observability
description: Monitoring, metrics, Grafana dashboards, and alerting for Geetanjali.
---

# Observability

Prometheus + Grafana monitoring stack for Geetanjali.

## Overview

The observability stack provides metrics collection, visualization, and alerting. It runs as optional containers alongside the core application.

```
Backend /metrics ──┐
                   ├──▶ Prometheus (scrape 15s) ──▶ Grafana (dashboards + alerts)
Worker /metrics  ──┘
```

## Quick Start

```bash
# Start with observability
make obs-up
# Or: docker compose -f docker-compose.observability.yml up -d

# Access dashboards
# Production: https://grafana.geetanjaliapp.com
# Local dev: http://localhost:3000 (Grafana)
# Prometheus is internal-only (not exposed)
```

Default Grafana login: admin / (set GRAFANA_ADMIN_PASSWORD in .env)

## Metrics Architecture

Metrics are split across separate modules to prevent duplicate registration:

| Module | Scraped From | Purpose |
|--------|--------------|---------|
| `metrics_business.py` | Backend only | Business gauges (consultations, users, feedback) |
| `metrics_infra.py` | Backend only | Infrastructure gauges (postgres, redis, queue) |
| `metrics_events.py` | Both services | Event counters (cache, email, vector search) |
| `metrics_llm.py` | Worker only | LLM request counters and circuit breaker states |

**Why the split?** Each Python process has its own Prometheus registry. Without separation, both backend and worker would register the same gauges, causing duplicate/conflicting values.

## Metrics Reference

### Business Metrics (Backend only)

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_consultations_total` | Gauge | Total completed consultations |
| `geetanjali_consultations_24h` | Gauge | Consultations in last 24 hours |
| `geetanjali_consultation_completion_rate` | Gauge | Ratio of completed to total (0-1) |
| `geetanjali_active_users_24h` | Gauge | Unique users in last 24 hours |
| `geetanjali_registered_users_total` | Gauge | Total registered users |
| `geetanjali_signups_24h` | Gauge | New registrations in last 24 hours |
| `geetanjali_exports_total` | Gauge | Total exports (all formats) |
| `geetanjali_exports_24h` | Gauge | Exports in last 24 hours |
| `geetanjali_verses_served_total` | Gauge | Total verses cited across all outputs |
| `geetanjali_avg_messages_per_case` | Gauge | Average messages per consultation |
| `geetanjali_feedback_positive_rate` | Gauge | Percentage of positive feedback (0-1) |

### Newsletter Metrics (Backend only)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_newsletter_subscribers_total` | Gauge | - | Active verified subscribers |
| `geetanjali_newsletter_subscribers_by_time` | Gauge | `send_time` | Subscribers per time slot |
| `geetanjali_newsletter_emails_sent_24h` | Gauge | - | Emails delivered in last 24 hours |

### Sharing Metrics (Backend only)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_shared_cases_total` | Gauge | `mode` | Shared cases by visibility (public/link) |
| `geetanjali_case_views_24h` | Gauge | - | Views on shared cases in last 24 hours |

### SEO Metrics (Backend only)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_seo_pages_total` | Gauge | `page_type` | Generated pages by type (verse, chapter, topic) |
| `geetanjali_seo_generation_pages_generated` | Gauge | - | Pages generated in last run |
| `geetanjali_seo_generation_pages_skipped` | Gauge | - | Pages skipped (unchanged) |
| `geetanjali_seo_generation_pages_errors` | Gauge | - | Errors in last run |
| `geetanjali_seo_generation_last_duration_seconds` | Gauge | - | Last run duration |
| `geetanjali_seo_generation_last_success_timestamp` | Gauge | - | Last success Unix timestamp |

### Infrastructure Metrics (Backend only)

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_postgres_up` | Gauge | PostgreSQL availability (1/0) |
| `geetanjali_postgres_connections_active` | Gauge | Active database connections |
| `geetanjali_postgres_connections_idle` | Gauge | Idle database connections |
| `geetanjali_postgres_database_size_bytes` | Gauge | Database size in bytes |
| `geetanjali_redis_connections` | Gauge | Active Redis connections |
| `geetanjali_redis_memory_usage_percent` | Gauge | Redis memory usage % |
| `geetanjali_ollama_up` | Gauge | Ollama LLM availability (1/0) |
| `geetanjali_ollama_models_loaded` | Gauge | Models loaded in Ollama |
| `geetanjali_chromadb_up` | Gauge | ChromaDB availability (1/0) |
| `geetanjali_chromadb_collection_count` | Gauge | Vectors in collection |

### Queue Metrics (Backend only)

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_queue_depth` | Gauge | Jobs waiting in RQ queue |
| `geetanjali_worker_count` | Gauge | Active RQ workers |
| `geetanjali_failed_jobs` | Gauge | Failed jobs in RQ registry |

### LLM Metrics (Primarily Worker)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_llm_requests_total` | Counter | `provider`, `status` | LLM API requests |
| `geetanjali_llm_tokens_total` | Counter | `provider`, `token_type` | Tokens used (input/output) |
| `geetanjali_llm_fallback_total` | Counter | `primary`, `fallback`, `reason` | Fallback events |
| `geetanjali_llm_circuit_breaker_state` | Gauge | `provider` | Circuit breaker state |

**Note:** LLM metrics primarily come from the worker service. In development with RQ disabled, backend may also emit these metrics.

### Cache Metrics (Both services)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_cache_hits_total` | Counter | `key_type` | Cache hits by type |
| `geetanjali_cache_misses_total` | Counter | `key_type` | Cache misses by type |

Key types: `verse`, `search`, `metadata`, `case`, `rag`, `featured`, `other`

### API Metrics (Both services)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_api_errors_total` | Counter | `error_type`, `endpoint` | API errors by type |

### Email Metrics (Both services)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_email_sends_total` | Counter | `email_type`, `result` | Send attempts |
| `geetanjali_email_send_duration_seconds` | Histogram | `email_type` | Send latency |
| `geetanjali_email_circuit_breaker_state` | Gauge | - | Circuit breaker state |

### Vector Search Metrics (Both services)

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_vector_search_fallback_total` | Counter | `reason` | Fallbacks to SQL search |
| `geetanjali_chromadb_circuit_breaker_state` | Gauge | - | Circuit breaker state |

### Circuit Breaker Metrics

All circuit breakers expose a state gauge (0=closed, 1=half_open, 2=open):

| Metric | Service | Labels |
|--------|---------|--------|
| `geetanjali_llm_circuit_breaker_state` | LLM providers | `provider` (ollama, anthropic) |
| `geetanjali_chromadb_circuit_breaker_state` | Vector store | - |
| `geetanjali_email_circuit_breaker_state` | Email service | - |

State transitions are tracked:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_circuit_breaker_transitions_total` | Counter | `service`, `from_state`, `to_state` | State changes |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Observability Stack                          │
│                                                                  │
│   ┌────────────┐                                                 │
│   │  Backend   │────┐                                            │
│   │  :8000     │    │    ┌────────────┐    ┌────────────┐        │
│   │  /metrics  │    ├───▶│ Prometheus │───▶│  Grafana   │        │
│   └────────────┘    │    │   :9090    │    │   :3000    │        │
│                     │    └────────────┘    └─────┬──────┘        │
│   ┌────────────┐    │                            │               │
│   │   Worker   │────┘                            │  Alerts       │
│   │  :8001     │                                 ▼               │
│   │  /metrics  │                          ┌──────────┐           │
│   └────────────┘                          │  Resend  │           │
│                                           │  (email) │           │
│   Backend scrapes:                        └──────────┘           │
│   • Business gauges                                              │
│   • Infrastructure gauges                                        │
│   • Event counters                                               │
│                                                                  │
│   Worker scrapes:                                                │
│   • LLM request counters                                         │
│   • Event counters (cache, email)                                │
│   • Circuit breaker states                                       │
└──────────────────────────────────────────────────────────────────┘
```

## Metrics Collection

### Gauge Collection (Backend)

Business and infrastructure gauges are collected by an APScheduler job running every 60 seconds:

```python
# backend/services/metrics_collector.py
class MetricsCollector:
    def collect_all(self):
        self._collect_business_metrics()
        self._collect_infrastructure_metrics()
        self._collect_queue_metrics()
```

### Counter/Histogram Collection (Both)

Event-based metrics (counters, histograms) are updated in real-time when events occur:
- Cache hits/misses tracked on each operation
- LLM requests tracked per API call
- Email sends tracked per delivery attempt

### Query Patterns

Different metric types require different Prometheus queries due to how metrics are collected:

| Type | Pattern | Example | Why |
|------|---------|---------|-----|
| Gauges | Filter by job | `geetanjali_postgres_up{job="backend"}` | Collected only by backend scheduler |
| Counters | Sum across jobs | `sum(geetanjali_cache_hits_total)` | Events occur in both services |
| CB States | Max (worst state) | `max(geetanjali_llm_circuit_breaker_state{provider="ollama"})` | Show worst state across services |

## Prometheus Configuration

Dual-scrape config in `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  # Backend: all metrics (business, infra, events)
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: /metrics

  # Worker: event counters and LLM metrics only
  - job_name: 'worker'
    static_configs:
      - targets: ['worker:8001']
    metrics_path: /metrics
```

## Grafana Dashboards

### Geetanjali Overview

Pre-configured dashboard at `monitoring/grafana/dashboards/geetanjali-overview.json`:

- **Service Health**: Database, cache, LLM, vector store status
- **Circuit Breakers**: LLM (Ollama/Anthropic), ChromaDB, Email states
- **Business**: Consultations, active users, completion rate, feedback
- **Queue**: Job depth, worker count, failed jobs
- **Newsletter**: Subscribers, emails sent

### Importing Dashboards

Dashboards are auto-provisioned via Grafana's provisioning. Manual import:

1. Open Grafana (local: http://localhost:3000, prod: https://grafana.geetanjaliapp.com)
2. Go to Dashboards → Import
3. Upload from `monitoring/grafana/dashboards/`

## Alerting

### Configuring Alerts

1. In Grafana, go to Alerting → Contact Points
2. Add Resend integration with your API key
3. Create alert rules for critical metrics

### Recommended Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Database Down | `geetanjali_postgres_up{job="backend"} == 0` for 1m | Critical |
| Worker Down | `up{job="worker"} == 0` for 2m | Critical |
| LLM Circuit Open | `max(geetanjali_llm_circuit_breaker_state) == 2` for 5m | Warning |
| ChromaDB Circuit Open | `geetanjali_chromadb_circuit_breaker_state == 2` for 5m | Warning |
| Queue Backlog | `geetanjali_queue_depth > 10` for 5m | Warning |
| High Failed Jobs | `geetanjali_failed_jobs > 5` | Warning |
| No Recent Activity | `geetanjali_consultations_24h == 0` for 24h | Info |
| Newsletter Not Sent | `geetanjali_newsletter_emails_sent_24h == 0` for 24h | Warning |

## Troubleshooting

### Metrics not appearing

1. Check backend logs: `docker compose logs backend | grep metrics`
2. Check worker logs: `docker compose logs worker | grep metrics`
3. Verify endpoints:
   ```bash
   curl http://localhost:8000/metrics  # Backend
   curl http://localhost:8001/metrics  # Worker
   ```
4. Check Prometheus targets: http://localhost:9090/targets

### Duplicate metrics in Grafana

If gauges show multiple values, ensure you're filtering by job:
```promql
# Correct - backend-only gauge
geetanjali_postgres_up{job="backend"}

# Incorrect - may get values from both services
geetanjali_postgres_up
```

### Grafana can't connect to Prometheus

1. Verify Prometheus is running: `docker compose ps prometheus`
2. Check data source URL is `http://prometheus:9090` (internal Docker network)

### Stale metrics

Gauges refresh every 60 seconds. If values seem stale:
1. Check APScheduler is running in backend logs
2. Verify database connectivity

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | true | Enable /metrics endpoint |
| `METRICS_COLLECTION_INTERVAL` | 60 | Seconds between gauge collection |

## See Also

- [Deployment](deployment.md) — Docker Compose files and deployment modes
- [Architecture](architecture.md) — System design overview
- [Setup Guide](setup.md) — Development environment
