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
Backend /metrics → Prometheus (scrape 15s) → Grafana (dashboards + alerts)
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

## Metrics Reference

### Business Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_consultations_total` | Gauge | Total completed consultations |
| `geetanjali_consultations_24h` | Gauge | Consultations in last 24 hours |
| `geetanjali_active_users_24h` | Gauge | Unique users in last 24 hours |
| `geetanjali_exports_total` | Gauge | Total exports (all formats) |
| `geetanjali_feedback_total` | Gauge | Total feedback submissions |
| `geetanjali_feedback_helpful_pct` | Gauge | Percentage marked helpful |
| `geetanjali_verses_referenced_unique` | Gauge | Unique verses cited in outputs |

### Infrastructure Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_postgres_up` | Gauge | PostgreSQL availability (1/0) |
| `geetanjali_postgres_connection_count` | Gauge | Active database connections |
| `geetanjali_redis_up` | Gauge | Redis availability (1/0) |
| `geetanjali_redis_memory_bytes` | Gauge | Redis memory usage |
| `geetanjali_ollama_up` | Gauge | Ollama LLM availability (1/0) |
| `geetanjali_chromadb_up` | Gauge | ChromaDB availability (1/0) |
| `geetanjali_chromadb_collection_count` | Gauge | Number of vector collections |

### Queue Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_queue_depth` | Gauge | Jobs waiting in RQ queue |
| `geetanjali_queue_workers` | Gauge | Active RQ workers |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     Observability Stack                      │
│                                                              │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐         │
│   │  Backend   │───▶│ Prometheus │───▶│  Grafana   │         │
│   │  /metrics  │    │   :9090    │    │   :3000    │         │
│   └─────┬──────┘    └────────────┘    └─────┬──────┘         │
│         │                                   │                │
│         │                                   │  Alerts        │
│         │  APScheduler                      ▼                │
│         │  (60s refresh)              ┌──────────┐           │
│         │                             │  Resend  │           │
│   ┌─────▼──────┐                      │  (email) │           │
│   │ PostgreSQL │                      └──────────┘           │
│   │   Redis    │                                             │
│   │   Ollama   │                                             │
│   │  ChromaDB  │                                             │
│   └────────────┘                                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Metrics Collection

Metrics are collected by an APScheduler job running every 60 seconds in the backend:

```python
# backend/services/metrics_collector.py
class MetricsCollector:
    def collect_all(self):
        self._collect_business_metrics()
        self._collect_infrastructure_metrics()
        self._collect_queue_metrics()
```

The collector queries PostgreSQL for business metrics, pings Redis/Ollama/ChromaDB for health, and checks RQ for queue depth.

## Grafana Dashboards

### Geetanjali Overview

Pre-configured dashboard at `monitoring/grafana/dashboards/geetanjali.json`:

- **Business**: Consultations, active users, exports, feedback
- **Infrastructure**: Database, cache, LLM, vector store health
- **Queues**: Job depth, worker count

### Importing Dashboards

1. Open Grafana (local: http://localhost:3000, prod: https://grafana.geetanjaliapp.com)
2. Go to Dashboards → Import
3. Upload `monitoring/grafana/dashboards/geetanjali.json`

## Alerting

### Configuring Alerts

1. In Grafana, go to Alerting → Contact Points
2. Add Resend integration with your API key
3. Create alert rules for critical metrics

### Recommended Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Database Down | `geetanjali_postgres_up == 0` for 1m | Critical |
| LLM Unavailable | `geetanjali_ollama_up == 0` for 5m | Warning |
| Queue Backlog | `geetanjali_queue_depth > 10` for 5m | Warning |
| No Recent Activity | `geetanjali_consultations_24h == 0` for 24h | Info |

## Prometheus Configuration

Default scrape config in `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'geetanjali'
    static_configs:
      - targets: ['backend:8000']
    scrape_interval: 15s
```

## Troubleshooting

### Metrics not appearing

1. Check backend logs: `docker compose logs backend | grep metrics`
2. Verify endpoint: `curl http://localhost:8000/metrics`
3. Check Prometheus targets: http://localhost:9090/targets

### Grafana can't connect to Prometheus

1. Verify Prometheus is running: `docker compose ps prometheus`
2. Check data source URL is `http://prometheus:9090` (internal Docker network)

### Stale metrics

Metrics refresh every 60 seconds. If values seem stale:
1. Check APScheduler is running in backend logs
2. Verify database connectivity

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | true | Enable /metrics endpoint |
| `METRICS_COLLECTION_INTERVAL` | 60 | Seconds between metric collection |

## See Also

- [Docker Configuration](docker.md) — Compose files and deployment modes
- [Architecture](architecture.md) — System design overview
- [Setup Guide](setup.md) — Development environment
