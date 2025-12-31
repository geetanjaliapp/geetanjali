# Scripts

Utility scripts for development, deployment, and maintenance.

## Development

- `init_db.py` — Initialize database schema and create test user
- `index_verses.py` — Index verses into ChromaDB vector store
- `validate_verses.py` — Validate verse JSON data structure
- `pre-commit-check.sh` — Run Black/Flake8 checks before commit
- `test_ollama_rag.py` — Test local Ollama RAG pipeline

## Production

- `setup-server.sh` — **One-time** server setup (installs Docker, git-lfs, SOPS, age)
- `deploy.sh` — Deploy to production (requires `DEPLOY_HOST`, `DEPLOY_DIR`, `DEPLOY_AGE_KEY`)
- `setup-crons.sh` — Install cron jobs for maintenance and newsletters
- `maintenance.sh` — Automated backup, cleanup, and health checks (runs via cron)

### First-time Server Setup

```bash
# On the production server (run once, after cloning)
sudo ./scripts/setup-server.sh
```
