#!/bin/bash
# Geetanjali Production Deployment Script
# Usage: ./scripts/deploy.sh
#
# Required environment variables (set in .env.local or export manually):
#   DEPLOY_HOST     - SSH host (e.g., user@host or alias from ~/.ssh/config)
#   DEPLOY_DIR      - Remote app directory
#   DEPLOY_AGE_KEY  - Path to age private key on remote server
#
# Optional:
#   DEPLOY_COMPOSE_FILES - Space-separated compose files (default: "docker-compose.yml")
#                          For budget: "docker-compose.budget.yml docker-compose.budget.observability.yml"

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
COMPOSE_FILES="${DEPLOY_COMPOSE_FILES:-docker-compose.yml}"
COMPOSE_CMD="docker compose -f ${COMPOSE_FILES// / -f }"

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

# Step 1b: Refuse while a build or stop runs on the server (an interrupted deploy leaves it running,
# and a hand-run build counts too): a second build beside it exhausts the droplet.
BUILD_RUNNING="pgrep -af '[c]ompose( .*)? ((--)?build|stop)( |$)|[b]uildx'"
$SSH_CMD "$BUILD_RUNNING" && error "A build or stop is already running on the server (above). Redeploy once it exits"

# Step 2: Push local changes
log "Pushing to origin..."
git push origin main || error "Failed to push to origin"

# Step 3: Pull on remote (including LFS files like audio)
# --tags is load-bearing: remote.origin.fetch is refs/heads/* only, and `git pull origin main`
# with an explicit refspec does not reliably auto-follow tags. Without it the server's newest tag
# stayed at v1.39.0 through the v1.40.0 and v1.41.0 deploys, so Step 5b below described a stale
# tag and the container reported a version it was not running.
log "Pulling changes on server..."
$SSH_CMD "cd ${DEPLOY_DIR} && git pull --tags origin main && git lfs pull" || error "Failed to pull on server"

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

# Step 5: Tag the images the containers run for rollback (before rebuild). Not :latest: a deploy
# whose build failed partway has already moved some of those tags.
log "Tagging current images for rollback..."
$SSH_CMD "cd ${DEPLOY_DIR} && \
    docker tag \$(docker inspect -f '{{.Image}}' geetanjali-backend 2>/dev/null) geetanjali-backend:rollback 2>/dev/null || true && \
    docker tag \$(docker inspect -f '{{.Image}}' geetanjali-frontend 2>/dev/null) geetanjali-frontend:rollback 2>/dev/null || true && \
    docker tag \$(docker inspect -f '{{.Image}}' geetanjali-chromadb 2>/dev/null) geetanjali-chromadb:rollback 2>/dev/null || true && \
    docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' geetanjali-backend 2>/dev/null \
        | sed -n 's/^APP_VERSION=//p' > .rollback-version || true"

# Step 5b: Get version from git tag (single source of truth)
log "Determining app version from git tag..."
APP_VERSION=$($SSH_CMD "cd ${DEPLOY_DIR} && git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo '1.5.0'")
info "Deploying version: ${APP_VERSION}"

# Step 6: Build one image at a time, then restart. The droplet cannot build images in parallel:
# a base-image change rebuilds apt and torch, and side by side they exhaust RAM and swap and take
# the live site down. So:
# - worker shares the backend image tag and is never built on its own
# - a service with a build section must be in BUILD_ORDER or SHARES_IMAGE (checked below):
#   `up -d --no-build` would run it on a stale image
# - for a heavy build, worker and observability stop; `up -d` or any exit before it starts them
#   again, unless a build or the stop is still running there (an interrupt or a dropped ssh
#   leaves it running)
log "Rebuilding containers one image at a time..."
info "Using compose files: ${COMPOSE_FILES}"
BUILD_ORDER="chromadb backend frontend"
SHARES_IMAGE="worker"
PAUSE_FOR_BUILD="worker grafana prometheus node-exporter"
CONFIG=$($SSH_CMD "cd ${DEPLOY_DIR} && ${COMPOSE_CMD} config --no-interpolate") || error "Could not read the compose config"
for s in $(awk '/^  [^ ]+:$/ {s = substr($1, 1, length($1) - 1)} /^    build:$/ {print s}' <<< "$CONFIG"); do
    [[ " ${BUILD_ORDER} ${SHARES_IMAGE} " == *" ${s} "* ]] || error "${s} has a build section but is not in BUILD_ORDER"
done
SERVICES=$($SSH_CMD "cd ${DEPLOY_DIR} && ${COMPOSE_CMD} config --services") || error "Could not list compose services"
# Pause only for a heavy build: a change since the deployed release to a file that sets an
# expensive layer. Base images are pinned by digest, so a new base is a Dockerfile change too.
# Heavy too: an unknown deployed release, a failed check, or a release over 6 days old (the daily
# `docker builder prune --filter until=168h` drops build cache unused for 7 days).
# DEPLOY_PAUSE=always|never overrides.
LIGHT_WHY="no heavy input changed"
HEAVY_INPUTS="backend/Dockerfile backend/requirements.txt chromadb frontend/Dockerfile frontend/package.json frontend/package-lock.json .env.enc"
case "${DEPLOY_PAUSE:-auto}" in
    always) HEAVY="DEPLOY_PAUSE=always" ;;
    never) HEAVY="" LIGHT_WHY="DEPLOY_PAUSE=never" ;;
    auto)
        HEAVY=$($SSH_CMD "cd ${DEPLOY_DIR} || exit 1; prev=\$(cat .rollback-version 2>/dev/null); \
            if [ -z \"\$prev\" ] || ! git rev-parse -q --verify \"v\$prev^{commit}\" > /dev/null; then \
                echo 'deployed release unknown'; \
            elif [ \$(( \$(date +%s) - \$(git log -1 --format=%ct \"v\$prev\") )) -ge 518400 ]; then \
                echo \"v\$prev is over 6 days old, past the 7-day build cache prune\"; \
            else \
                git diff --name-only \"v\$prev\" HEAD -- ${HEAVY_INPUTS} || echo 'git diff failed'; \
            fi") \
            || HEAVY="could not compare with the deployed release"
        ;;
    *) error "DEPLOY_PAUSE must be auto, always or never" ;;
esac
PAUSED=""
if [[ -n "$HEAVY" ]]; then
    info "Heavy build: ${HEAVY//$'\n'/ }"
    for s in $PAUSE_FOR_BUILD; do grep -qx "$s" <<< "$SERVICES" && PAUSED="${PAUSED} ${s}"; done
else
    info "Light build (${LIGHT_WHY}): worker and observability keep running"
fi
START_PAUSED="cd ${DEPLOY_DIR} && ${COMPOSE_CMD} start${PAUSED}"
restart_paused() {
    if [[ -z "$PAUSED" ]]; then
        return 0
    elif $SSH_CMD "$BUILD_RUNNING" > /dev/null; then
        warn "A build or stop is still running on the server. Once it exits, run there: ${START_PAUSED}"
    else
        $SSH_CMD "$START_PAUSED" || warn "Could not restart${PAUSED}. Once no build or stop is running on the server, run there: ${START_PAUSED}"
    fi
}
trap restart_paused EXIT
trap 'exit 130' INT TERM HUP
if [[ -n "$PAUSED" ]]; then
    log "Stopping${PAUSED} for the build..."
    # 120s: the worker finishes its current job on SIGTERM (an LLM call plus one re-ask, 45s each);
    # docker's default 10s cuts it off
    $SSH_CMD "cd ${DEPLOY_DIR} && ${COMPOSE_CMD} stop --timeout 120${PAUSED}" || error "Could not stop${PAUSED}"
fi
for s in $BUILD_ORDER; do
    grep -qx "$s" <<< "$SERVICES" || continue
    log "Building ${s}..."
    $SSH_CMD "cd ${DEPLOY_DIR} && APP_VERSION=${APP_VERSION} ${COMPOSE_CMD} build ${s}" \
        || error "Build of ${s} failed; containers still running the previous release"
done

# Step 6b: Test the new nginx config before replacing the running frontend. `run` mounts the
# same certificates and joins the same network, so upstream names resolve as they will live.
# A config that fails here would otherwise crash-loop 80/443 while this script reports success.
log "Testing nginx config in the new frontend image..."
$SSH_CMD "cd ${DEPLOY_DIR} && ${COMPOSE_CMD} run --rm --no-deps --entrypoint nginx frontend -t" \
    || error "nginx -t failed; containers still running the previous release. Fix nginx.conf and redeploy"

$SSH_CMD "cd ${DEPLOY_DIR} && APP_VERSION=${APP_VERSION} ${COMPOSE_CMD} up -d --no-build" || error "Failed to restart containers"
trap - EXIT INT TERM HUP

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

# Step 8: Ensure SEO volume ownership (first deploy fix)
# Docker creates volumes as root; backend runs as appuser (uid 1000)
log "Ensuring SEO volume permissions..."
$SSH_CMD "docker exec -u root geetanjali-backend chown -R appuser:appuser /app/seo-output 2>/dev/null" || warn "Could not fix SEO permissions (may already be correct)"

# Step 9: Trigger SEO page generation via admin API
# Pages are shared via Docker volume (seo_output) between backend and nginx
# Auth: Uses API_KEY from container environment (defense in depth)
#
# Force regeneration if SEO files are missing (e.g., after migration where
# seo_pages table was migrated but actual files weren't). Check if verses/
# directory exists and has files - if not, force regenerate all pages.
log "Checking SEO files..."
SEO_FILE_COUNT=$($SSH_CMD "docker exec geetanjali-backend sh -c 'ls /app/seo-output/verses/*.html 2>/dev/null | wc -l'" 2>/dev/null || echo "0")
if [[ "${SEO_FILE_COUNT}" -lt 100 ]]; then
    info "SEO files missing or incomplete (${SEO_FILE_COUNT} verses found). Force regenerating..."
    SEO_FORCE="?force=true"
else
    info "SEO files present (${SEO_FILE_COUNT} verses). Using hash-based detection."
    SEO_FORCE=""
fi

log "Triggering SEO generation..."
SEO_RESULT=$($SSH_CMD "docker exec geetanjali-backend sh -c 'curl -s -f -X POST -H \"X-API-Key: \$API_KEY\" \"http://localhost:8000/api/v1/admin/seo/generate${SEO_FORCE}\"'" 2>&1) || warn "SEO generation failed (non-blocking)"
if [[ -n "$SEO_RESULT" ]]; then
    info "SEO: $SEO_RESULT"
fi

# Step 9b: Verify what people and crawlers actually get. The backend health poll above says
# nothing about nginx: a bad route, a 404 rewritten to 200, or a stale crawler page all pass it.
log "Checking the public site..."
SITE_URL="${SITE_URL:-https://geetanjaliapp.com}"
GOOGLEBOT="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
curl -sf "${SITE_URL}/daily" | grep -q 'id="root"' \
    || error "/daily did not serve the app to a browser. Roll back with: make rollback"
# `|| true`: under set -e a grep that matches nothing would end the script here, silently,
# before the explicit error below can say what failed.
API_DAILY=$(curl -sf "${SITE_URL}/api/v1/verses/daily" | grep -oE '"canonical_id": *"BG_[0-9]+_[0-9]+"' | grep -oE 'BG_[0-9]+_[0-9]+' || true)
BOT_DAILY=$(curl -sf -A "${GOOGLEBOT}" "${SITE_URL}/daily" | grep -oE '/verses/BG_[0-9]+_[0-9]+' | head -1 | sed 's#/verses/##' || true)
[[ -n "$API_DAILY" && "$BOT_DAILY" == "$API_DAILY" ]] \
    || error "Crawler /daily shows ${BOT_DAILY:-nothing}, API says ${API_DAILY:-nothing}. Check SEO generation above"
MISSING_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}/assets/deploy-check-missing.js")
[[ "$MISSING_STATUS" == "404" ]] \
    || error "Missing asset returned ${MISSING_STATUS}, not 404. Check error_page in nginx.conf"
info "Public site: app on /daily, crawler /daily = ${API_DAILY}, missing asset 404"

# Step 10: Verify deployment
log "Service status:"
$SSH_CMD "cd ${DEPLOY_DIR} && ${COMPOSE_CMD} ps --format 'table {{.Names}}\t{{.Status}}'"

# Step 11: Health check (via docker exec since port not exposed)
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
