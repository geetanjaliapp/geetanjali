---
layout: default
title: Security
description: Container hardening, secrets management, network security, and threat model for Geetanjali.
---

# Security Hardening Guide

This document describes the security measures implemented for the Geetanjali application infrastructure.

## Table of Contents

1. [Server-Level Security](#server-level-security)
2. [Docker Container Security](#docker-container-security)
3. [Network Security](#network-security)
4. [Application Security](#application-security)
5. [Secrets Management (SOPS + age)](#secrets-management-sops--age)
6. [Security Checklist](#security-checklist)
7. [Incident Response](#incident-response)

---

## Server-Level Security

### SSH Hardening

SSH is configured for key-based authentication only:

```bash
# /etc/ssh/sshd_config settings
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
```

**Best practices:**
- Use SSH keys with Ed25519 or RSA 4096-bit
- Disable password authentication
- Use non-root user for regular operations
- Keep root access for system administration only

### Firewall (UFW)

UFW is configured to allow only essential ports:

```bash
# View current rules
sudo ufw status verbose

# Expected configuration:
# 22/tcp    - SSH
# 80/tcp    - HTTP (redirects to HTTPS)
# 443/tcp   - HTTPS
```

All other ports are blocked. Docker services communicate internally via Docker network.

### Fail2ban

Fail2ban protects against brute-force attacks:

```bash
# Configuration: /etc/fail2ban/jail.local
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
findtime = 10m
```

**Commands:**
```bash
# Check status
sudo fail2ban-client status sshd

# View banned IPs
sudo fail2ban-client status sshd | grep "Banned IP"

# Unban an IP
sudo fail2ban-client set sshd unbanip <IP>
```

### Audit Logging (auditd)

Auditd provides kernel-level audit logging:

```bash
# Check status
sudo systemctl status auditd

# View audit logs
sudo ausearch -ts today

# View login attempts
sudo ausearch -m USER_LOGIN
```

---

## Docker Container Security

### Linux Capabilities

Linux capabilities break down root privileges into ~40 distinct powers. We drop all capabilities except those explicitly needed:

| Capability | Description | Containers Using |
|------------|-------------|------------------|
| NET_BIND_SERVICE | Bind to ports < 1024 | Frontend (nginx) |
| CHOWN | Change file ownership | Redis, Frontend |
| SETUID | Set user ID | Redis, Frontend |
| SETGID | Set group ID | Redis, Frontend |

**Configuration in docker-compose.yml:**
```yaml
services:
  redis:
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

### Container-Specific Hardening

| Container | Runs As | Capabilities | Extra Hardening |
|-----------|---------|--------------|-----------------|
| postgres | postgres (non-root) | no-new-privileges | - |
| redis | redis (non-root) | SETUID, SETGID, CHOWN only | - |
| chromadb | chromauser (uid 1000) | cap_drop: ALL | - |
| backend | appuser (uid 1000) | cap_drop: ALL | - |
| worker | appuser (uid 1000) | cap_drop: ALL | - |
| frontend | nginx (workers) | NET_BIND_SERVICE, SETUID, SETGID, CHOWN | - |
| ollama | default | no-new-privileges | - |

### no-new-privileges

The `no-new-privileges` security option prevents processes from gaining additional privileges through setuid binaries. This means even if an attacker exploits a vulnerability, they cannot escalate privileges.

### Read-Only Filesystems

Redis runs with a read-only root filesystem (`read_only: true`), with only a tmpfs mount for `/tmp`. This prevents attackers from writing malicious files even if they gain access.

### Docker Log Rotation

Docker is configured to prevent log files from consuming disk space:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

---

## Network Security

### Internal Docker Network

All services communicate via an internal Docker bridge network (`geetanjali-network`). External ports are exposed only for:
- Port 80/443 (frontend nginx)

**No external port exposure for:**
- PostgreSQL (5432)
- Redis (6379)
- ChromaDB (8000)
- Backend API (8000)
- Ollama (11434)

### Redis Authentication

Redis requires password authentication:

```bash
# Connection string format
redis://:${REDIS_PASSWORD}@redis:6379/0
```

### Local Development

For local development, use `docker-compose.override.yml` to expose ports to localhost only:

```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"
```

**Important:** Never commit `docker-compose.override.yml` (it's in .gitignore).

---

## Application Security

### Environment Variables

Sensitive values are stored in `.env` (git-ignored):
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `API_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`

### API Security

- **Rate Limiting**: `/api/v1/analyze` is rate-limited to 10 requests/hour per IP
- **JWT Authentication**: User sessions use JWT tokens with configurable expiration
- **CORS**: Configured for specific allowed origins
- **Security Headers**: nginx adds X-Frame-Options, X-Content-Type-Options, etc.

### Cookie Security

In production, enable secure cookies:
```bash
COOKIE_SECURE=true  # Requires HTTPS
```

---

## Secrets Management (SOPS + age)

Production secrets are encrypted using [SOPS](https://github.com/getsops/sops) with [age](https://age-encryption.org/) encryption. This allows secrets to be safely committed to git while remaining encrypted.

### How It Works

1. **`.env.enc`** - Encrypted secrets file (safe to commit to git)
2. **`.sops.yaml`** - SOPS configuration with public key
3. **`~/.config/sops/age/keys.txt`** - Private key (never commit!)

The deploy script automatically decrypts `.env.enc` to `.env` on the server during deployment.

### Quick Reference

```bash
# View decrypted secrets (for debugging)
make secrets-view

# Edit encrypted secrets (opens in vim)
make secrets-edit

# Re-encrypt after editing .env.prod.backup
make secrets-encrypt
```

### Editing Secrets

**Option 1: Direct Edit (Recommended)**
```bash
make secrets-edit
# Opens encrypted file in vim, saves encrypted
```

**Option 2: Manual Workflow**
```bash
# 1. Decrypt to temporary file
sops --decrypt --input-type dotenv --output-type dotenv .env.enc > .env.tmp

# 2. Edit the file
vim .env.tmp

# 3. Re-encrypt
sops --encrypt --input-type dotenv --output-type dotenv --output .env.enc .env.tmp

# 4. Clean up and commit
rm .env.tmp
git add .env.enc && git commit -m "chore: update secrets"
```

### Key Locations

| Location | Purpose |
|----------|---------|
| Local: `~/.config/sops/age/keys.txt` | Private key for encryption/decryption |
| Server: `~/.config/sops/age/keys.txt` | Private key for decryption |
| Repo: `.env.enc` | Encrypted secrets (safe to commit) |
| Repo: `.sops.yaml` | SOPS config with public key |

### Emergency: Lost Private Key

If the private key is lost, you'll need to:
1. Generate a new key pair: `age-keygen -o ~/.config/sops/age/keys.txt`
2. Update `.sops.yaml` with the new public key
3. Re-encrypt all secrets from the plaintext backup
4. Copy new private key to server

**Important:** Keep a secure backup of the private key outside of git!

### Adding a New Secret

1. Run `make secrets-edit`
2. Add the new key=value line
3. Save and quit (:wq)
4. Commit: `git add .env.enc && git commit -m "chore: add NEW_SECRET"`
5. Deploy: `make deploy`

---

## Security Checklist

### Pre-Deployment

- [ ] Generate secure secrets (32+ random bytes):
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] Set strong passwords for POSTGRES_PASSWORD, REDIS_PASSWORD
- [ ] Set JWT_SECRET and API_KEY to generated values
- [ ] Configure ANTHROPIC_API_KEY if using Claude
- [ ] Set APP_ENV=production, DEBUG=false
- [ ] Set COOKIE_SECURE=true
- [ ] Configure CORS_ORIGINS with your domain(s)

### Server Setup

- [ ] SSH key-based auth only (PasswordAuthentication no)
- [ ] UFW enabled with only ports 22, 80, 443
- [ ] fail2ban installed and configured
- [ ] auditd installed for audit logging
- [ ] Docker log rotation configured
- [ ] Non-root user for regular operations

### Docker Deployment

- [ ] No sensitive ports exposed externally
- [ ] cap_drop: ALL on containers that don't need capabilities
- [ ] no-new-privileges:true on all containers
- [ ] Non-root users in custom Dockerfiles
- [ ] .env file not committed to git
- [ ] Secrets encrypted with SOPS (.env.enc)
- [ ] Private key backed up securely (not in git)

---

## Incident Response

### If You Suspect a Breach

1. **Isolate**: Take the affected service offline
   ```bash
   docker compose stop <service>
   ```

2. **Preserve Evidence**: Copy logs before making changes
   ```bash
   docker logs geetanjali-<service> > /tmp/<service>-logs.txt 2>&1
   ```

3. **Check Audit Logs**:
   ```bash
   sudo ausearch -ts <timestamp>
   sudo journalctl -u docker --since "1 hour ago"
   ```

4. **Rotate Credentials**: Change all secrets
   - Database password
   - Redis password
   - JWT secret
   - API keys

5. **Review**: Check fail2ban logs for attack patterns
   ```bash
   sudo fail2ban-client status sshd
   ```

### Recreating Containers with Fresh State

If data may be compromised:

```bash
# Stop and remove container with its volumes
docker compose down <service>
docker volume rm geetanjali_<volume>

# Recreate
docker compose up -d <service>
```

---

## Updating Security Measures

### System Updates

```bash
# Update packages (run periodically)
sudo apt update && sudo apt upgrade -y

# Restart services if needed
sudo systemctl restart fail2ban
sudo systemctl restart auditd
```

### Docker Updates

```bash
# Rebuild containers with updated base images
docker compose build --no-cache
docker compose up -d
```

---

## References

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Linux Capabilities Manual](https://man7.org/linux/man-pages/man7/capabilities.7.html)
