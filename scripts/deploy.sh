#!/bin/bash
# Geetanjali Production Deployment Script
# Usage: ./scripts/deploy.sh

set -e

# Configuration
REMOTE_USER="gitam"
REMOTE_HOST="64.227.133.142"
REMOTE_DIR="/opt/geetanjali"
SSH_CMD="ssh ${REMOTE_USER}@${REMOTE_HOST}"
AGE_KEY_FILE="/home/gitam/.config/sops/age/keys.txt"

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

# Step 3: Pull on remote
log "Pulling changes on server..."
$SSH_CMD "cd ${REMOTE_DIR} && git pull origin main" || error "Failed to pull on server"

# Step 4: Decrypt .env file using SOPS + age
log "Decrypting .env file..."
$SSH_CMD "cd ${REMOTE_DIR} && \
    SOPS_AGE_KEY_FILE=${AGE_KEY_FILE} sops --decrypt --input-type dotenv --output-type dotenv .env.enc > .env.new && \
    mv .env.new .env" || error "Failed to decrypt .env file"
info "Secrets decrypted successfully"

# Step 5: Tag current images for rollback (before rebuild)
log "Tagging current images for rollback..."
$SSH_CMD "cd ${REMOTE_DIR} && \
    docker tag geetanjali-backend:latest geetanjali-backend:rollback 2>/dev/null || true && \
    docker tag geetanjali-frontend:latest geetanjali-frontend:rollback 2>/dev/null || true && \
    docker tag geetanjali-chromadb:latest geetanjali-chromadb:rollback 2>/dev/null || true"

# Step 6: Rebuild and restart containers
log "Rebuilding and restarting containers..."
$SSH_CMD "cd ${REMOTE_DIR} && docker compose build && docker compose up -d" || error "Failed to restart containers"

# Step 7: Wait for health checks
log "Waiting for services to become healthy..."
sleep 15

# Step 8: Verify deployment
log "Service status:"
$SSH_CMD "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Step 9: Health check
HEALTH_STATUS=$($SSH_CMD "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health")
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
