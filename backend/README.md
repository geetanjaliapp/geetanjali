# Geetanjali Backend

FastAPI backend for ethical leadership guidance from the Bhagavad Geeta.

## Architecture

```
backend/
├── api/                    # API layer
│   ├── middleware/         # CSRF protection
│   ├── auth.py             # Authentication (signup, login, logout, tokens)
│   ├── cases.py            # Consultation CRUD
│   ├── outputs.py          # Analysis outputs, feedback
│   ├── verses.py           # Verse browsing, daily verse
│   ├── search.py           # Hybrid verse search
│   ├── follow_up.py        # Follow-up conversations
│   ├── reading.py          # Reading mode progress
│   ├── contact.py          # Contact form
│   ├── feed.py             # RSS/Atom feeds
│   ├── sitemap.py          # Dynamic sitemap
│   ├── admin.py            # Admin endpoints
│   ├── health.py           # Health checks
│   └── dependencies.py     # Rate limiting, auth injection
│
├── services/               # Business logic
│   ├── rag.py              # RAG pipeline orchestration
│   ├── llm.py              # LLM provider abstraction (Claude, Ollama)
│   ├── prompts.py          # Prompt templates
│   ├── vector_store.py     # ChromaDB operations
│   ├── content_filter.py   # Multi-layer content moderation
│   ├── follow_up.py        # Follow-up conversation logic
│   ├── email.py            # Transactional email (Resend)
│   ├── cache.py            # Redis cache wrapper
│   ├── metrics_collector.py # Prometheus metrics
│   └── search/             # Search service
│       ├── service.py      # SearchService orchestrator
│       ├── parser.py       # Query intent detection
│       ├── ranking.py      # Result scoring and merging
│       └── strategies/     # Canonical, Sanskrit, Keyword, Semantic
│
├── db/                     # Database layer
│   └── repositories/       # Data access (case, verse, user, output)
│
├── models/                 # SQLAlchemy models
│   ├── case.py             # Consultation cases
│   ├── output.py           # Analysis outputs
│   ├── verse.py            # Verses and translations
│   ├── user.py             # User accounts
│   ├── message.py          # Follow-up messages
│   ├── feedback.py         # User feedback
│   └── contact.py          # Contact submissions
│
├── utils/                  # Utilities
│   ├── auth.py             # Password hashing, token validation
│   ├── jwt.py              # JWT encode/decode
│   ├── logging.py          # Structured logging
│   ├── metrics.py          # Prometheus instrumentation
│   ├── sentry.py           # Error tracking
│   └── exceptions.py       # Custom exceptions
│
├── alembic/                # Database migrations
├── scripts/                # Data ingestion, utilities
├── config.py               # Settings from environment
├── main.py                 # FastAPI application
└── worker.py               # RQ background worker
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| Database | PostgreSQL 15 + SQLAlchemy 2.x |
| Vector DB | ChromaDB |
| Cache/Queue | Redis 7 + RQ |
| LLM | Anthropic Claude / Ollama |
| Embeddings | sentence-transformers (MiniLM-L6-v2) |
| Monitoring | Prometheus + Sentry |
| Email | Resend |

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp ../.env.example ../.env
# Edit ../.env

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --reload --port 8000
```

## API Endpoints

### Public

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with dependency status |
| `/api/v1/verses` | GET | List verses with pagination/filters |
| `/api/v1/verses/{id}` | GET | Single verse with translations |
| `/api/v1/verses/daily` | GET | Daily featured verse |
| `/api/v1/verses/random` | GET | Random verse |
| `/api/v1/search` | GET | Hybrid verse search |
| `/api/v1/feed/rss` | GET | RSS feed |
| `/api/v1/sitemap.xml` | GET | Dynamic sitemap |

### Authenticated

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/signup` | POST | Create account |
| `/api/v1/auth/login` | POST | Login (sets cookies) |
| `/api/v1/auth/logout` | POST | Logout |
| `/api/v1/auth/refresh` | POST | Refresh access token |
| `/api/v1/cases` | POST | Create consultation |
| `/api/v1/cases/{id}` | GET | Get case details |
| `/api/v1/cases/{id}/analyze` | POST | Trigger RAG analysis |
| `/api/v1/cases/{id}/follow-up` | POST | Submit follow-up question |
| `/api/v1/outputs/{id}` | GET | Get analysis output |
| `/api/v1/outputs/{id}/feedback` | POST | Submit feedback |

## Configuration

Key environment variables:

```bash
# Application
APP_ENV=production
DEBUG=false
LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql://user:pass@host:5432/geetanjali
DB_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379/0
RQ_ENABLED=true

# LLM
LLM_PROVIDER=anthropic          # anthropic | ollama | mock
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:3b

# ChromaDB
CHROMA_PERSIST_DIRECTORY=./chroma_data
CHROMA_COLLECTION_NAME=gita_verses

# Security
JWT_SECRET=your-secret-key
COOKIE_SECURE=true
CORS_ORIGINS=["https://geetanjaliapp.com"]

# Optional
SENTRY_DSN=https://...@sentry.io/...
RESEND_API_KEY=re_...
```

Full configuration reference in `config.py`.

## Background Worker

The worker processes RAG analysis jobs asynchronously:

```bash
# Start worker
python worker.py

# Worker exposes health endpoint on port 8001
curl http://localhost:8001/health
```

## Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Testing

```bash
# Run tests
pytest -v

# With coverage
pytest --cov=. --cov-report=html

# Single file
pytest tests/test_search.py -v
```

## Code Quality

```bash
# Format
black .

# Lint
flake8
mypy .
```

## Data Ingestion

```bash
# Ingest verse data from YAML/HTML sources
python scripts/ingest_data.py

# Initialize fresh database
python scripts/init_db.py
```
