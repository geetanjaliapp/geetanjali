# Custom ChromaDB Dockerfile
# Matches backend chromadb version for compatibility
FROM python:3.10-slim

WORKDIR /chroma

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install ChromaDB 0.5.0 (supports numpy 2.x)
RUN pip install --no-cache-dir chromadb==0.5.0

# Expose port
EXPOSE 8000

# Run ChromaDB server
CMD ["chroma", "run", "--host", "0.0.0.0", "--port", "8000"]
