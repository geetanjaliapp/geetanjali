#!/bin/bash
# Geetanjali First-Time Deployment Initialization
# Usage: ./scripts/init-deployment.sh
#
# Run this AFTER cloning the repo and BEFORE first docker compose up.
# This script:
#   - Ensures correct branch (main)
#   - Creates directories for Docker volumes with correct ownership
#   - Validates environment file exists
#
# Idempotent: Safe to run multiple times.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[INIT]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "=============================================="
echo "  Geetanjali Deployment Initialization"
echo "=============================================="
echo ""

# =============================================================================
# Step 1: Verify Git State
# =============================================================================

log "Checking git state..."

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    warn "Currently on branch: $CURRENT_BRANCH"
    log "Switching to main branch..."
    git checkout main
    git pull origin main
fi

# Ensure we're up to date
log "Pulling latest changes..."
git pull origin main 2>/dev/null || warn "Could not pull (may be offline or no changes)"
git lfs pull 2>/dev/null || warn "Could not pull LFS files (may be offline)"

info "Git state: main branch, up to date"

# =============================================================================
# Step 2: Verify Environment File
# =============================================================================

log "Checking environment file..."

if [[ ! -f ".env" ]]; then
    if [[ -f ".env.enc" ]]; then
        error ".env not found. Decrypt secrets first:\n  SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt sops -d .env.enc > .env"
    else
        error ".env not found and .env.enc missing. Check repository state."
    fi
fi

info "Environment file: present"

# =============================================================================
# Step 3: Create Volume Directories with Correct Ownership
# =============================================================================
# Docker volumes are created with root ownership by default.
# Pre-creating directories ensures the app user (uid 1000) can write.

log "Initializing volume directories..."

# Get current user info
CURRENT_USER=$(id -u)
CURRENT_GROUP=$(id -g)

# Directories that need to be writable by containers running as uid 1000
VOLUME_DIRS=(
    # SEO output: backend writes, nginx reads
    # Volume mount: seo_output:/app/seo-output
    # Note: This is a named volume, but we can pre-create a local dir for bind mount fallback
)

# Local directories that need correct ownership
LOCAL_DIRS=(
    "public/audio"      # Audio files (read by backend)
)

# Create local directories if they don't exist
for dir in "${LOCAL_DIRS[@]}"; do
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        log "Created: $dir"
    fi
done

info "Volume directories: initialized"

# =============================================================================
# Step 4: Docker Volume Initialization
# =============================================================================
# For named Docker volumes, we need to ensure correct ownership after first creation.
# This is handled by a one-time init container or post-start script.

log "Checking Docker availability..."

if ! command -v docker &> /dev/null; then
    warn "Docker not available. Volume initialization will happen on first deploy."
else
    # Check if we need to initialize volumes (first deployment)
    if ! docker volume ls -q | grep -q "geetanjali_seo_output"; then
        info "SEO volume doesn't exist yet. Will be created on first 'docker compose up'."
        info "After first start, run: docker exec geetanjali-backend ls -la /app/seo-output"
    else
        info "SEO volume exists. Checking ownership..."
        # Try to check ownership via backend container
        if docker ps -q -f name=geetanjali-backend | grep -q .; then
            OWNER=$(docker exec geetanjali-backend stat -c '%U' /app/seo-output 2>/dev/null || echo "unknown")
            if [[ "$OWNER" == "appuser" ]]; then
                info "SEO volume ownership: correct (appuser)"
            else
                warn "SEO volume may have incorrect ownership: $OWNER"
                info "Fix with: docker exec -u root geetanjali-backend chown appuser:appuser /app/seo-output"
            fi
        fi
    fi
fi

# =============================================================================
# Step 5: Verify File Permissions
# =============================================================================

log "Checking file permissions..."

# Ensure scripts are executable
chmod +x scripts/*.sh 2>/dev/null || true

# Check if .git is owned by current user
GIT_OWNER=$(stat -c '%U' .git 2>/dev/null || stat -f '%Su' .git 2>/dev/null)
CURRENT_USERNAME=$(whoami)

if [[ "$GIT_OWNER" != "$CURRENT_USERNAME" ]]; then
    warn ".git directory owned by $GIT_OWNER, not $CURRENT_USERNAME"
    warn "Fix with: sudo chown -R $CURRENT_USERNAME:$CURRENT_USERNAME $(pwd)"
fi

info "File permissions: checked"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=============================================="
echo -e "  ${GREEN}Initialization Complete${NC}"
echo "=============================================="
echo ""
echo "Status:"
echo "  - Git branch: main"
echo "  - Environment: .env present"
echo "  - Scripts: executable"
echo ""
echo "Next steps:"
echo "  1. Start services:"
echo "     docker compose -f docker-compose.budget.yml -f docker-compose.budget.observability.yml up -d"
echo ""
echo "  2. After first start, verify SEO volume:"
echo "     docker exec geetanjali-backend ls -la /app/seo-output"
echo ""
echo "  3. If SEO permission issues, fix with:"
echo "     docker exec -u root geetanjali-backend chown -R appuser:appuser /app/seo-output"
echo ""
echo "  4. If migrating data, force regenerate SEO pages (hashes exist but files don't):"
echo "     docker exec geetanjali-backend sh -c 'curl -X POST -H \"X-API-Key: \$API_KEY\" \"http://localhost:8000/api/v1/admin/seo/generate?force=true\"'"
echo ""
echo "  5. Setup cron jobs:"
echo "     ./scripts/setup-crons.sh"
echo ""
echo "  6. Get SSL certificates (see docs/deployment.md)"
echo ""
