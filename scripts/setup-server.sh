#!/bin/bash
# Geetanjali Production Server Setup Script
# Usage: ./scripts/setup-server.sh
#
# Run this ONCE on a fresh server before first deployment.
# Installs system dependencies and prepares the environment.
#
# Prerequisites:
#   - Ubuntu 22.04+ / Debian 12+
#   - Root or sudo access
#   - SSH access configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    SUDO="sudo"
else
    SUDO=""
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)  ARCH_SUFFIX="amd64" ;;
    aarch64) ARCH_SUFFIX="arm64" ;;
    *)       error "Unsupported architecture: $ARCH" ;;
esac

echo ""
echo "=========================================="
echo "  Geetanjali Server Setup"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# System Dependencies
# -----------------------------------------------------------------------------

log "Updating package lists..."
$SUDO apt-get update -qq

log "Installing system dependencies..."
$SUDO apt-get install -y -qq \
    curl \
    git \
    git-lfs \
    openssl \
    fail2ban \
    unattended-upgrades

# -----------------------------------------------------------------------------
# Git LFS
# -----------------------------------------------------------------------------

log "Configuring Git LFS..."
git lfs install --system

# -----------------------------------------------------------------------------
# Docker (if not installed)
# -----------------------------------------------------------------------------

if ! command -v docker &> /dev/null; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | $SUDO sh

    # Add current user to docker group
    if [[ -n "$SUDO_USER" ]]; then
        $SUDO usermod -aG docker "$SUDO_USER"
        log "Added $SUDO_USER to docker group (re-login required)"
    fi
else
    log "Docker already installed: $(docker --version)"
fi

# -----------------------------------------------------------------------------
# Docker Compose (if not installed)
# -----------------------------------------------------------------------------

if ! docker compose version &> /dev/null; then
    log "Installing Docker Compose plugin..."
    $SUDO apt-get install -y -qq docker-compose-plugin
else
    log "Docker Compose already installed: $(docker compose version)"
fi

# -----------------------------------------------------------------------------
# SOPS (for secrets management)
# -----------------------------------------------------------------------------

if ! command -v sops &> /dev/null; then
    log "Installing SOPS..."
    SOPS_VERSION="3.8.1"
    # SHA256 checksums from https://github.com/getsops/sops/releases/tag/v3.8.1
    if [[ "$ARCH_SUFFIX" == "amd64" ]]; then
        SOPS_SHA256="d6bf07fb61972127c9e0d622523124c2d81caf9f7971fb123228961021811697"
    else
        SOPS_SHA256="47b1490ac28cc2e2c400d72e5eb0641e46f3a0f0efeab8714e22ee4f6e4603b0"
    fi
    curl -fsSL "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.${ARCH_SUFFIX}" \
        -o /tmp/sops
    echo "${SOPS_SHA256}  /tmp/sops" | sha256sum -c - || error "SOPS checksum verification failed"
    $SUDO mv /tmp/sops /usr/local/bin/sops
    $SUDO chmod +x /usr/local/bin/sops
else
    log "SOPS already installed: $(sops --version)"
fi

# -----------------------------------------------------------------------------
# age (for SOPS encryption)
# -----------------------------------------------------------------------------

if ! command -v age &> /dev/null; then
    log "Installing age..."
    AGE_VERSION="1.1.1"
    # SHA256 checksums from https://github.com/FiloSottile/age/releases/tag/v1.1.1
    if [[ "$ARCH_SUFFIX" == "amd64" ]]; then
        AGE_SHA256="2143c815f52ca04e2a96ecde47f6e7f08ab11a8693e0bbdb39c77b040fa2f925"
    else
        AGE_SHA256="77c5b6e0e4188be7e76d8f986b7cef03d558fed03de6fc4ad3d8f9d96f93f9e6"
    fi
    curl -fsSL "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-${ARCH_SUFFIX}.tar.gz" \
        -o /tmp/age.tar.gz
    echo "${AGE_SHA256}  /tmp/age.tar.gz" | sha256sum -c - || error "age checksum verification failed"
    tar -xzf /tmp/age.tar.gz -C /tmp
    $SUDO mv /tmp/age/age /usr/local/bin/
    $SUDO mv /tmp/age/age-keygen /usr/local/bin/
    rm -rf /tmp/age /tmp/age.tar.gz
else
    log "age already installed: $(age --version)"
fi

# -----------------------------------------------------------------------------
# Create app directory
# -----------------------------------------------------------------------------

APP_DIR="${DEPLOY_DIR:-/opt/geetanjali}"
BACKUP_DIR="${DEPLOY_BACKUP_DIR:-/opt/backups/geetanjali}"
LOG_DIR="/var/log/geetanjali"

log "Creating directories..."
$SUDO mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"

# Set ownership to current user (or SUDO_USER if running with sudo)
OWNER="${SUDO_USER:-$USER}"
$SUDO chown -R "$OWNER:$OWNER" "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "=========================================="
log "${GREEN}Server setup complete!${NC}"
echo "=========================================="
echo ""
echo "Installed:"
echo "  - git-lfs $(git lfs version | head -1)"
echo "  - docker $(docker --version)"
echo "  - docker compose $(docker compose version)"
echo "  - sops $(sops --version 2>&1 | head -1)"
echo "  - age $(age --version)"
echo ""
echo "Directories created:"
echo "  - App:     $APP_DIR"
echo "  - Backups: $BACKUP_DIR"
echo "  - Logs:    $LOG_DIR"
echo ""
echo "Next steps:"
echo "  1. Clone the repo:  git clone <repo-url> $APP_DIR"
echo "  2. Pull LFS files:  cd $APP_DIR && git lfs pull"
echo "  3. Add age key:     Copy age private key to server"
echo "  4. First deploy:    make deploy"
echo ""
