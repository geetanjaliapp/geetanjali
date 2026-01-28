#!/bin/bash
# Geetanjali Budget Server Setup Script (Debian 12)
# Usage: Run as root on fresh Debian 12 server
#   curl -fsSL https://raw.githubusercontent.com/geetanjaliapp/geetanjali/main/scripts/setup-server-debian.sh | sudo bash
#
# Creates:
#   - gitam user with sudo access (for all operations)
#   - Docker + Docker Compose
#   - Git + Git LFS
#   - SOPS + age (for secrets)
#   - fail2ban + unattended-upgrades (security)
#   - /opt/geetanjali directory (owned by gitam)
#   - /opt/backups/geetanjali directory (for DB backups)
#   - /var/log/geetanjali directory (for logs)

set -euo pipefail

# Configuration
APP_USER="gitam"
APP_DIR="/opt/geetanjali"
BACKUP_DIR="/opt/backups/geetanjali"
LOG_DIR="/var/log/geetanjali"
# Version pinning: These are the tested versions with verified checksums.
# Update checksums if upgrading versions. Check releases at:
#   - https://github.com/getsops/sops/releases
#   - https://github.com/FiloSottile/age/releases
SOPS_VERSION="3.8.1"
AGE_VERSION="1.1.1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
fi

# Check Debian version
if ! grep -q "Debian" /etc/os-release 2>/dev/null; then
    warn "This script is designed for Debian. Detected OS:"
    cat /etc/os-release | head -3
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)  ARCH_SUFFIX="amd64" ;;
    aarch64) ARCH_SUFFIX="arm64" ;;
    *)       error "Unsupported architecture: $ARCH" ;;
esac

echo ""
echo "=============================================="
echo "  Geetanjali Budget Server Setup (Debian 12)"
echo "=============================================="
echo ""
info "Architecture: $ARCH ($ARCH_SUFFIX)"
info "User to create: $APP_USER"
info "App directory: $APP_DIR"
echo ""

# =============================================================================
# Create Application User
# =============================================================================

log "Creating application user: $APP_USER"
if id "$APP_USER" &>/dev/null; then
    warn "User $APP_USER already exists"
else
    useradd -m -s /bin/bash "$APP_USER"
    log "Created user $APP_USER"
fi

# Add to sudo group
usermod -aG sudo "$APP_USER"
log "Added $APP_USER to sudo group"

# Setup passwordless sudo for deploy commands (restricted)
cat > /etc/sudoers.d/$APP_USER <<EOF
# Geetanjali deployment user
# Restricted to Docker and specific systemctl commands (not full systemctl access)
$APP_USER ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart docker
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl status docker
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl start docker
$APP_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop docker
EOF
chmod 440 /etc/sudoers.d/$APP_USER
log "Configured sudo access"

# Copy SSH authorized_keys from root to gitam
if [[ -f /root/.ssh/authorized_keys ]]; then
    mkdir -p /home/$APP_USER/.ssh
    cp /root/.ssh/authorized_keys /home/$APP_USER/.ssh/
    chown -R $APP_USER:$APP_USER /home/$APP_USER/.ssh
    chmod 700 /home/$APP_USER/.ssh
    chmod 600 /home/$APP_USER/.ssh/authorized_keys
    log "Copied SSH authorized_keys to $APP_USER"
fi

# =============================================================================
# System Updates & Dependencies
# =============================================================================

log "Updating package lists..."
apt-get update -qq

log "Installing system dependencies..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    git-lfs \
    openssl \
    fail2ban \
    unattended-upgrades \
    apt-listchanges \
    ca-certificates \
    gnupg \
    ufw \
    auditd

# Configure unattended-upgrades
log "Configuring automatic security updates..."
cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# =============================================================================
# Git LFS
# =============================================================================

log "Configuring Git LFS..."
git lfs install --system

# =============================================================================
# Docker
# =============================================================================

if ! command -v docker &> /dev/null; then
    log "Installing Docker..."

    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Configure Docker daemon log rotation (prevents disk fill)
    log "Configuring Docker log rotation..."
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json <<DOCKEREOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DOCKEREOF

    # Start Docker
    systemctl enable docker
    systemctl start docker

    log "Docker installed successfully"
else
    log "Docker already installed: $(docker --version)"
fi

# Add gitam to docker group
usermod -aG docker "$APP_USER"
log "Added $APP_USER to docker group"

# =============================================================================
# SOPS
# =============================================================================

if ! command -v sops &> /dev/null; then
    log "Installing SOPS v${SOPS_VERSION}..."

    # SHA256 checksums from official release
    if [[ "$ARCH_SUFFIX" == "amd64" ]]; then
        SOPS_SHA256="d6bf07fb61972127c9e0d622523124c2d81caf9f7971fb123228961021811697"
    else
        SOPS_SHA256="47b1490ac28cc2e2c400d72e5eb0641e46f3a0f0efeab8714e22ee4f6e4603b0"
    fi

    curl -fsSL "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.${ARCH_SUFFIX}" \
        -o /tmp/sops
    echo "${SOPS_SHA256}  /tmp/sops" | sha256sum -c - || error "SOPS checksum verification failed"
    mv /tmp/sops /usr/local/bin/sops
    chmod +x /usr/local/bin/sops
    log "SOPS installed"
else
    log "SOPS already installed: $(sops --version 2>&1 | head -1)"
fi

# =============================================================================
# age
# =============================================================================

if ! command -v age &> /dev/null; then
    log "Installing age v${AGE_VERSION}..."

    # SHA256 checksums from official release
    if [[ "$ARCH_SUFFIX" == "amd64" ]]; then
        AGE_SHA256="2143c815f52ca04e2a96ecde47f6e7f08ab11a8693e0bbdb39c77b040fa2f925"
    else
        AGE_SHA256="77c5b6e0e4188be7e76d8f986b7cef03d558fed03de6fc4ad3d8f9d96f93f9e6"
    fi

    curl -fsSL "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-${ARCH_SUFFIX}.tar.gz" \
        -o /tmp/age.tar.gz
    echo "${AGE_SHA256}  /tmp/age.tar.gz" | sha256sum -c - || error "age checksum verification failed"
    tar -xzf /tmp/age.tar.gz -C /tmp
    mv /tmp/age/age /usr/local/bin/
    mv /tmp/age/age-keygen /usr/local/bin/
    rm -rf /tmp/age /tmp/age.tar.gz
    log "age installed"
else
    log "age already installed: $(age --version)"
fi

# =============================================================================
# Create Directories
# =============================================================================

log "Creating application directories..."

mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
chown -R $APP_USER:$APP_USER "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"

# Create SOPS config directory for gitam
mkdir -p /home/$APP_USER/.config/sops/age
chown -R $APP_USER:$APP_USER /home/$APP_USER/.config

log "Directories created"

# =============================================================================
# Fail2ban Configuration
# =============================================================================

log "Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# =============================================================================
# SSH Hardening
# =============================================================================

log "Hardening SSH configuration..."
# Restrict root login to key-only (prohibit-password allows emergency access)
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
# Ensure password auth is disabled (key-only)
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
log "SSH hardened: root=prohibit-password, password-auth=disabled"

# =============================================================================
# UFW Firewall
# =============================================================================

log "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
echo "y" | ufw enable
log "UFW enabled: only 22, 80, 443 allowed"

# =============================================================================
# Kernel Security Parameters
# =============================================================================

log "Configuring kernel security parameters..."
cat > /etc/sysctl.d/99-security.conf <<EOF
# Security hardening
# Enable reverse path filtering (prevent IP spoofing)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# Enable SYN flood protection
net.ipv4.tcp_syncookies = 1

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
EOF
sysctl -p /etc/sysctl.d/99-security.conf
log "Kernel security parameters configured"

# =============================================================================
# Auditd Configuration
# =============================================================================

log "Configuring auditd..."
cat > /etc/audit/rules.d/security.rules <<EOF
# Log all commands run as root
-a always,exit -F arch=b64 -F euid=0 -S execve -k root_commands

# Log changes to passwd/shadow
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity

# Log SSH config changes
-w /etc/ssh/sshd_config -p wa -k sshd_config

# Log Docker config changes
-w /etc/docker/daemon.json -p wa -k docker_config

# Log sudoers changes
-w /etc/sudoers -p wa -k sudoers
-w /etc/sudoers.d/ -p wa -k sudoers
EOF
systemctl enable auditd
systemctl restart auditd
log "Auditd configured with security rules"

# =============================================================================
# SSL Certificate Group (for Docker container access)
# =============================================================================

log "Creating SSL certificate group..."
# Create ssl-docker group with GID 1002 (matches docker-compose.budget.yml group_add)
groupadd -g 1002 ssl-docker 2>/dev/null || log "ssl-docker group already exists"
log "ssl-docker group created (GID 1002) for container SSL access"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=============================================="
echo -e "  ${GREEN}Server Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "Installed:"
echo "  - User:          $APP_USER (with sudo + docker access)"
echo "  - Docker:        $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  - Compose:       $(docker compose version | cut -d' ' -f4)"
echo "  - Git LFS:       $(git lfs version | head -1 | cut -d' ' -f1)"
echo "  - SOPS:          $(sops --version 2>&1 | head -1)"
echo "  - age:           $(age --version)"
echo "  - fail2ban:      active"
echo "  - auto-upgrades: enabled"
echo ""
echo "Security Hardening:"
echo "  - SSH:           root=prohibit-password, password-auth=disabled"
echo "  - UFW:           enabled (22, 80, 443 only)"
echo "  - Kernel:        rp_filter, syncookies, no redirects"
echo "  - Auditd:        logging root commands, identity changes"
echo "  - SSL group:     ssl-docker (GID 1002) for cert access"
echo ""
echo "Directories:"
echo "  - App:     $APP_DIR (owned by $APP_USER)"
echo "  - Backups: $BACKUP_DIR"
echo "  - Logs:    $LOG_DIR"
echo ""
echo "Next steps:"
echo "  1. SSH as $APP_USER:    ssh $APP_USER@<server-ip>"
echo "  2. Copy age key:        (see phase-B-provision.md)"
echo "  3. Clone repo:          cd $APP_DIR && git clone <repo> ."
echo "  4. Configure swap:      sudo ./scripts/setup-swap.sh"
echo "  5. Decrypt secrets:     sops -d .env.enc > .env"
echo "  6. Start services:      docker compose -f docker-compose.budget.yml up -d"
echo ""
warn "Remember: Use $APP_USER for all operations, root only for emergencies!"
echo ""
