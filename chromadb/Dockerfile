# Custom ChromaDB Dockerfile with NumPy < 2.0 constraint
FROM python:3.10-slim

WORKDIR /chroma

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install NumPy < 2.0 first to prevent version conflicts
RUN pip install --no-cache-dir "numpy<2.0.0"

# Install ChromaDB 0.4.22
RUN pip install --no-cache-dir chromadb==0.4.22

# Expose port
EXPOSE 8000

# Run ChromaDB server
CMD ["uvicorn", "chromadb.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
