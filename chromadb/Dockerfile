# Custom ChromaDB Dockerfile
# Matches backend chromadb version for compatibility
FROM python:3.11-slim

WORKDIR /chroma

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install ChromaDB 1.3.5
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
