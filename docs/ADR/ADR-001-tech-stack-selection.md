# ADR-001: Tech Stack Selection

**Status:** Accepted
**Date:** 2025-11-30
**Decision Makers:** Engineering Lead
**Tags:** architecture, technology, infrastructure

## Context

Geetanjali is a greenfield RAG application that transforms Bhagavad Geeta teachings into actionable ethical leadership guidance. We need to select technologies that:

1. Support RAG pipeline (retrieval, embeddings, LLM integration)
2. Enable local-first, free operation (privacy + cost)
3. Provide production-grade performance and scalability
4. Align with team expertise and maintainability goals

## Decision

We will use the following tech stack:

### Backend
- **FastAPI (Python 3.10+)** - Web framework
- **SQLAlchemy** - ORM for database operations
- **Alembic** - Database migrations
- **Pydantic** - Data validation and settings

### Vector Database
- **ChromaDB** (local, disk-based) - Vector storage and retrieval

### LLM & Embeddings
- **Ollama + Llama 3.1 8B** - Local LLM inference
- **sentence-transformers (all-MiniLM-L6-v2)** - Embedding model

### Database
- **SQLite** (MVP) → **PostgreSQL** (production)

### Frontend
- **React + TypeScript** - UI framework
- **Vite** - Build tool (faster than Create React App)
- **Tailwind CSS** - Styling
- **React Query** - API state management

### Testing & Quality
- **pytest** - Backend testing
- **Vitest** - Frontend testing
- **Playwright** - E2E testing
- **black, flake8, mypy** - Python code quality
- **ESLint** - JavaScript/TypeScript linting

## Rationale

### Why FastAPI?
✅ Async support for high performance
✅ Auto-generated OpenAPI docs
✅ Excellent type hints and validation (Pydantic)
✅ Modern, fast, and actively maintained
❌ Alternatives: Flask (less modern), Django (too heavyweight)

### Why ChromaDB?
✅ Purpose-built for embeddings and vector search
✅ Simple local setup, no external dependencies
✅ Good Python integration
✅ Can scale to hosted version if needed
❌ Alternatives: FAISS (lower-level), Pinecone (not local/free), Weaviate (complex)

### Why Ollama + Llama 3.1 8B?
✅ Fully local, no API costs or data privacy concerns
✅ Good reasoning quality for 8B model
✅ Runs on CPU/GPU, accessible hardware
✅ Simple API, easy integration
❌ Alternatives: OpenAI GPT (cost, privacy), Claude (cost), Mistral API (external)

### Why SQLite → PostgreSQL path?
✅ Start simple: SQLite requires zero setup
✅ Easy migration path to Postgres when scale demands it
✅ Same SQLAlchemy ORM works for both
❌ Starting with Postgres adds deployment complexity for MVP

### Why React + Vite?
✅ React: Industry standard, large ecosystem
✅ Vite: Significantly faster than Webpack/CRA
✅ TypeScript: Type safety reduces bugs
✅ Tailwind: Rapid UI development, utility-first
❌ Alternatives: Next.js (overkill for MVP), Vue (less ecosystem), Svelte (less familiar)

## Consequences

### Positive
- Free, local-first stack = no recurring costs for MVP
- Fast development with modern frameworks
- Strong type safety (TypeScript + Pydantic)
- Simple local development environment
- Privacy: all data stays local during development

### Negative
- Ollama requires model download (~4GB for Llama 3.1 8B)
- Local LLM slower than cloud APIs (acceptable for MVP)
- SQLite won't scale to multi-user production (planned migration)
- Team needs to learn ChromaDB (low learning curve)

### Neutral
- Python 3.10+ required (may need upgrade on some machines)
- Node.js 18+ required for frontend

## Alternatives Considered

| Component | Alternative | Why Not Chosen |
|-----------|------------|----------------|
| Backend | Django | Too monolithic, slower startup |
| Backend | Flask | Less modern, no async, manual validation |
| Vector DB | FAISS | Lower-level, less ergonomic API |
| Vector DB | Pinecone | Not free/local |
| LLM | OpenAI GPT-4 | Cost, privacy concerns |
| LLM | Claude API | Cost, external dependency |
| Frontend | Next.js | SSR overkill for SPA MVP |
| Database | Postgres (start) | Complexity for single-user MVP |

## Implementation Notes

1. Document Ollama installation in SETUP.md
2. Pin all dependency versions in requirements.txt
3. Use .python-version to specify Python 3.10+
4. Configure CORS for local development (frontend port 5173)
5. Add DATABASE_URL to .env for easy SQLite → Postgres switch

## Review Schedule

- **Next Review:** After Phase 3 (Vector DB integration complete)
- **Review Trigger:** If local LLM performance is unacceptable
- **Alternative Trigger:** If multi-user scale requires Postgres earlier

## References

- FastAPI: https://fastapi.tiangolo.com/
- ChromaDB: https://www.trychroma.com/
- Ollama: https://ollama.ai/
- sentence-transformers: https://www.sbert.net/
