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
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --no-cache-dir --upgrade pip

# LAYER 1: Dependencies (cached and only rebuilt when requirements.txt changes)
# Using CPU-only PyTorch from PyPI (avoids 1.5GB NVIDIA CUDA downloads)
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt

# LAYER 2: Application code (changes most often, instant to copy)
COPY . .

# Create non-root user for security and set permissions
RUN useradd -m -u 1000 appuser && \
    chmod +x docker-entrypoint.sh && \
    chown -R appuser:appuser /app

USER appuser

# Expose ports (8000 for backend, 8001 for worker API)
EXPOSE 8000 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Use entrypoint script for initialization
ENTRYPOINT ["./docker-entrypoint.sh"]
