# Geetanjali

**Ethical leadership guidance from the Bhagavad Geeta**

Geetanjali is a RAG-powered consulting tool that transforms Bhagavad Geeta teachings into defensible, actionable guidance for leadership ethical decisions in organizations.

## 🎯 Purpose

Provide senior managers, HR leaders, and consultants with:
- Executive summaries of ethical dilemmas
- 3 options with clear tradeoffs
- Recommended actions with implementation steps
- Reflection prompts
- Full provenance (verses, commentaries, confidence scores)

## 🏗️ Architecture

**Backend:** FastAPI (Python 3.10+)
**Frontend:** React + TypeScript + Tailwind CSS
**Vector DB:** ChromaDB (local, disk-based)
**LLM:** Ollama + Llama 3.1 8B (local inference)
**Embeddings:** all-MiniLM-L6-v2 (sentence-transformers)
**Database:** SQLite (MVP), PostgreSQL (production)

## 📁 Project Structure

```
geetanjali/
├── backend/          # FastAPI application
│   ├── api/          # API endpoints
│   ├── models/       # Pydantic & SQLAlchemy models
│   ├── services/     # Business logic (RAG, LLM, embeddings)
│   ├── db/           # Database layer
│   └── utils/        # Helper functions
├── frontend/         # React application
├── data/             # Verse data & seed files
├── docs/             # Documentation
│   ├── ADR/          # Architecture Decision Records
│   ├── SETUP.md      # Local development guide
│   └── API.md        # API documentation
└── scripts/          # Utility scripts
```

## 🚀 Quick Start

### Prerequisites

- **Docker** and **Docker Compose** (recommended)
- OR: Python 3.10+, Node.js 18+, Ollama (for local development)

### Docker Setup (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd geetanjali

# Start everything with one command
make init

# Or manually
docker-compose build
docker-compose up -d
```

**That's it!** All services (backend, frontend, database, Ollama) are running.

- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

### Local Development (Without Docker)

See [docs/SETUP.md](docs/SETUP.md) for manual setup instructions.

## 📚 Documentation

- [Setup Guide](docs/SETUP.md) - Local development environment
- [Project Description](todos/project-description.md) - Comprehensive project spec
- [Project Guidelines](todos/project-guidelines.md) - Working principles and standards
- [Architecture Decisions](docs/ADR/) - ADR records

## 🧪 Development

### Docker Commands (via Makefile)

```bash
make dev          # Start development environment
make logs         # View all logs
make test         # Run tests
make lint         # Run linters
make format       # Format code
make db-migrate   # Run database migrations
make clean        # Clean up everything
```

### Manual Commands

```bash
# Run backend (from backend/)
uvicorn main:app --reload

# Run frontend (from frontend/)
npm run dev

# Run tests
pytest  # Backend
npm test  # Frontend
```

See `make help` for all available commands.

## 📝 License

TBD - Under review for appropriate license given Bhagavad Geeta source material.

## 🙏 Acknowledgments

Built on the timeless wisdom of the Bhagavad Geeta, using public domain Sanskrit texts.
