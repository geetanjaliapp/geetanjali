#!/bin/bash
set -e

echo "=== Geetanjali Backend Initialization ==="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until python3 -c "
import psycopg2
import os
import sys
from urllib.parse import urlparse

db_url = os.environ.get('DATABASE_URL', '')
if not db_url:
    print('No DATABASE_URL set')
    sys.exit(1)

parsed = urlparse(db_url)
try:
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path[1:],
        connect_timeout=3
    )
    conn.close()
    print('PostgreSQL is ready')
except Exception as e:
    print(f'PostgreSQL not ready: {e}')
    sys.exit(1)
" 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"

# Wait for ChromaDB to be ready (with timeout)
echo "Waiting for ChromaDB..."
CHROMA_URL="http://${CHROMA_HOST:-chromadb}:${CHROMA_PORT:-8000}/api/v1/heartbeat"
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

# Initialize database tables
echo "Initializing database tables..."
python3 -c "
from init_db import init_db
init_db()
print('✓ Database tables initialized')
"

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

    # Run full ingestion without LLM enrichment for faster initial load
    # Enrichment can be done later via manual trigger
    python3 scripts/ingest_data.py --all --no-enrich || {
        echo "⚠️  Warning: Initial data ingestion failed"
        echo "You can trigger ingestion manually later via the API"
    }
else
    echo "✓ Database already contains data (found verses). Skipping automatic ingestion."
    echo "Use the /api/v1/admin/ingest endpoint to manually trigger ingestion if needed."
fi

echo "=== Initialization Complete ==="
echo ""
echo "Starting FastAPI server..."

# Start the FastAPI application
exec uvicorn main:app --host 0.0.0.0 --port 8000
