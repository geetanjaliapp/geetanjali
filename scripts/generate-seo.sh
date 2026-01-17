#!/bin/bash
# Generate SEO static pages for Geetanjali
#
# This script generates static HTML pages for search engine bots.
# It requires the backend API to be running (fetches verse data).
#
# Usage:
#   ./scripts/generate-seo.sh              # Run locally or on server
#   ./scripts/generate-seo.sh --remote     # Run on remote server via SSH
#
# The script:
#   1. Spins up a temporary Python container with network access to backend
#   2. Generates 700+ HTML pages from templates + API data
#   3. Copies the output to the frontend container's /seo directory

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
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[SEO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# Check if running remotely
if [[ "$1" == "--remote" ]]; then
    [[ -z "${DEPLOY_HOST}" ]] && error "DEPLOY_HOST not set"
    [[ -z "${DEPLOY_DIR}" ]] && error "DEPLOY_DIR not set"

    log "Running SEO generation on remote server..."
    ssh "${DEPLOY_HOST}" "cd ${DEPLOY_DIR} && ./scripts/generate-seo.sh"
    exit $?
fi

# Detect docker network name
NETWORK=$(docker network ls --format '{{.Name}}' | grep -E 'geetanjali.*network' | head -1)
if [[ -z "$NETWORK" ]]; then
    # Fallback to default compose network naming
    NETWORK="geetanjali_default"
fi
info "Using docker network: $NETWORK"

# Verify backend is healthy
log "Checking backend health..."
HEALTH=$(docker exec geetanjali-backend curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health 2>/dev/null || echo "000")
if [[ "$HEALTH" != "200" ]]; then
    error "Backend is not healthy (status: $HEALTH). Start services first: docker compose up -d"
fi
info "Backend is healthy"

# Create temp output directory
OUTPUT_DIR=$(mktemp -d)
trap "rm -rf $OUTPUT_DIR" EXIT

log "Generating SEO pages..."

# Run the generator in a temporary container with network access
docker run --rm \
    --network "$NETWORK" \
    -v "${PROJECT_DIR}/backend/scripts/generate_seo.py:/gen/generate_seo.py:ro" \
    -v "${PROJECT_DIR}/backend/templates:/templates:ro" \
    -v "${PROJECT_DIR}/frontend/src/content:/gen/content:ro" \
    -v "${OUTPUT_DIR}:/gen/output" \
    python:3.11-alpine \
    sh -c "pip install --quiet jinja2 httpx 2>/dev/null && python /gen/generate_seo.py --output /gen/output --api-url http://backend:8000 --content-dir /gen/content"

# Count generated files
HTML_COUNT=$(find "$OUTPUT_DIR" -name "*.html" | wc -l | tr -d ' ')
XML_COUNT=$(find "$OUTPUT_DIR" -name "*.xml" | wc -l | tr -d ' ')

if [[ "$HTML_COUNT" -eq 0 ]]; then
    error "No HTML files generated. Check the generator output above."
fi

log "Generated ${HTML_COUNT} HTML pages + ${XML_COUNT} XML files"

# Copy to frontend container
log "Copying to frontend container..."
docker cp "${OUTPUT_DIR}/." geetanjali-frontend:/usr/share/nginx/html/seo/

# Verify
COPIED=$(docker exec geetanjali-frontend find /usr/share/nginx/html/seo -name "*.html" | wc -l | tr -d ' ')
log "Verified: ${COPIED} HTML files in frontend container"

echo ""
log "${GREEN}SEO generation complete!${NC}"
echo ""
echo "  Test with: curl -A 'Googlebot' https://geetanjaliapp.com/"
echo ""
