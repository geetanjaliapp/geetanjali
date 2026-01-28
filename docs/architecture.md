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
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                       Docker Network                         │
│                                                              │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐         │
│   │  Frontend  │───▶│  Backend   │───▶│ PostgreSQL │         │
│   │    :80     │    │   :8000    │    │   :5432    │         │
│   └────────────┘    └─────┬──────┘    └────────────┘         │
│                           │                                  │
│            ┌──────────────┼──────────────┐                   │
│            │              │              │                   │
│            ▼              ▼              ▼                   │
│       ┌─────────┐   ┌─────────┐   ┌─────────┐                │
│       │ChromaDB │   │  Redis  │   │ Ollama  │                │
│       │  :8000  │   │  :6379  │   │ :11434  │                │
│       └─────────┘   └─────────┘   └─────────┘                │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                                                      │   │
│   │  Observability (Optional)                            │   │
│   │                                                      │   │
│   │   ┌────────────┐        ┌────────────┐               │   │
│   │   │ Prometheus │───────▶│  Grafana   │               │   │
│   │   │   :9090    │        │   :3000    │               │   │
│   │   └─────┬──────┘        └────────────┘               │   │
│   │         │                                            │   │
│   │         └── Scrapes /metrics from Backend + Worker   │   │
│   │                                                      │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Component | Purpose |
|-----------|---------|
| Frontend | React SPA for users; static HTML pages served to search engine bots |
| Backend | FastAPI handling auth, cases, RAG pipeline, verse management |
| Worker | RQ background processor for async analysis jobs |
| PostgreSQL | Cases, users, outputs, verses, feedback |
| ChromaDB | Vector embeddings for semantic verse search |
| Redis | Caching, session storage, task queues, rate limiting |
| Ollama | Local LLM inference (primary—self-hosted, no API costs) |
| Cloud LLMs | Gemini/Anthropic APIs (fallback when hardware is limited) |
| Prometheus | Metrics collection and time-series storage (optional) |
| Grafana | Dashboards, alerting, visualization (optional) |

## RAG Pipeline

### 1. Embedding
User query and all verses are embedded using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions). Embeddings are computed **client-side** in backend/worker containers—ChromaDB stores vectors but does not compute them.

> **Note:** ChromaDB collection metadata binds embedding function configuration. Queries must use the same embedding function as collection creation. This requires sentence-transformers installed in backend/worker, not just ChromaDB server.

### 2. Retrieval
ChromaDB performs cosine similarity search, returning top-k relevant verses with scores.

### 3. Multi-Pass Generation

The system uses a 5-pass refinement workflow to ensure thoughtful, well-grounded guidance. This iterative approach compensates for smaller local models—rather than relying on expensive cloud APIs, we invest computation time in refinement to achieve quality output from self-hosted inference.

1. **Acceptance** — Validates the query is a genuine ethical dilemma (not factual questions or harmful requests)
2. **Draft** — Generates initial reasoning without format constraints
3. **Critique** — Reviews the draft for depth, gaps, and verse alignment
4. **Refine** — Rewrites addressing critique, improving clarity and specificity
5. **Structure** — Converts refined prose into structured JSON output

Each pass is audited for quality analysis. If structuring fails, the system reconstructs output from earlier passes with appropriate confidence flagging.

**Output includes:**
- Executive summary with verse citations
- 3 options with tradeoffs
- Recommended action with steps
- Reflection prompts
- Confidence score and scholar flag for low-confidence responses

## Resilience Patterns

### Circuit Breakers

External services are protected by circuit breakers that prevent cascading failures:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CLOSED    │────▶│  HALF_OPEN  │────▶│    OPEN     │
│ (normal)    │     │   (probe)   │     │  (reject)   │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                  │                   │
       └──────────────────┴───────────────────┘
              success           timeout
```

| Service | Failure Threshold | Recovery Timeout | Fallback |
|---------|-------------------|------------------|----------|
| Ollama LLM | 3 consecutive | 60s | Cloud fallback (if configured) |
| Cloud LLMs | 3 consecutive | 60s | Next provider or error |
| ChromaDB | 3 consecutive | 60s | SQL keyword search |
| Email (Resend) | 5 consecutive | 60s | Queue for retry |

### Provider Configuration

Each LLM provider has auto-tuned defaults without requiring feature flags:

| Provider | Temperature | Timeout | Prompt Optimization | Structured Output |
|----------|-------------|---------|---------------------|------------------|
| Ollama | 0.3 (deterministic) | 30s | Simplified prompts | Multipass refinement |
| Gemini | 0.3 (deterministic) | 30s (milliseconds) | Standard prompts | Explicit JSON schema |
| Anthropic | 0.7 (balanced) | 60s | Standard prompts | No schema (reliable native) |
| Mock | 0.0 | Instant | N/A | Hardcoded JSON |

Auto-tuning means the system automatically applies provider-specific optimizations without configuration. Gemini uses explicit JSON schema for structured output, Ollama uses simplified prompts for efficiency, and temperature is lowered for deterministic responses.

### Fallback Chains

**LLM Inference** (configurable via `LLM_PROVIDER` and `LLM_FALLBACK_PROVIDER`):
```
Primary Provider ──[CB open]──▶ Fallback Provider ──[CB open]──▶ Error
       │                               │
       └── ollama (recommended)        └── gemini | anthropic | mock
```

The ideal setup uses Ollama locally with multi-pass refinement for quality. Cloud providers (Gemini, Anthropic) are available as fallbacks when hardware resources are limited.

**Vector Search:**
```
ChromaDB semantic search ──[CB open]──▶ PostgreSQL keyword search
         │                                      │
         └── cosine similarity                  └── ILIKE + ts_vector
```

### Retry Logic

Operations use exponential backoff with jitter:
- LLM requests: 3 attempts, 1-4s backoff
- Database: 3 attempts, 0.5-2s backoff
- ChromaDB: 3 attempts, 0.1-1s backoff

### Cache Stampede Protection

TTL values include ±10% jitter to prevent thundering herd on expiry. Daily verse cache expires around midnight UTC with randomized offset.

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
/cases/*         - CRUD + analyze + follow-up conversations
/verses/*        - Browse, search, daily verse
/outputs/*       - View analysis, submit feedback, export
/messages/*      - Conversation history for cases
/contact         - Contact form submission
```

### Follow-up Conversations

After initial analysis, users can ask follow-up questions via `POST /cases/{id}/follow-up`. This async endpoint:
- Returns 202 Accepted immediately with the user message
- Processes LLM response in background via RQ worker
- Uses prior consultation context without full RAG regeneration
- Rate limited at 30/hour (3x the analysis rate)
- Frontend polls case status until completed to get assistant response

Full OpenAPI docs at `/docs` when running.

## Audio Subsystem

Geetanjali includes AI-generated Sanskrit recitations for all 701 verses plus Geeta Dhyanam invocations.

### Audio Delivery

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│     Nginx       │────▶│  /audio/mp3/    │
│   <audio>       │     │   (static)      │     │   (Git LFS)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                └── Cache-Control: 1 year, immutable
```

- **Storage**: 710 MP3 files (~94MB total) tracked via Git LFS
- **Serving**: Nginx serves static files directly (not proxied to backend)
- **Caching**: 1-year browser cache with immutable headers

### Text-to-Speech (TTS) API

Real-time TTS for user-selected text using Edge TTS:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   /api/v1/tts   │────▶│    Edge TTS     │
│   POST text     │     │   (backend)     │     │   (Microsoft)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Redis Cache   │
                        │   (24h TTL)     │
                        └─────────────────┘
```

- **Voices**: Hindi (`hi-IN-MadhurNeural`) and English (`en-US-AriaNeural`)
- **Caching**: Redis with 24-hour TTL, SHA256-based cache keys
- **Rate limiting**: 30 requests/minute per user
- **Metrics**: `geetanjali_tts_*` Prometheus counters

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
