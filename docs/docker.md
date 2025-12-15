---
layout: default
title: Docker Configuration
description: Docker Compose files, deployment modes, and container orchestration for Geetanjali.
---

# Docker Configuration

Geetanjali uses a layered Docker Compose configuration for different environments.

## Compose Files Overview

| File | Purpose | Use Case |
|------|---------|----------|
| `docker-compose.yml` | **Base configuration** | Core services for all environments |
| `docker-compose.observability.yml` | Monitoring stack | Prometheus + Grafana dashboards |
| `docker-compose.override.yml` | Local dev overrides | Auto-loaded, exposes ports for debugging |
| `docker-compose.minimal.yml` | Standalone minimal | Backend + Postgres only (no Ollama) |
| `docker-compose.test.yml` | CI/CD testing | Ephemeral database, no persistence |

## Usage Patterns

### Local Development

```bash
# Standard development (auto-loads docker-compose.override.yml)
docker compose up -d

# Or use Makefile shortcut
make dev
```

Services exposed:
- Backend: http://localhost:8000 (via override)
- Frontend: http://localhost (nginx)
- API Docs: http://localhost:8000/docs

### Production Deployment

Production settings are controlled via the `.env` file (decrypted from `.env.enc` during deployment):

```bash
# Deploy to production (uses scripts/deploy.sh)
make deploy

# With monitoring (recommended)
make obs-up
```

Production is configured via `.env`:
- `APP_ENV=production`
- `DEBUG=false`
- `LOG_LEVEL=WARNING`
- `COOKIE_SECURE=true`

See [Deployment Guide](deployment.md) for full deployment workflow.

### Monitoring Stack

```bash
# Add to existing deployment
docker compose -f docker-compose.observability.yml up -d

# Access
# Grafana: https://grafana.geetanjaliapp.com (or localhost:3000)
# Prometheus: Internal only (not exposed)
```

### Testing / CI

```bash
# Lightweight test environment (no Ollama, tmpfs database)
docker compose -f docker-compose.test.yml up -d

# Minimal backend-only (for API testing)
docker compose -f docker-compose.minimal.yml up -d
```

## File Details

### docker-compose.yml (Base)

The base configuration defines all services:

| Service | Image | Purpose |
|---------|-------|---------|
| `ollama` | ollama/ollama:0.13.2 | Local LLM inference |
| `postgres` | postgres:15-alpine | Primary database |
| `redis` | redis:7-alpine | Cache layer (ephemeral) |
| `chromadb` | Custom build | Vector store for RAG |
| `backend` | Custom build | FastAPI application |
| `worker` | Same as backend | RQ background jobs |
| `frontend` | Custom build | React + nginx |

**Security features in base:**
- All containers drop capabilities (`cap_drop: ALL`)
- `no-new-privileges` security option
- Non-root users where possible
- Internal Docker network (no external ports except frontend)
- Resource limits (memory reservations)

### docker-compose.observability.yml (Monitoring)

Adds Prometheus and Grafana:

| Service | Port | Access |
|---------|------|--------|
| `prometheus` | 9090 (internal) | Scrapes /metrics from backend |
| `grafana` | 3000 (via nginx) | Dashboards at grafana.geetanjaliapp.com |

**Configuration:**
- Prometheus retention: 15 days
- Grafana: Anonymous access disabled
- SMTP alerts via Resend (optional)
- Pre-provisioned dashboards

### docker-compose.override.yml (Local Dev)

Auto-loaded by Docker Compose. Exposes backend port for local frontend dev:

```yaml
services:
  backend:
    ports:
      - "8000:8000"
```

**Note:** Add to `.gitignore` if you customize it locally.

### docker-compose.minimal.yml (Standalone)

For testing backend in isolation:
- No Ollama dependency (`OLLAMA_ENABLED=false`)
- Direct port exposure
- Minimal resource usage

### docker-compose.test.yml (CI/CD)

For automated testing:
- Ephemeral Postgres (`tmpfs` storage)
- Different port (5433) to avoid conflicts
- No persistence volumes
- Fast startup/teardown

## Network Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      geetanjali-network                        │
│                                                                │
│   ┌────────────┐      ┌────────────┐      ┌────────────┐      │
│   │  frontend  │─────▶│  backend   │─────▶│  postgres  │      │
│   │  :80/443   │      │   :8000    │      │   :5432    │      │
│   └────────────┘      └─────┬──────┘      └────────────┘      │
│                             │                                  │
│                             ├─────────▶ redis :6379           │
│                             │                                  │
│                             ├─────────▶ chromadb :8000        │
│                             │                                  │
│                             └─────────▶ ollama :11434         │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐   │
│   │                                                        │   │
│   │  Observability (optional)                              │   │
│   │                                                        │   │
│   │    prometheus :9090  ──────────▶  grafana :3000       │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                   External: ports 80, 443 only
```

## Volume Management

| Volume | Service | Purpose | Persistence |
|--------|---------|---------|-------------|
| `ollama_models` | ollama | LLM model weights | Persistent |
| `postgres_data` | postgres | Database files | Persistent |
| `chroma_data` | chromadb | Vector embeddings | Persistent |
| `backend_chroma` | backend | Local chroma fallback | Persistent |
| `prometheus_data` | prometheus | Metrics history | Persistent |
| `grafana_data` | grafana | Dashboards, users | Persistent |

**Backup critical volumes:**
```bash
# Database backup
docker compose exec postgres pg_dump -U geetanjali geetanjali > backup.sql

# Volume backup (all data)
docker run --rm -v geetanjali_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz /data
```

## Security Hardening

All containers implement:

1. **Capability dropping**: `cap_drop: ALL` with minimal `cap_add`
2. **No privilege escalation**: `security_opt: no-new-privileges:true`
3. **Non-root users**: Backend, frontend, redis, prometheus, grafana
4. **Read-only filesystems**: Where possible (with tmpfs for writes)
5. **Resource limits**: Memory and CPU constraints
6. **PID limits**: Prevent fork bombs
7. **Internal networking**: Only frontend exposed externally

## Makefile Commands

```bash
make help           # Show all commands

# Development
make dev            # Start development stack
make build          # Build images
make down           # Stop all containers
make logs           # Tail all logs
make logs-backend   # Tail backend logs

# Production
make deploy         # Deploy to production server
make obs-up         # Start with observability stack
make obs-down       # Stop observability stack

# Database
make db-shell       # PostgreSQL shell
make db-migrate     # Run migrations

# Testing
make test           # Run backend tests
make test-cov       # Tests with coverage

# Secrets
make secrets-edit   # Edit encrypted .env.enc
make secrets-view   # View decrypted secrets
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs <service>

# Verify health
docker compose ps

# Inspect container
docker inspect geetanjali-<service>
```

### Network issues

```bash
# Verify network exists
docker network ls | grep geetanjali

# Check connectivity
docker compose exec backend ping postgres
```

### Volume permissions

```bash
# Fix ownership (if needed)
docker compose exec backend chown -R appuser:appuser /app/chroma_data
```

### Memory issues

```bash
# Check resource usage
docker stats

# Increase limits in docker-compose.yml under deploy.resources
```

## Environment-Specific Notes

### macOS (Apple Silicon)

Ollama runs natively without GPU acceleration in Docker. For better performance, run Ollama on host:

```bash
# Host Ollama
brew install ollama
ollama serve

# Update .env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Linux with GPU

For NVIDIA GPU support, add to ollama service:

```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### Windows (WSL2)

Use Docker Desktop with WSL2 backend. Ensure sufficient memory allocation in `.wslconfig`.
