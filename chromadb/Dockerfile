# Custom ChromaDB Dockerfile with built-in embedding support
# Matches backend chromadb version for compatibility
FROM python:3.11-slim

WORKDIR /chroma

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install ChromaDB 1.3.5 with sentence-transformers for built-in embeddings
# This moves embedding computation from backend to ChromaDB container
RUN pip install --no-cache-dir \
    chromadb==1.3.5 \
    sentence-transformers==3.3.1

# Pre-download the embedding model to avoid first-request latency
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Create non-root user for security
RUN useradd -m -u 1000 chromauser && \
    mkdir -p /chroma/chroma && \
    chown -R chromauser:chromauser /chroma

USER chromauser

# Expose port
EXPOSE 8000

# Run ChromaDB server
CMD ["chroma", "run", "--host", "0.0.0.0", "--port", "8000"]
