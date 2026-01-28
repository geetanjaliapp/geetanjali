---
layout: default
title: Deployment
description: Docker Compose files, deployment modes, and container orchestration for Geetanjali.
---

# Deployment

Geetanjali uses a layered Docker Compose configuration for different environments.

## Compose Files Overview

| File | Purpose | Use Case |
|------|---------|----------|
| `docker-compose.yml` | **Base configuration** | Core services for all environments |
| `docker-compose.observability.yml` | Monitoring stack | Prometheus + Grafana dashboards |
| `docker-compose.override.yml` | Local dev overrides | Auto-loaded, exposes ports for debugging |
| `docker-compose.minimal.yml` | Standalone minimal | Backend + Postgres only (no Ollama) |
| `docker-compose.test.yml` | CI/CD testing | Ephemeral database, no persistence |
| `docker-compose.budget.yml` | **Budget deployment** | 2GB droplet, no Ollama ($12/mo) |
| `docker-compose.budget.observability.yml` | Budget monitoring | 7d retention, memory-constrained |

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

#### First-time Server Setup

Run the setup script once on a fresh server to install all dependencies:

```bash
# SSH to server and run setup
ssh your-server
curl -fsSL https://raw.githubusercontent.com/geetanjaliapp/geetanjali/main/scripts/setup-server.sh | sudo bash

# Or after cloning the repo
sudo ./scripts/setup-server.sh
```

This installs:
- Docker & Docker Compose
- Git LFS (for audio files)
- SOPS + age (for secrets)
- fail2ban, unattended-upgrades

#### Ongoing Deployments

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

See [Production Deployment](#production-deployment) section above for configuration.

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
| `frontend` | Custom build | React + nginx, SEO pages generated at build |

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
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     geetanjali-network                       │
│                                                              │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐         │
│   │  frontend  │───▶│  backend   │───▶│  postgres  │         │
│   │  :80/443   │    │   :8000    │    │   :5432    │         │
│   └────────────┘    └─────┬──────┘    └────────────┘         │
│                           │                                  │
│                           ├────────▶ redis :6379             │
│                           │                                  │
│                           ├────────▶ chromadb :8000          │
│                           │                                  │
│                           └────────▶ ollama :11434           │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                                                      │   │
│   │  Observability (optional)                            │   │
│   │                                                      │   │
│   │   prometheus :9090  ─────────▶  grafana :3000        │   │
│   │                                                      │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
                 External: ports 80, 443 only
```

## Audio Files (Git LFS)

Audio recitations (~94MB, 710 MP3 files) are stored using Git LFS.

### Initial Setup

After cloning, pull audio files:

```bash
# Install Git LFS (done by setup-server.sh on production)
git lfs install

# Pull audio files
git lfs pull
```

### Deployment

The `make deploy` command automatically runs `git lfs pull` after `git pull`.

Audio files are mounted into the frontend container:

```yaml
frontend:
  volumes:
    - ./public/audio:/app/public/audio:ro
```

### Verification

```bash
# Check LFS files are present (not pointer files)
file public/audio/mp3/01/BG_1_1.mp3
# Should show: MPEG audio layer III

# Count audio files
find public/audio/mp3 -name "*.mp3" | wc -l
# Should show: 710
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

---

## Budget Deployment (2GB Droplet) — Alternative Configuration

> **Note:** This is an alternative deployment option for cost optimization. The standard 4GB deployment with Ollama remains the **recommended configuration** for self-sufficient, local-first operation.

For cost-conscious deployments, Geetanjali supports running on a 2GB droplet ($12/mo vs $24/mo) by disabling Ollama and using stricter memory limits.

### Cost Comparison

| Configuration | RAM | Monthly Cost | Ollama | LLM Provider |
|---------------|-----|--------------|--------|--------------|
| Standard | 4GB | $24/mo | Yes | Local + API fallback |
| **Budget** | **2GB** | **$12/mo** | **No** | **API only (Gemini/Anthropic)** |

**Savings:** $144/year (50% reduction)

### Memory Budget

Container limits target 80% of RAM to leave headroom for kernel and Docker.

| Service | Limit | Reservation | Notes |
|---------|-------|-------------|-------|
| PostgreSQL | 192MB | 96MB | `shared_buffers=48MB`, `max_connections=30` |
| Redis | 48MB | 24MB | `maxmemory 40mb` |
| ChromaDB | 640MB | 448MB | Vector storage + query overhead |
| Backend | 512MB | 256MB | `UVICORN_WORKERS=1` + sentence-transformers (~400MB) |
| Worker | 256MB | 128MB | Separate process |
| Frontend | 48MB | — | nginx static |
| **Core Total** | **~1.7GB** | **~1.0GB** | Leaves ~300MB for kernel/Docker |

**With observability (optional):**

| Service | Limit | Notes |
|---------|-------|-------|
| Prometheus | 192MB | 7d retention, 100MB storage cap |
| Grafana | 192MB | Dashboards |
| node-exporter | 64MB | Host metrics |
| **Obs Total** | **~448MB** | |
| **Full Total** | **~2.0GB** | Requires 1GB swap for spikes |

### Budget Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.budget.yml` | Core services (no Ollama) |
| `docker-compose.budget.observability.yml` | Prometheus + Grafana (7d retention) |

### Quick Start

```bash
# Start budget deployment
make budget-up

# With observability
make budget-obs-up

# Check memory usage
make budget-stats

# View logs
make budget-logs
```

### Required Environment Settings

```bash
# .env for budget deployment
LLM_PROVIDER=gemini
LLM_FALLBACK_PROVIDER=anthropic
OLLAMA_ENABLED=false

# API keys required (no local fallback)
GOOGLE_API_KEY=<your-gemini-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

### Server Setup (Debian 12)

```bash
# 1. Provision 2GB Debian 12 droplet

# 2. Run setup script (creates gitam user, installs deps)
curl -fsSL https://raw.githubusercontent.com/geetanjaliapp/geetanjali/main/scripts/setup-server-debian.sh | sudo bash

# 3. Configure swap (as root)
sudo ./scripts/setup-swap.sh

# 4. Clone repo (as gitam)
sudo -u gitam bash -c 'cd /opt/geetanjali && git clone https://github.com/geetanjaliapp/geetanjali.git . && git lfs pull'

# 5. Copy age key and decrypt secrets
# (copy keys.txt to /home/gitam/.config/sops/age/)
sudo -u gitam bash -c 'cd /opt/geetanjali && SOPS_AGE_KEY_FILE=/home/gitam/.config/sops/age/keys.txt sops -d .env.enc > .env'

# 6. Start services
sudo -u gitam bash -c 'cd /opt/geetanjali && docker compose -f docker-compose.budget.yml up -d'
```

### Monitoring

Daily checks for budget deployment:

```bash
# Memory check
ssh server "free -h && docker stats --no-stream"

# OOM events
ssh server "dmesg | grep -i oom | tail -5"

# Service health
ssh server "cd /opt/geetanjali && docker compose -f docker-compose.budget.yml ps"
```

### Limitations

- **No local LLM**: Requires internet for all consultations
- **API costs**: Every consultation uses Gemini/Anthropic API
- **Less redundancy**: No local fallback if APIs are down
- **Memory pressure**: May use swap under heavy load

### When to Use Budget Deployment

**Good fit:**
- Personal projects
- Low-traffic deployments
- Cost-sensitive scenarios
- Development/staging environments

**Not recommended:**
- High-traffic production
- Offline requirements
- Frequent consultations (API costs add up)
