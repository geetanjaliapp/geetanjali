#!/bin/bash
# Trigger SEO page generation via admin API
#
# Usage:
#   ./scripts/generate-seo.sh              # Run locally (backend must be running)
#   ./scripts/generate-seo.sh --remote     # Run on remote server via SSH
#   ./scripts/generate-seo.sh --force      # Force regeneration (ignore hashes)
#   ./scripts/generate-seo.sh --status     # Check status only
#
# The admin API uses:
#   - Hash-based change detection (only regenerates changed pages)
#   - Docker volume sharing (backend writes, nginx serves)
#   - PostgreSQL advisory locks (prevents concurrent generation)
#
# This is also triggered automatically by:
#   - deploy.sh (post-deploy)
#   - Daily cron job (00:05 UTC)
#   - Startup sync (if no pages exist)

set -e

# Load local environment if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${PROJECT_DIR}/.env.local" ]]; then
    source "${PROJECT_DIR}/.env.local"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SEO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Parse arguments
FORCE=""
STATUS_ONLY=""
REMOTE=""

for arg in "$@"; do
    case $arg in
        --remote)
            REMOTE=1
            ;;
        --force)
            FORCE="?force=true"
            ;;
        --status)
            STATUS_ONLY=1
            ;;
        --help|-h)
            echo "Usage: $0 [--remote] [--force] [--status]"
            echo ""
            echo "Options:"
            echo "  --remote  Run on remote server via SSH"
            echo "  --force   Force regeneration (ignore hashes)"
            echo "  --status  Check status only (no generation)"
            exit 0
            ;;
    esac
done

# Remote execution
if [[ -n "$REMOTE" ]]; then
    [[ -z "${DEPLOY_HOST}" ]] && error "DEPLOY_HOST not set"
    [[ -z "${DEPLOY_DIR}" ]] && error "DEPLOY_DIR not set"

    log "Running on remote server..."
    REMOTE_ARGS=""
    [[ -n "$FORCE" ]] && REMOTE_ARGS="--force"
    [[ -n "$STATUS_ONLY" ]] && REMOTE_ARGS="--status"
    ssh "${DEPLOY_HOST}" "cd ${DEPLOY_DIR} && ./scripts/generate-seo.sh $REMOTE_ARGS"
    exit $?
fi

# Verify backend is running
log "Checking backend health..."
HEALTH=$(docker exec geetanjali-backend curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health 2>/dev/null || echo "000")
if [[ "$HEALTH" != "200" ]]; then
    error "Backend is not healthy (status: $HEALTH). Start services first: docker compose up -d"
fi

# Status check only
if [[ -n "$STATUS_ONLY" ]]; then
    log "Checking SEO status..."
    docker exec geetanjali-backend curl -s http://localhost:8000/api/v1/admin/seo/status | python3 -m json.tool
    exit 0
fi

# Trigger generation
log "Triggering SEO generation..."
RESULT=$(docker exec geetanjali-backend curl -s -f -X POST "http://localhost:8000/api/v1/admin/seo/generate${FORCE}" 2>&1)
if [[ $? -ne 0 ]]; then
    error "SEO generation failed: $RESULT"
fi

echo "$RESULT" | python3 -m json.tool

log "${GREEN}SEO generation complete!${NC}"
echo ""
echo "  Verify: make seo-status"
echo "  Test:   curl -A 'Googlebot' https://geetanjaliapp.com/"
echo ""
