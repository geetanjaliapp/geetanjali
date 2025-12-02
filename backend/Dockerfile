# syntax=docker/dockerfile:1.4
# Backend Dockerfile for Geetanjali - Optimized for fast rebuilds

FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --no-cache-dir --upgrade pip

# LAYER 1: Heavy dependencies (rarely change, slow to install)
# These are cached and only rebuilt when requirements-heavy.txt changes
COPY requirements-heavy.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements-heavy.txt

# LAYER 2: Light dependencies (change more often, fast to install)
COPY requirements-light.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements-light.txt

# LAYER 3: Application code (changes most often, instant to copy)
COPY . .

# Create non-root user for security and set permissions
RUN useradd -m -u 1000 appuser && \
    chmod +x docker-entrypoint.sh && \
    chown -R appuser:appuser /app

USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Use entrypoint script for initialization
ENTRYPOINT ["./docker-entrypoint.sh"]
