#!/bin/bash
set -e

# Determine service type based on SKIP_DB_INIT
SERVICE_TYPE="${SKIP_DB_INIT:+Worker}"
SERVICE_TYPE="${SERVICE_TYPE:-Backend}"

echo "=== Geetanjali $SERVICE_TYPE Initialization ==="

# Wait for PostgreSQL to be ready (required by both backend and worker)
echo "Waiting for PostgreSQL..."
until pg_isready -h "${PGHOST:-postgres}" -p "${PGPORT:-5432}" -U "${PGUSER:-geetanjali}" -q 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is ready!"

# Worker mode: Skip DB initialization, migrations, and ingestion
# Worker only needs database connectivity for queries, not schema management
if [ "${SKIP_DB_INIT:-false}" = "true" ]; then
    echo "Worker mode: Skipping DB initialization (backend manages schema)"
    echo "=== Initialization Complete ==="
    echo ""

    # If arguments are passed (e.g., "python worker.py"), run those
    if [ $# -gt 0 ]; then
        echo "Starting: $@"
        exec "$@"
    fi
    exit 0
fi

# === BACKEND ONLY: Full initialization ===

# Wait for ChromaDB to be ready (with timeout)
echo "Waiting for ChromaDB..."
CHROMA_URL="http://${CHROMA_HOST:-chromadb}:${CHROMA_PORT:-8000}/api/v2/heartbeat"
RETRIES=15
COUNT=0
until curl -sf "$CHROMA_URL" > /dev/null 2>&1; do
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $RETRIES ]; then
    echo "⚠️  Warning: ChromaDB is not responding after ${RETRIES} attempts"
    echo "Continuing anyway - vector search features may not work until ChromaDB is available"
    break
  fi
  echo "ChromaDB is unavailable - sleeping ($COUNT/$RETRIES)"
  sleep 2
done

if curl -sf "$CHROMA_URL" > /dev/null 2>&1; then
  echo "ChromaDB is ready!"
fi

# Initialize database tables (non-destructive - only creates missing tables)
echo "Initializing database tables..."
python3 -c "
from db.connection import engine
from models.base import Base
# Import all models to register them with Base
from models.user import User
from models.case import Case
from models.message import Message
from models.output import Output
from models.refresh_token import RefreshToken
from models.verse import Verse, Translation

# Create tables that don't exist (non-destructive)
Base.metadata.create_all(bind=engine)
print('✓ Database tables initialized')
"

# Run database migrations
echo "Running database migrations..."
# Check if alembic_version table exists (means migrations have been run before)
HAS_ALEMBIC=$(python3 -c "
from db.connection import SessionLocal
from sqlalchemy import text
db = SessionLocal()
try:
    result = db.execute(text(\"SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version'\"))
    print('yes' if result.fetchone() else 'no')
except:
    print('no')
finally:
    db.close()
")

if [ "$HAS_ALEMBIC" = "no" ]; then
    echo "First run - stamping database with current schema version..."
    alembic stamp head
fi

# Now run any pending migrations
alembic upgrade head || {
    echo "⚠️  Warning: Migration upgrade failed"

    # Check if we're already at head (tables exist but version tracking is off)
    CURRENT=$(alembic current 2>/dev/null | grep -oE '[0-9]+' | head -1)
    HEAD=$(alembic heads 2>/dev/null | grep -oE '[0-9]+' | head -1)

    if [ -n "$CURRENT" ] && [ -n "$HEAD" ] && [ "$CURRENT" != "$HEAD" ]; then
        echo "Detected version mismatch (current: $CURRENT, head: $HEAD)"
        echo "Attempting to stamp to head (tables may already exist from backup/restore)..."
        alembic stamp head && echo "✓ Stamped to head successfully" || echo "⚠️  Stamp also failed"
    fi
}
echo "✓ Database migrations complete"

# Check if data ingestion is needed
echo "Checking if initial data ingestion is needed..."
NEEDS_INGESTION=$(python3 -c "
from db.connection import SessionLocal
from models.verse import Verse

db = SessionLocal()
try:
    verse_count = db.query(Verse).count()
    # If we have fewer than 100 verses, we need full ingestion
    print('yes' if verse_count < 100 else 'no')
finally:
    db.close()
")

if [ "$NEEDS_INGESTION" = "yes" ]; then
    echo "Database appears empty or incomplete. Running initial data ingestion..."
    echo "This may take several minutes..."

    # Run full ingestion (enrichment is always separate via /api/v1/admin/enrich)
    python3 scripts/ingest_data.py --all || {
        echo "⚠️  Warning: Initial data ingestion failed"
        echo "You can trigger ingestion manually later via the API"
    }
else
    echo "✓ Database already contains data (found verses). Skipping automatic ingestion."
    echo "Use the /api/v1/admin/ingest endpoint to manually trigger ingestion if needed."
fi

echo "=== Initialization Complete ==="
echo ""

# Pre-warm Ollama model in background (only if Ollama is the LLM provider)
if [ "${LLM_PROVIDER:-}" = "ollama" ] && [ "${USE_MOCK_LLM:-false}" != "true" ]; then
    OLLAMA_URL="${OLLAMA_BASE_URL:-http://ollama:11434}"
    OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"

    echo "Pre-warming Ollama model ($OLLAMA_MODEL) in background..."
    (
        # Wait a moment for the main process to start
        sleep 5

        # Send a simple prompt to load the model into memory
        curl -sf -X POST "$OLLAMA_URL/api/generate" \
            -H "Content-Type: application/json" \
            -d "{\"model\": \"$OLLAMA_MODEL\", \"prompt\": \"Hello\", \"stream\": false}" \
            --max-time 600 > /dev/null 2>&1 && \
            echo "✓ Ollama model pre-warmed successfully" || \
            echo "⚠️  Ollama pre-warm failed (model will load on first request)"
    ) &
fi

# If arguments are passed (e.g., "python worker.py"), run those instead
if [ $# -gt 0 ]; then
    echo "Starting: $@"
    exec "$@"
else
    echo "Starting FastAPI server..."
    exec uvicorn main:app --host 0.0.0.0 --port 8000
fi
