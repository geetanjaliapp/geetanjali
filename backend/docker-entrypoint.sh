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
    echo "⚠️  Warning: Migrations may have failed, but continuing..."
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
