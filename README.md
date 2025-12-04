# Geetanjali

Ethical leadership guidance from the Bhagavad Geeta.

Geetanjali is a RAG-powered tool that transforms Bhagavad Geeta teachings into actionable guidance for ethical decisions in organizations.

## Overview

Leaders face ethical dilemmas without clear answers. Geetanjali provides structured decision support by:

- Analyzing ethical situations through Geeta's lens
- Presenting multiple options with tradeoffs
- Citing specific verses with commentary
- Offering implementation steps and reflection prompts

The system uses retrieval-augmented generation (RAG) to ground responses in actual scripture rather than hallucinating advice.

## Features

- **Case Analysis** - Submit ethical dilemmas, get structured recommendations
- **Verse Browser** - Explore 701 verses across 18 chapters with translations
- **Scholar Review** - Optional expert review of generated guidance
- **User Feedback** - Rate outputs to improve recommendations
- **Session Tracking** - Anonymous users can save and revisit cases

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI (Python 3.10+) |
| Frontend | React + TypeScript + Tailwind |
| Database | PostgreSQL 15 |
| Vector DB | ChromaDB |
| Cache | Redis 7 |
| LLM | Ollama (qwen2.5:3b) or Anthropic Claude |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |

## Quick Start

Requirements: Docker and Docker Compose

```bash
git clone https://github.com/geetanjaliapp/geetanjali.git
cd geetanjali

# Start all services
docker compose up -d

# Pull LLM model (first time only, stored in volume)
docker exec geetanjali-ollama ollama pull qwen2.5:3b

# Check status
docker compose ps
```

Services:
- Frontend: http://localhost
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Configuration

Environment variables (set in `.env` or docker-compose):

```bash
# Required for production
JWT_SECRET=your-secret-key
API_KEY=your-api-key

# LLM Provider (choose one)
OLLAMA_BASE_URL=http://ollama:11434
ANTHROPIC_API_KEY=your-anthropic-key

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/geetanjali
REDIS_URL=redis://redis:6379/0
```

## Development

See [Setup Guide](docs/SETUP.md) for detailed local development instructions.

### Commands

```bash
make dev          # Start development environment
make test         # Run tests
make lint         # Run linters
make format       # Format code
make db-migrate   # Run database migrations
make clean        # Clean up containers
```

### Testing

```bash
# Backend (from backend/)
pytest
pytest --cov=. --cov-report=term-missing

# Frontend (from frontend/)
npm test
```

## Project Structure

```
geetanjali/
├── backend/
│   ├── api/          # FastAPI routes
│   ├── models/       # SQLAlchemy models
│   ├── services/     # RAG, LLM, embeddings
│   └── alembic/      # Database migrations
├── frontend/
│   ├── src/
│   │   ├── pages/    # React pages
│   │   ├── components/
│   │   └── api/      # API clients
├── data/             # Verse data files
└── docs/
    ├── SETUP.md         # Development guide
    ├── ARCHITECTURE.md  # System design
    └── DATA.md          # Data sources
```

## API

Key endpoints:

```
POST /api/v1/cases              # Create case
POST /api/v1/cases/{id}/analyze # Analyze case
GET  /api/v1/verses             # List verses
GET  /api/v1/verses/daily       # Daily verse
POST /api/v1/auth/signup        # Create account
POST /api/v1/auth/login         # Login
```

Full API documentation at `/docs` when running.

## Documentation

- [Setup Guide](docs/SETUP.md) - Local development, Docker, environment
- [Architecture](docs/ARCHITECTURE.md) - System design, RAG pipeline, components
- [Data Sources](docs/DATA.md) - Geeta content, licensing, ingestion
- [Technical Blog](docs/TECHNICAL_BLOG.md) - Deep dive into the RAG system design

## License

MIT

## Acknowledgments

Built on the Bhagavad Geeta, using public domain Sanskrit texts and translations.
