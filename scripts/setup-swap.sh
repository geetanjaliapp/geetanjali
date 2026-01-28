#!/bin/bash
# Setup 1GB swap for budget deployment (2GB droplet)
# Run as root: sudo ./setup-swap.sh

set -euo pipefail

SWAP_SIZE="1G"
SWAP_FILE="/swapfile"
SWAPPINESS="10"

echo "=== Geetanjali Swap Setup ==="
echo "Creating ${SWAP_SIZE} swap file for budget deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: Please run as root (sudo ./setup-swap.sh)"
    exit 1
fi

# Check if swap already exists
if swapon --show | grep -q "$SWAP_FILE"; then
    echo "Swap already configured at $SWAP_FILE"
    swapon --show
    exit 0
fi

# Check if swap file exists but not enabled
if [ -f "$SWAP_FILE" ]; then
    echo "Swap file exists but not enabled. Enabling..."
    swapon "$SWAP_FILE"
    swapon --show
    exit 0
fi

# Create swap file
echo "Creating swap file..."
fallocate -l "$SWAP_SIZE" "$SWAP_FILE"

# Secure permissions (only root can read/write)
chmod 600 "$SWAP_FILE"

# Setup swap
echo "Setting up swap..."
mkswap "$SWAP_FILE"
swapon "$SWAP_FILE"

# Add to fstab for persistence across reboots
if ! grep -q "$SWAP_FILE" /etc/fstab; then
    echo "Adding swap to /etc/fstab..."
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi

# Set swappiness (10 = only use swap under memory pressure)
echo "Setting swappiness to ${SWAPPINESS}..."
sysctl vm.swappiness="$SWAPPINESS"

# Make swappiness persistent
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
    echo "vm.swappiness=${SWAPPINESS}" >> /etc/sysctl.conf
fi

# Verify
echo ""
echo "=== Swap Configuration Complete ==="
echo ""
free -h
echo ""
swapon --show
echo ""
echo "Swappiness: $(cat /proc/sys/vm/swappiness)"
