#!/bin/bash
# Geetanjali Production Deployment Script
# Usage: ./scripts/deploy.sh
#
# Required environment variables (set in .env.local or export manually):
#   DEPLOY_HOST     - SSH host (e.g., user@host or alias from ~/.ssh/config)
#   DEPLOY_DIR      - Remote app directory
#   DEPLOY_AGE_KEY  - Path to age private key on remote server

set -e

# Load local environment if present (gitignored)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../.env.local" ]]; then
    # shellcheck source=/dev/null
    source "${SCRIPT_DIR}/../.env.local"
fi

# Validate required environment variables
missing_vars=()
[[ -z "${DEPLOY_HOST}" ]] && missing_vars+=("DEPLOY_HOST")
[[ -z "${DEPLOY_DIR}" ]] && missing_vars+=("DEPLOY_DIR")
[[ -z "${DEPLOY_AGE_KEY}" ]] && missing_vars+=("DEPLOY_AGE_KEY")

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "Error: Missing required environment variables: ${missing_vars[*]}"
    echo ""
    echo "Required:"
    echo "  DEPLOY_HOST     - SSH host (e.g., user@host)"
    echo "  DEPLOY_DIR      - Remote app directory"
    echo "  DEPLOY_AGE_KEY  - Path to age private key on server"
    exit 1
fi

# Configuration
SSH_CMD="ssh ${DEPLOY_HOST}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Geetanjali Production Deployment"
echo "=========================================="
echo ""

# Step 1: Check for uncommitted changes
log "Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    error "Uncommitted changes detected. Please commit or stash before deploying."
fi

# Step 2: Push local changes
log "Pushing to origin..."
git push origin main || error "Failed to push to origin"

# Step 3: Pull on remote (including LFS files like audio)
log "Pulling changes on server..."
$SSH_CMD "cd ${DEPLOY_DIR} && git pull origin main && git lfs pull" || error "Failed to pull on server"

# Step 4: Decrypt .env file using SOPS + age
log "Decrypting .env file..."
$SSH_CMD "cd ${DEPLOY_DIR} && \
    SOPS_AGE_KEY_FILE=${DEPLOY_AGE_KEY} sops --decrypt --input-type dotenv --output-type dotenv --output .env.tmp .env.enc && \
    mv .env.tmp .env" || error "Failed to decrypt .env file"
info "Secrets decrypted successfully"

# Step 4b: Process Grafana alerting templates (extract var with grep, avoiding shell quoting issues)
log "Processing Grafana alert configuration..."
$SSH_CMD "cd ${DEPLOY_DIR} && \
    ALERT_EMAIL=\$(grep '^GRAFANA_ALERT_EMAIL_TO=' .env | cut -d'=' -f2) && \
    if [ -n \"\$ALERT_EMAIL\" ]; then \
        sed -i \"s/PLACEHOLDER_ALERT_EMAIL/\$ALERT_EMAIL/g\" monitoring/grafana/provisioning/alerting/contactpoints.yml; \
    fi" || warn "Grafana alert config not processed (optional)"

# Step 5: Tag current images for rollback (before rebuild)
log "Tagging current images for rollback..."
$SSH_CMD "cd ${DEPLOY_DIR} && \
    docker tag geetanjali-backend:latest geetanjali-backend:rollback 2>/dev/null || true && \
    docker tag geetanjali-frontend:latest geetanjali-frontend:rollback 2>/dev/null || true && \
    docker tag geetanjali-chromadb:latest geetanjali-chromadb:rollback 2>/dev/null || true"

# Step 5b: Get version from git tag (single source of truth)
log "Determining app version from git tag..."
APP_VERSION=$($SSH_CMD "cd ${DEPLOY_DIR} && git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo '1.5.0'")
info "Deploying version: ${APP_VERSION}"

# Step 6: Rebuild and restart containers with version
log "Rebuilding and restarting containers..."
$SSH_CMD "cd ${DEPLOY_DIR} && APP_VERSION=${APP_VERSION} docker compose build && APP_VERSION=${APP_VERSION} docker compose up -d" || error "Failed to restart containers"

# Step 7: Wait for health checks with polling
log "Waiting for services to become healthy..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    HEALTH_CODE=$($SSH_CMD "docker exec geetanjali-backend curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health 2>/dev/null" || echo "000")
    if [ "$HEALTH_CODE" = "200" ]; then
        info "Backend healthy after $ATTEMPT attempts"
        break
    fi
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        warn "Health check timed out after $MAX_ATTEMPTS attempts"
        break
    fi
    sleep 2
done

# Step 8: Verify deployment
log "Service status:"
$SSH_CMD "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Step 9: Health check (via docker exec since port not exposed)
HEALTH_STATUS=$($SSH_CMD "docker exec geetanjali-backend curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health 2>/dev/null" || echo "000")
if [[ "$HEALTH_STATUS" == "200" ]]; then
    echo ""
    log "Health check: ${GREEN}PASSED${NC}"
else
    warn "Health check returned: $HEALTH_STATUS"
    echo ""
    echo "To rollback, run: make rollback"
fi

echo ""
echo "=========================================="
log "${GREEN}Deployment complete!${NC}"
echo "=========================================="
echo ""
echo "  Site: https://geetanjaliapp.com"
echo "  API:  https://geetanjaliapp.com/api/v1/docs"
echo ""
echo "  Rollback available: make rollback"
echo ""
