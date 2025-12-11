# Geetanjali

[![CI](https://github.com/geetanjaliapp/geetanjali/actions/workflows/ci.yml/badge.svg)](https://github.com/geetanjaliapp/geetanjali/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)

Ethical leadership guidance from the Bhagavad Geeta.

**[Live Demo](https://geetanjaliapp.com)**

![Geetanjali Architecture](docs/screenshots/infographic-architecture.png)

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
- **Follow-up Conversations** - Ask clarifying questions after initial consultation
- **Verse Browser** - Explore 701 verses across 18 chapters with translations
- **Confidence Scoring** - Low-confidence responses flagged for review
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
| LLM | Ollama (qwen2.5:3b) primary, Anthropic Claude fallback |
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

See [Setup Guide](docs/setup.md#configuration-reference) for all environment variables.

Essential for production:
```bash
JWT_SECRET=your-secret-key
API_KEY=your-api-key
LLM_PROVIDER=ollama  # or anthropic
COOKIE_SECURE=true
```

## Development

See [Setup Guide](docs/setup.md) for detailed local development instructions.

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

## API

Key endpoints:

```
POST /api/v1/cases                  # Create case
POST /api/v1/cases/{id}/analyze     # Analyze case
POST /api/v1/cases/{id}/follow-up   # Follow-up question
GET  /api/v1/verses                 # List verses
GET  /api/v1/verses/daily           # Daily verse
POST /api/v1/auth/signup            # Create account
POST /api/v1/auth/login             # Login
```

Full API documentation at `/docs` when running.

## Documentation

**[docs.geetanjaliapp.com](https://docs.geetanjaliapp.com)**

- [Setup Guide](docs/setup.md) - Local development, Docker, environment
- [Docker Configuration](docs/docker.md) - Compose files, deployment modes
- [Architecture](docs/architecture.md) - System design, RAG pipeline, components
- [Content Moderation](docs/content-moderation.md) - Multi-layer filtering, abuse detection
- [Observability](docs/observability.md) - Monitoring, metrics, Grafana dashboards
- [Security](docs/security.md) - Container hardening, secrets management
- [Data Sources](docs/data.md) - Geeta content, licensing, ingestion
- [Building Geetanjali](docs/building-geetanjali.md) - Deep dive into the RAG system design

## License

MIT

## Acknowledgments

Built on the Bhagavad Geeta, using public domain Sanskrit texts and translations.
