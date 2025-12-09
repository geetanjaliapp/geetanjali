---
layout: default
title: Architecture
description: System design, components, and data flow for Geetanjali - a RAG system for ethical leadership guidance.
---

# Architecture

System design and technical decisions for Geetanjali.

## Overview

Geetanjali uses retrieval-augmented generation (RAG) to ground ethical guidance in Bhagavad Geeta scripture. Users submit ethical dilemmas, the system retrieves relevant verses, and an LLM generates structured recommendations with citations.

```
User Query → Embedding → Vector Search → LLM Generation → Structured Output
                              ↓
                        Geeta Verses
                        (701 verses)
```

## Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Network                                │
│                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │           │
│  │ (React/Nginx│     │  (FastAPI)  │     │   :5432     │           │
│  │    :80)     │     │    :8000    │     └─────────────┘           │
│  └─────────────┘     └──────┬──────┘                                │
│                             │                                        │
│               ┌─────────────┼─────────────┬──────────────┐          │
│               ▼             ▼             ▼              ▼          │
│         ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐     │
│         │ ChromaDB │  │  Redis  │  │ Ollama  │  │   Worker   │     │
│         │   :8000  │  │  :6379  │  │ :11434  │  │    (RQ)    │     │
│         └──────────┘  └─────────┘  └─────────┘  └────────────┘     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Observability (Optional)                   │  │
│  │  ┌─────────────┐     ┌─────────────┐                         │  │
│  │  │ Prometheus  │────▶│   Grafana   │                         │  │
│  │  │    :9090    │     │    :3000    │                         │  │
│  │  └──────┬──────┘     └─────────────┘                         │  │
│  │         │ Scrapes /metrics                                    │  │
│  │         └───────────────────────────────▶ Backend             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

| Component | Purpose |
|-----------|---------|
| Frontend | React SPA with verse browser, case submission, output display |
| Backend | FastAPI handling auth, cases, RAG pipeline, verse management |
| Worker | RQ background processor for async analysis jobs |
| PostgreSQL | Cases, users, outputs, verses, feedback |
| ChromaDB | Vector embeddings for semantic verse search |
| Redis | Caching, session storage, task queues, rate limiting |
| Ollama | Local LLM inference (primary), Anthropic Claude (fallback) |
| Prometheus | Metrics collection and time-series storage (optional) |
| Grafana | Dashboards, alerting, visualization (optional) |

## RAG Pipeline

### 1. Embedding
User query and all verses are embedded using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).

### 2. Retrieval
ChromaDB performs cosine similarity search, returning top-k relevant verses with scores.

### 3. Generation
Retrieved verses are passed as context to the LLM with a structured prompt requesting:
- Executive summary
- 3 options with tradeoffs
- Recommended action
- Implementation steps
- Reflection prompts
- Verse citations with confidence scores

## Data Model

```
users ──────┬──── cases ──────── outputs
            │        │              │
            │        └── messages   └── feedback
            │
verses ─────┴──── translations
   │
   └──── commentaries
```

Key entities:
- **Case**: Ethical dilemma with title, description, context
- **Output**: LLM-generated analysis with structured JSON
- **Verse**: Sanskrit text, transliteration, translations
- **Feedback**: User ratings on output quality

## Authentication

- JWT tokens for authenticated users
- Session-based tracking for anonymous users
- Refresh tokens stored in HTTP-only cookies
- CSRF protection on state-changing requests

Anonymous users can create and view cases. Authenticated users get persistent history.

## API Design

RESTful API at `/api/v1/`:

```
/auth/*          - Login, signup, refresh, logout
/cases/*         - CRUD + analyze
/verses/*        - Browse, search, daily verse
/outputs/*       - View analysis, submit feedback, export
/messages/*      - Follow-up questions on cases
/contact         - Contact form submission
```

Full OpenAPI docs at `/docs` when running.

## Deployment

Docker Compose orchestrates core services (7) plus optional observability (2):

```yaml
# Core services (docker-compose.yml)
services:
  ollama      # LLM inference (pre-built image, models in volume)
  postgres    # Primary database
  redis       # Cache, queues, rate limiting
  chromadb    # Vector database
  backend     # FastAPI with Uvicorn
  worker      # RQ background task processor
  frontend    # Nginx serving React build

# Observability (docker-compose.observability.yml)
services:
  prometheus  # Metrics collection
  grafana     # Dashboards and alerting
```

Production considerations:
- Set `JWT_SECRET` and `API_KEY` to secure values
- Enable `COOKIE_SECURE=True` for HTTPS
- Configure `CORS_ORIGINS` for your domain
- Pull LLM model: `docker exec geetanjali-ollama ollama pull qwen2.5:3b`
- Enable observability: `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d`
- Use managed PostgreSQL and Redis for reliability at scale

## See Also

- [Building Geetanjali](building-geetanjali.md) — Full technical narrative with code examples
- [Security](security.md) — Container hardening, secrets management
- [Observability](observability.md) — Metrics and alerting configuration
- [Setup Guide](setup.md) — Development environment and configuration
