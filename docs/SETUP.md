# Development Setup

Local development environment setup for Geetanjali.

## Prerequisites

- Docker and Docker Compose (recommended)
- Or: Python 3.10+, Node.js 18+, PostgreSQL, Redis

## Docker Setup (Recommended)

```bash
# Clone and start
git clone https://github.com/geetanjaliapp/geetanjali.git
cd geetanjali
docker compose up -d

# Pull LLM model (first time only, stored in volume)
docker exec geetanjali-ollama ollama pull qwen2.5:3b

# Verify services
docker compose ps
```

Services start at:
- Frontend: http://localhost
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Ollama: http://localhost:11434

First run automatically:
- Creates database tables
- Runs migrations
- Ingests Geeta verse data (701 verses)

## Local Setup (Without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment
export DATABASE_URL=postgresql://user:pass@localhost:5432/geetanjali
export REDIS_URL=redis://localhost:6379/0

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Dependencies

Start PostgreSQL, Redis, ChromaDB, and Ollama locally, or use Docker:

```bash
docker compose up -d postgres redis chromadb ollama

# Pull LLM model
docker exec geetanjali-ollama ollama pull qwen2.5:3b
```

## Environment Variables

Create `.env` in project root:

```bash
# Database
DATABASE_URL=postgresql://geetanjali:geetanjali@localhost:5432/geetanjali

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM (choose one)
OLLAMA_BASE_URL=http://localhost:11434
ANTHROPIC_API_KEY=your-key

# Security (required for production)
JWT_SECRET=change-in-production
API_KEY=change-in-production
```

## Common Commands

```bash
# Docker
docker compose up -d          # Start all
docker compose down           # Stop all
docker compose logs -f        # View logs
docker compose ps             # Status

# Backend (from backend/)
pytest                        # Run tests
pytest --cov=.               # With coverage
alembic upgrade head          # Run migrations
alembic revision -m "desc"    # New migration

# Frontend (from frontend/)
npm run dev                   # Dev server
npm run build                 # Production build
npm test                      # Run tests
```

## Database Migrations

Geetanjali uses Alembic for database migrations. The consolidated `001_initial_schema.py` contains the full schema.

### Standard Operations

```bash
# Apply all pending migrations
alembic upgrade head

# Check current migration version
alembic current

# View migration history
alembic history

# Create a new migration (after model changes)
alembic revision --autogenerate -m "description"
```

### For Existing Databases (Migration Consolidation)

If you have an existing database and migrations were consolidated (e.g., 10 migrations merged into one), use `stamp` to mark the database as up-to-date without re-running migrations:

```bash
# Mark database at current revision (preserves existing data)
alembic stamp 001

# Verify
alembic current
# Should show: 001 (head)
```

**When to use stamp:**
- After migration consolidation when your database already has the correct schema
- When setting up migration tracking on an existing database
- Never on a fresh database (use `upgrade head` instead)

### Best Practices

1. **Always backup before migrations** in production:
   ```bash
   pg_dump -h localhost -U geetanjali geetanjali > backup_$(date +%Y%m%d).sql
   ```

2. **Test migrations locally** before deploying:
   ```bash
   alembic upgrade head --sql  # Preview SQL without executing
   ```

3. **Downgrade cautiously** - some migrations are not reversible:
   ```bash
   alembic downgrade -1  # Rollback one migration
   ```

## Troubleshooting

**Port conflicts**: Change ports in `docker-compose.yml` or stop conflicting services.

**Database connection**: Ensure PostgreSQL is running and `DATABASE_URL` is correct.

**Migration version mismatch**: If alembic complains about missing revisions after consolidation:
```bash
# Check current DB revision
alembic current

# If stuck on old revision, stamp to new consolidated version
alembic stamp 001
```

**Missing verses**: Run data ingestion:
```bash
docker compose exec backend python -c "from services.ingestion import ingest_all; ingest_all()"
```

**ChromaDB errors**: Check NumPy version compatibility (<2.0 required).
