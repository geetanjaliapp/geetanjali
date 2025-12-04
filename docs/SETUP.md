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

## Troubleshooting

**Port conflicts**: Change ports in `docker-compose.yml` or stop conflicting services.

**Database connection**: Ensure PostgreSQL is running and `DATABASE_URL` is correct.

**Missing verses**: Run data ingestion:
```bash
docker compose exec backend python -c "from services.ingestion import ingest_all; ingest_all()"
```

**ChromaDB errors**: Check NumPy version compatibility (<2.0 required).
