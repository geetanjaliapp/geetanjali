# Scripts

Utility scripts for development, deployment, and maintenance.

## Development

- `init_db.py` — Initialize database schema and create test user
- `index_verses.py` — Index verses into ChromaDB vector store
- `validate_verses.py` — Validate verse JSON data structure
- `pre-commit-check.sh` — Run Black/Flake8 checks before commit
- `test_ollama_rag.py` — Test local Ollama RAG pipeline

## Production

- `deploy.sh` — Deploy to production (requires `DEPLOY_HOST`, `DEPLOY_DIR`, `DEPLOY_AGE_KEY`)
- `maintenance.sh` — Automated backup, cleanup, and health checks (runs via cron)
