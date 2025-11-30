# ADR-002: Containerization Strategy

**Status:** Accepted
**Date:** 2025-11-30
**Decision Makers:** Engineering Lead
**Tags:** infrastructure, deployment, docker

## Context

We need a deployment strategy that:
1. Simplifies development environment setup
2. Ensures consistency between dev, staging, and production
3. Makes all dependencies (Postgres, Ollama, ChromaDB) easily manageable
4. Enables simple production deployment
5. Supports local-first development without cloud dependencies

## Decision

We will containerize the entire application stack using Docker and Docker Compose:

### Development Environment
- **docker-compose.yml** - Full stack (backend, frontend, Postgres, Ollama)
- **Makefile** - Convenient commands (`make init`, `make dev`, etc.)
- Auto-pull Llama 3.1 model on Ollama container startup
- Volume mounts for hot-reload during development

### Production Environment
- **docker-compose.prod.yml** - Optimized for production
- Resource limits for containers (CPU, memory)
- No volume mounts for code (baked into image)
- Environment variables for secrets management
- Health checks for all services

### Services Architecture
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend  │────▶│   Backend    │────▶│  PostgreSQL  │
│ (React/Vite)│     │  (FastAPI)   │     │              │
└─────────────┘     └──────────────┘     └──────────────┘
                           │
                           ├─────▶┌──────────────┐
                           │      │   ChromaDB   │
                           │      │  (embedded)  │
                           │      └──────────────┘
                           │
                           └─────▶┌──────────────┐
                                  │    Ollama    │
                                  │ (Llama 3.1)  │
                                  └──────────────┘
```

## Rationale

### Why Docker?
✅ **Dependency Management**: Postgres, Ollama, Python, Node all in one stack
✅ **Consistency**: Same environment dev → staging → prod
✅ **Simplified Onboarding**: `make init` and you're running
✅ **Isolation**: No conflicts with system Python/Node versions
✅ **Portability**: Run anywhere Docker runs
✅ **Production-Ready**: Easy deployment to any cloud or on-prem

### Why Makefile?
✅ Simple, universal tool (no npm scripts, no bash aliases)
✅ Self-documenting (`make help`)
✅ Developer-friendly shortcuts
✅ No additional dependencies

### Why docker-compose?
✅ Multi-service orchestration in one file
✅ Service dependencies and health checks
✅ Volume management for data persistence
✅ Network isolation
✅ Easy environment variable injection

## Implementation Details

### Backend Dockerfile
- Base: `python:3.10-slim` (smaller than full Python image)
- Non-root user for security (`appuser`)
- Layer caching optimization (requirements.txt first)
- Health check endpoint
- Exposed port: 8000

### Ollama Service
- Official `ollama/ollama` image
- Auto-pull Llama 3.1 8B on startup
- Persistent volume for model storage (~4GB)
- Exposed port: 11434

### PostgreSQL Service
- `postgres:15-alpine` (smaller footprint)
- Health check for dependent services
- Persistent volume for data
- Exposed port: 5432

### Volume Strategy
**Development:**
- Code: Volume-mounted for hot reload
- Data: Named volumes (postgres-data, chroma-data, ollama-data)

**Production:**
- Code: Baked into Docker image
- Data: Named volumes with backup strategy

## Consequences

### Positive
✅ **One-command setup**: `make init` replaces 20+ manual steps
✅ **Reproducible builds**: Same environment everywhere
✅ **Easy cleanup**: `make clean` removes everything
✅ **Resource control**: Can limit CPU/memory per service
✅ **Network isolation**: Services communicate via internal network
✅ **Production-ready**: Same tooling for dev and prod

### Negative
❌ **Docker required**: Developers must install Docker Desktop
❌ **Disk space**: ~10GB for all images and volumes
❌ **Learning curve**: Developers unfamiliar with Docker need training
❌ **macOS performance**: Volume mounts can be slower than native

### Neutral
- Local development still possible (without Docker)
- CI/CD will use Docker builds
- Production can use Docker, Kubernetes, or other container platforms

## Migration Path

### Phase 0 (Current)
- Docker setup for local development
- Makefile commands for common tasks
- Documentation in README.md

### Phase 1 (Next Sprint)
- Add frontend Dockerfile (Dockerfile.dev and Dockerfile for prod)
- Test full stack in Docker
- Update CI/CD to use Docker builds

### Phase 2 (Production)
- Production docker-compose.prod.yml tested
- Secrets management strategy (e.g., Docker secrets, env vars)
- Backup strategy for volumes
- Monitoring and logging setup

## Developer Experience

### Before Docker
```bash
# Install Python 3.10+
# Create venv
# Install dependencies
# Install Postgres
# Configure Postgres
# Install Ollama
# Pull Llama model
# Start Postgres
# Start Ollama
# Run migrations
# Start backend
# Install Node.js
# Install frontend deps
# Start frontend
```

### After Docker
```bash
make init
```

## Alternatives Considered

| Alternative | Why Not Chosen |
|------------|----------------|
| **No containers** | Inconsistent environments, complex setup |
| **Backend-only Docker** | Incomplete solution, still need Postgres/Ollama setup |
| **Kubernetes** | Overkill for MVP, too complex |
| **Podman** | Less common, Docker more universal |
| **Vagrant** | Heavier than Docker, slower |

## Commands Reference

```bash
make help         # Show all commands
make init         # Initialize project (build + up + migrate)
make dev          # Start development environment
make logs         # View all logs
make test         # Run tests
make db-migrate   # Run database migrations
make clean        # Remove everything
```

## Security Considerations

- Backend runs as non-root user (`appuser`)
- Secrets via environment variables (not in images)
- Internal network for service communication
- Only necessary ports exposed
- Regular image updates for security patches

## Review Schedule

- **Next Review:** After Phase 1 (frontend Dockerfile added)
- **Review Trigger:** Developer feedback on Docker experience
- **Alternative Trigger:** Performance issues on macOS

## References

- Docker: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Ollama Docker: https://hub.docker.com/r/ollama/ollama
- FastAPI Docker: https://fastapi.tiangolo.com/deployment/docker/
