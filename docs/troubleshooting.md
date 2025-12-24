---
layout: default
title: Troubleshooting
description: Common issues and solutions for Geetanjali deployment and development.
---

# Troubleshooting

Quick fixes for common issues.

---

## Backend

### Database connection refused

```
sqlalchemy.exc.OperationalError: could not connect to server
```

**Fix:** Ensure PostgreSQL is running and `DATABASE_URL` is correct.

```bash
docker compose ps          # Check if db container is healthy
docker compose logs db     # Check for errors
```

### Redis connection failed

```
redis.exceptions.ConnectionError: Error connecting to localhost:6379
```

**Fix:** Redis is optional. App works without it (caching disabled).

```bash
# To disable Redis explicitly:
REDIS_ENABLED=false
```

### ChromaDB not responding

```
chromadb.errors.ChromaError: Could not connect
```

**Fix:** Check ChromaDB container or local instance.

```bash
docker compose logs chromadb
curl http://localhost:8000/api/v1/heartbeat  # Should return {"nanosecond heartbeat":...}
```

### LLM provider errors

```
anthropic.APIError: Invalid API key
```

**Fix:** Check `ANTHROPIC_API_KEY` in `.env`. For local development without API key:

```bash
LLM_PROVIDER=ollama           # Use local Ollama
# or
USE_MOCK_LLM=true             # Use mock responses
```

### Production startup fails

```
ProductionConfigError: PRODUCTION CONFIGURATION ERROR
```

**Fix:** When `APP_ENV=production`, security checks are enforced. Ensure:

- `JWT_SECRET` is set (not default)
- `API_KEY` is set (not default)
- `COOKIE_SECURE=true`
- `DEBUG=false`
- `CORS_ORIGINS` includes your domain

---

## Frontend

### Blank page / JS errors

**Fix:** Check browser console. Common causes:

1. Backend not running → API calls fail
2. Wrong `VITE_API_URL` → Check `.env`
3. Build cache stale → `npm run build` fresh

### CORS errors

```
Access-Control-Allow-Origin header missing
```

**Fix:** Add your frontend URL to `CORS_ORIGINS` in backend `.env`:

```bash
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
```

### Auth token expired

```
401 Unauthorized on API calls
```

**Fix:** Frontend auto-refreshes tokens. If persistent:

1. Clear localStorage: `localStorage.clear()`
2. Log in again

---

## Docker

### Container won't start

```bash
docker compose logs <service>   # Check specific service
docker compose down -v          # Nuclear option: reset volumes
docker compose up --build       # Rebuild images
```

### Out of disk space

```bash
docker system df               # Check usage
docker system prune -a         # Remove unused images/containers
docker builder prune           # Clear build cache
```

### Port already in use

```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

**Fix:** Stop conflicting service or change port in `docker-compose.yml`.

---

## Background Jobs (RQ)

### Jobs stuck in queue

```bash
docker compose exec backend rq info  # Check queue status
docker compose logs worker           # Check worker logs
```

**Fix:** Restart worker:

```bash
docker compose restart worker
```

### Newsletter not sending

1. Check `NEWSLETTER_DRY_RUN=false` in production
2. Verify `RESEND_API_KEY` is set
3. Check worker logs for errors

---

## Quick Diagnostics

```bash
# Health check
curl http://localhost:8000/health

# API version
curl http://localhost:8000/api/v1/

# Database connectivity (from backend container)
docker compose exec backend python -c "from db.connection import engine; from sqlalchemy import text; print(engine.connect().execute(text('SELECT 1')).scalar())"
```

---

## Getting Help

1. Check logs: `docker compose logs -f`
2. Search [GitHub Issues](https://github.com/geetanjaliapp/geetanjali/issues)
3. Open a new issue with:
   - Error message
   - Steps to reproduce
   - Environment (OS, Docker version)
