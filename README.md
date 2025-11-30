# Geetanjali

**Ethical leadership guidance from the Bhagavad Gita**

Geetanjali is a RAG-powered consulting tool that transforms Bhagavad Gita teachings into defensible, actionable guidance for leadership ethical decisions in organizations.

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

- Python 3.10+
- Node.js 18+
- Ollama (for local LLM inference)

### Setup

```bash
# Clone repository
git clone <repository-url>
cd geetanjali

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Install Ollama and pull model
ollama pull llama3.1:8b
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

## 📚 Documentation

- [Setup Guide](docs/SETUP.md) - Local development environment
- [Project Description](todos/project-description.md) - Comprehensive project spec
- [Project Guidelines](todos/project-guidelines.md) - Working principles and standards
- [Architecture Decisions](docs/ADR/) - ADR records

## 🧪 Development

```bash
# Run backend (from backend/)
uvicorn main:app --reload

# Run frontend (from frontend/)
npm run dev

# Run tests
pytest  # Backend
npm test  # Frontend
```

## 📝 License

TBD - Under review for appropriate license given Bhagavad Gita source material.

## 🙏 Acknowledgments

Built on the timeless wisdom of the Bhagavad Gita, using public domain Sanskrit texts.
