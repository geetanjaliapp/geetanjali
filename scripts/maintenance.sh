#!/bin/bash
# Geetanjali Server Maintenance Script
# Runs via cron on the server for automated maintenance
#
# Required environment variables (set in crontab or wrapper script):
#   DEPLOY_DIR        - App directory
#   DEPLOY_BACKUP_DIR - Backup directory
#
# Installation:
#   1. Create wrapper script that sets env vars and calls this script
#   2. Add to crontab:
#      0 3 * * * /path/to/wrapper.sh daily >> /var/log/geetanjali-maintenance.log 2>&1
#      0 4 * * 0 /path/to/wrapper.sh weekly >> /var/log/geetanjali-maintenance.log 2>&1

set -e

# Validate required environment variables
if [[ -z "${DEPLOY_DIR}" ]] || [[ -z "${DEPLOY_BACKUP_DIR}" ]]; then
    echo "Error: DEPLOY_DIR and DEPLOY_BACKUP_DIR must be set"
    exit 1
fi

# Configuration
APP_DIR="${DEPLOY_DIR}"
BACKUP_DIR="${DEPLOY_BACKUP_DIR}"
ALERT_ENDPOINT="http://localhost:8000/api/v1/admin/alert"

# Thresholds
DISK_THRESHOLD=80
SSL_WARN_DAYS=14

# Load environment variables for alerts
if [[ -f "${APP_DIR}/.env" ]]; then
    export $(grep -E '^(RESEND_API_KEY|CONTACT_EMAIL_TO|API_KEY)=' "${APP_DIR}/.env" | xargs)
fi

# -----------------------------------------------------------------------------
# Utility Functions
# -----------------------------------------------------------------------------

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_alert() {
    local subject="$1"
    local message="$2"
    local alert_sent=false

    # Try backend alert endpoint first (requires API_KEY)
    if [[ -n "$API_KEY" ]]; then
        if curl -sf -X POST "${ALERT_ENDPOINT}" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d "{\"subject\": \"${subject}\", \"message\": \"${message}\"}" \
            2>/dev/null; then
            alert_sent=true
        fi
    fi

    # Fallback: use Resend API directly if configured
    if [[ "$alert_sent" != "true" ]] && [[ -n "$RESEND_API_KEY" && -n "$CONTACT_EMAIL_TO" ]]; then
        if curl -sf -X POST "https://api.resend.com/emails" \
            -H "Authorization: Bearer ${RESEND_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "{
                \"from\": \"Geetanjali Alerts <noreply@geetanjaliapp.com>\",
                \"to\": \"${CONTACT_EMAIL_TO}\",
                \"subject\": \"[Geetanjali] ${subject}\",
                \"text\": \"${message}\"
            }" 2>/dev/null; then
            alert_sent=true
        fi
    fi

    if [[ "$alert_sent" == "true" ]]; then
        log "ALERT SENT: ${subject}"
    else
        log "ALERT FAILED (no delivery method available): ${subject}"
    fi
}

# -----------------------------------------------------------------------------
# Daily Tasks
# -----------------------------------------------------------------------------

task_docker_cleanup() {
    log "Running Docker cleanup..."

    # Clean build cache
    docker builder prune -f --filter "until=24h" 2>/dev/null || true

    # Remove dangling images
    docker image prune -f 2>/dev/null || true

    # Remove unused volumes (be careful - only truly unused)
    # docker volume prune -f 2>/dev/null || true

    log "Docker cleanup complete"
}

task_database_backup() {
    log "Running database backup..."

    mkdir -p "${BACKUP_DIR}"

    BACKUP_FILE="${BACKUP_DIR}/geetanjali_$(date +%Y%m%d_%H%M%S).sql.gz"

    # Backup PostgreSQL
    docker exec geetanjali-postgres pg_dump -U geetanjali geetanjali | gzip > "${BACKUP_FILE}"

    if [[ -f "${BACKUP_FILE}" ]]; then
        log "Backup created: ${BACKUP_FILE}"

        # Keep only last 7 daily backups
        ls -t "${BACKUP_DIR}"/geetanjali_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
        log "Old backups cleaned (keeping last 7)"
    else
        send_alert "Backup Failed" "Database backup failed to create file"
    fi
}

task_ssl_check() {
    log "Checking SSL certificate expiry..."

    CERT_FILE="/etc/letsencrypt/live/geetanjaliapp.com/fullchain.pem"

    if [[ -f "${CERT_FILE}" ]]; then
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in "${CERT_FILE}" | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "${EXPIRY_DATE}" +%s)
        NOW_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

        log "SSL certificate expires in ${DAYS_LEFT} days"

        if [[ ${DAYS_LEFT} -lt ${SSL_WARN_DAYS} ]]; then
            send_alert "SSL Certificate Expiring" "SSL certificate expires in ${DAYS_LEFT} days. Renew immediately!\n\nRun: certbot renew"
        fi
    else
        log "SSL certificate file not found (may be using different path)"
    fi
}

task_disk_check() {
    log "Checking disk usage..."

    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

    log "Disk usage: ${DISK_USAGE}%"

    if [[ ${DISK_USAGE} -gt ${DISK_THRESHOLD} ]]; then
        DISK_INFO=$(df -h / | tail -1)
        send_alert "Disk Usage High" "Disk usage is at ${DISK_USAGE}% (threshold: ${DISK_THRESHOLD}%)\n\n${DISK_INFO}\n\nConsider running: docker system prune -a"
    fi
}

task_health_check() {
    log "Running health checks..."

    ISSUES=""

    # Check backend health (via Docker network since port isn't exposed externally)
    BACKEND_STATUS=$(docker exec geetanjali-backend curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health 2>/dev/null || echo "000")
    if [[ "${BACKEND_STATUS}" != "200" ]]; then
        ISSUES="${ISSUES}\n- Backend unhealthy (HTTP ${BACKEND_STATUS})"
    fi

    # Check all containers are running
    for container in geetanjali-backend geetanjali-frontend geetanjali-postgres geetanjali-redis geetanjali-chromadb geetanjali-ollama; do
        STATUS=$(docker inspect -f '{{.State.Status}}' "${container}" 2>/dev/null || echo "not_found")
        if [[ "${STATUS}" != "running" ]]; then
            ISSUES="${ISSUES}\n- Container ${container} is ${STATUS}"
        fi
    done

    # Check for containers that have restarted recently (potential crash loop)
    RESTART_COUNTS=$(docker inspect --format='{{.Name}}: {{.RestartCount}}' $(docker ps -q) 2>/dev/null | grep -v ": 0" || true)
    if [[ -n "${RESTART_COUNTS}" ]]; then
        ISSUES="${ISSUES}\n- Containers with restarts:\n${RESTART_COUNTS}"
    fi

    if [[ -n "${ISSUES}" ]]; then
        send_alert "Health Check Failed" "Health check issues detected:${ISSUES}"
    else
        log "All health checks passed"
    fi
}

task_security_check() {
    log "Running security checks..."

    # Check fail2ban status
    BANNED_COUNT=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}' || echo "0")
    log "Currently banned IPs: ${BANNED_COUNT}"

    # Check for failed SSH attempts in last 24h using journalctl (more reliable than grepping auth.log)
    FAILED_SSH=$(journalctl -u ssh --since "24 hours ago" 2>/dev/null | grep -c "Failed password" || echo "0")
    log "Failed SSH attempts (last 24h): ${FAILED_SSH}"

    if [[ ${FAILED_SSH} -gt 100 ]]; then
        send_alert "High SSH Attack Volume" "Detected ${FAILED_SSH} failed SSH attempts in last 24h.\n\nCurrently banned IPs: ${BANNED_COUNT}\n\nfail2ban is active."
    fi
}

# -----------------------------------------------------------------------------
# Weekly Tasks
# -----------------------------------------------------------------------------

task_postgres_maintenance() {
    log "Running PostgreSQL maintenance..."

    # Vacuum and analyze
    docker exec geetanjali-postgres psql -U geetanjali -d geetanjali -c "VACUUM ANALYZE;" 2>/dev/null || true

    log "PostgreSQL maintenance complete"
}

task_security_updates_check() {
    log "Checking for security updates..."

    # Update package lists
    apt-get update -qq 2>/dev/null || true

    # Check for security updates
    UPDATES=$(apt-get -s upgrade 2>/dev/null | grep -i security | wc -l || echo "0")

    if [[ ${UPDATES} -gt 0 ]]; then
        UPDATE_LIST=$(apt-get -s upgrade 2>/dev/null | grep -i security || true)
        send_alert "Security Updates Available" "${UPDATES} security updates available:\n\n${UPDATE_LIST}\n\nRun: apt-get upgrade"
    else
        log "No security updates pending"
    fi
}

task_weekly_report() {
    log "Generating weekly report..."

    REPORT="Weekly Server Report - $(date '+%Y-%m-%d')\n"
    REPORT="${REPORT}==========================================\n\n"

    # Disk usage
    REPORT="${REPORT}Disk Usage:\n$(df -h /)\n\n"

    # Docker stats
    REPORT="${REPORT}Docker Images:\n$(docker system df)\n\n"

    # Container status
    REPORT="${REPORT}Containers:\n$(docker ps --format 'table {{.Names}}\t{{.Status}}')\n\n"

    # Backup status
    LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/geetanjali_*.sql.gz 2>/dev/null | head -1 || echo "None")
    REPORT="${REPORT}Latest Backup: ${LATEST_BACKUP}\n\n"

    # Fail2ban stats
    REPORT="${REPORT}Fail2ban Status:\n$(fail2ban-client status sshd 2>/dev/null || echo 'Not available')\n"

    send_alert "Weekly Server Report" "${REPORT}"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

case "${1:-daily}" in
    daily)
        log "========== Starting Daily Maintenance =========="
        task_docker_cleanup
        task_database_backup
        task_ssl_check
        task_disk_check
        task_health_check
        task_security_check
        log "========== Daily Maintenance Complete =========="
        ;;
    weekly)
        log "========== Starting Weekly Maintenance =========="
        task_postgres_maintenance
        task_security_updates_check
        task_weekly_report
        log "========== Weekly Maintenance Complete =========="
        ;;
    backup)
        task_database_backup
        ;;
    health)
        task_health_check
        ;;
    cleanup)
        task_docker_cleanup
        ;;
    report)
        task_weekly_report
        ;;
    *)
        echo "Usage: $0 {daily|weekly|backup|health|cleanup|report}"
        exit 1
        ;;
esac
