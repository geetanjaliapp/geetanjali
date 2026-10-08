# syntax=docker/dockerfile:1.4
# Backend Dockerfile for Geetanjali - Optimized for fast rebuilds

FROM python:3.11-slim

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
# ACCEPTED RISK on torch 2.9.1 -- GHSA-63cw-57p8-fm3p (RCE via untrusted checkpoint, fixed 2.10),
# GHSA-rrmf-rvhw-rf47 + GHSA-qfhq-4f3w-5fph (memory corruption in torch.jit.script / lstm_cell),
# PYSEC-2026-139 (no fix). We load only the pinned sentence-transformers model and never call jit
# or lstm on user input. Mirrored as --ignore-vuln in ci.yml, which installs torch from this line.
# Bump in its own release: a torch change rebuilds the heaviest layer on the 1.9GB droplet.
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt

# LAYER 2: Application code (changes most often, instant to copy)
COPY . .

# Create non-root user for security and set permissions
# Pre-create HuggingFace cache directory for sentence-transformers model
#
# /app/tts-audio must exist here, owned by appuser, before the named volume mounts over it:
# Docker initialises an empty named volume from the image path it covers, ownership included.
# Without this the volume arrives owned by root, the app cannot write to it, and TTS silently
# degrades to the browser voice -- the exact failure this release exists to remove.
RUN useradd -m -u 1000 appuser && \
    mkdir -p /home/appuser/.cache/huggingface && \
    chown -R appuser:appuser /home/appuser/.cache && \
    chmod +x docker-entrypoint.sh && \
    mkdir -p /app/tts-audio && \
    chown -R appuser:appuser /app

USER appuser

# Expose ports (8000 for backend, 8001 for worker API)
EXPOSE 8000 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Use entrypoint script for initialization
ENTRYPOINT ["./docker-entrypoint.sh"]
