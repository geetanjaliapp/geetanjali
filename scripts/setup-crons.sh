#!/bin/bash
#
# Setup cron jobs for Geetanjali production server
#
# Usage:
#   ./scripts/setup-crons.sh          # Install crontab
#   ./scripts/setup-crons.sh --show   # Show what would be installed
#
# Cron Jobs:
#   - SEO daily refresh (00:05 UTC) - regenerates daily verse page
#   - Daily maintenance (3 AM UTC)
#   - Weekly maintenance (4 AM UTC, Sundays)
#   - Newsletter: Morning (6 AM IST = 00:30 UTC)
#   - Newsletter: Afternoon (12:30 PM IST = 07:00 UTC)
#   - Newsletter: Evening (6 PM IST = 12:30 UTC)
#

set -e

GEETANJALI_DIR="${GEETANJALI_DIR:-/opt/geetanjali}"
LOG_DIR="/var/log/geetanjali"

CRONTAB_CONTENT="# Geetanjali Cron Jobs
# Installed by: scripts/setup-crons.sh
# Last updated: $(date -u +%Y-%m-%d)

# Set PATH for cron environment (required for docker, etc.)
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# =============================================================================
# SEO Jobs
# =============================================================================
# Daily SEO refresh regenerates the daily verse page (content changes daily).
# Other pages are hash-checked and skipped if unchanged.
# Auth: Uses API_KEY from container environment (defense in depth).

# SEO daily refresh (00:05 UTC = 5:35 AM IST)
# -f flag fails on HTTP errors, -w adds status code to output
5 0 * * * cd ${GEETANJALI_DIR} && docker exec geetanjali-backend sh -c 'curl -s -f -X POST -H \"X-API-Key: \$API_KEY\" http://localhost:8000/api/v1/admin/seo/generate -w \" [HTTP %{http_code}]\"' >> ${LOG_DIR}/seo.log 2>&1 || echo \"[FAILED] SEO generation error at \$(date)\" >> ${LOG_DIR}/seo.log

# =============================================================================
# Maintenance Jobs
# =============================================================================

# Daily maintenance: log rotation, cleanup (3 AM UTC)
0 3 * * * ${GEETANJALI_DIR}/scripts/cron-maintenance.sh daily >> ${LOG_DIR}/maintenance.log 2>&1

# Weekly maintenance: database vacuum, docker prune (4 AM UTC, Sundays)
0 4 * * 0 ${GEETANJALI_DIR}/scripts/cron-maintenance.sh weekly >> ${LOG_DIR}/maintenance.log 2>&1

# =============================================================================
# Newsletter Jobs (Daily Wisdom)
# =============================================================================
# Subscribers choose their preferred time slot. Each cron queries subscribers
# for that slot and enqueues individual RQ jobs for the worker to process.
#
# Times are in UTC. IST = UTC + 5:30

# Morning digest (6:00 AM IST = 00:30 UTC)
30 0 * * * cd ${GEETANJALI_DIR} && docker exec geetanjali-backend python -m jobs.newsletter_scheduler --send-time morning >> ${LOG_DIR}/newsletter.log 2>&1

# Afternoon digest (12:30 PM IST = 07:00 UTC)
0 7 * * * cd ${GEETANJALI_DIR} && docker exec geetanjali-backend python -m jobs.newsletter_scheduler --send-time afternoon >> ${LOG_DIR}/newsletter.log 2>&1

# Evening digest (6:00 PM IST = 12:30 UTC)
30 12 * * * cd ${GEETANJALI_DIR} && docker exec geetanjali-backend python -m jobs.newsletter_scheduler --send-time evening >> ${LOG_DIR}/newsletter.log 2>&1
"

show_crontab() {
    echo "Crontab entries to be installed:"
    echo "================================="
    echo "$CRONTAB_CONTENT"
}

install_crontab() {
    # Ensure log directory exists
    if [ ! -d "$LOG_DIR" ]; then
        echo "Creating log directory: $LOG_DIR"
        sudo mkdir -p "$LOG_DIR"
        sudo chown "$(whoami):$(whoami)" "$LOG_DIR"
    fi

    # Install crontab
    echo "$CRONTAB_CONTENT" | crontab -
    echo "Crontab installed successfully!"
    echo ""
    echo "Verify with: crontab -l"
    echo "Logs:"
    echo "  - SEO:         ${LOG_DIR}/seo.log"
    echo "  - Maintenance: ${LOG_DIR}/maintenance.log"
    echo "  - Newsletter:  ${LOG_DIR}/newsletter.log"
}

case "${1:-}" in
    --show|-s)
        show_crontab
        ;;
    --help|-h)
        echo "Usage: $0 [--show|--help]"
        echo ""
        echo "Options:"
        echo "  --show, -s   Show crontab entries without installing"
        echo "  --help, -h   Show this help message"
        echo ""
        echo "Without options, installs the crontab for the current user."
        ;;
    "")
        install_crontab
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information."
        exit 1
        ;;
esac
