# Custom ChromaDB Dockerfile
#
# VERSION SKEW -- this server pins 1.3.5 while backend/requirements.txt pins the client
# at 1.5.9. They do not match, despite what this comment claimed until 2026-08-02.
# Both fall inside GHSA-f4j7-r4q5-qw2c (>= 1.0.0, <= 1.5.9), so closing the skew does
# not change the security position -- see the accepted-risk note in requirements.txt.
# Aligning them is a deliberate migration: this is a persistent vector store, so a
# two-minor server bump needs a data-format check before it ships.
FROM python:3.11-slim

WORKDIR /chroma

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install ChromaDB 1.3.5 (see VERSION SKEW note above)
# NOTE: This is a pure vector database server.
# Embedding computation (text → vectors) is performed in backend/services/vector_store.py
# using sentence-transformers. This Dockerfile does NOT include sentence-transformers
# to keep image size minimal (saves ~10GB). If chromadb ever needs to compute embeddings,
# add sentence-transformers back here; otherwise, leave as-is for budget deployment.
RUN pip install --no-cache-dir \
    chromadb==1.3.5

# Create non-root user for security
RUN useradd -m -u 1000 chromauser && \
    mkdir -p /chroma/chroma && \
    chown -R chromauser:chromauser /chroma

USER chromauser

# Expose port
EXPOSE 8000

# Run ChromaDB server
CMD ["chroma", "run", "--host", "0.0.0.0", "--port", "8000"]
