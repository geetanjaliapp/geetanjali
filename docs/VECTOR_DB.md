# Vector Database - ChromaDB Configuration

## Overview

Geetanjali uses ChromaDB for storing and retrieving verse embeddings to enable semantic search in the RAG pipeline.

## Architecture

```
┌─────────────────┐
│  User Query     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Embedding       │─────▶│  Query Embedding │
│ Service         │      │  (384-dim vector)│
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │    ChromaDB      │
                         │  Vector Search   │
                         │  (cosine sim)    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  Top-K Verses    │
                         │  with relevance  │
                         └──────────────────┘
```

## Embedding Model

**Model:** `sentence-transformers/all-MiniLM-L6-v2`

**Characteristics:**
- Dimension: 384
- Speed: Fast (CPU-friendly)
- Quality: Good for semantic similarity
- Size: ~90MB download
- License: Apache 2.0

**Why this model?**
- Optimized for semantic search
- Fast inference on CPU
- Small footprint
- Good balance of speed and quality

## ChromaDB Configuration

### Storage

**Development:**
```
CHROMA_PERSIST_DIRECTORY=./chroma_data
```

**Docker:**
```
CHROMA_PERSIST_DIRECTORY=/app/chroma_data
```

**Production:**
- Use persistent volume mount
- Regular backups recommended

### Collection Schema

```python
{
    "name": "gita_verses",
    "metadata": {
        "description": "Bhagavad Geeta verses for RAG retrieval"
    }
}
```

### Document Structure

Each verse stored as:
```python
{
    "id": "BG_2_47",  # Canonical ID
    "embedding": [0.123, -0.456, ...],  # 384-dim vector
    "document": "karmaṇy-evādhikāras te... Act focused on duty, not fruits.",
    "metadata": {
        "canonical_id": "BG_2_47",
        "chapter": 2,
        "verse": 47,
        "paraphrase": "Act focused on duty, not fruits.",
        "principles": "duty_focused_action,non_attachment_to_outcomes",
        "source": "gita/gita",
        "license": "Unlicense"
    }
}
```

## Indexing Process

### Initial Indexing

```bash
# 1. Initialize database with seed verses
python scripts/init_db.py

# 2. Index verses into ChromaDB
python scripts/index_verses.py

# Output:
# 🔍 Indexing verses into ChromaDB...
# 📖 Found 8 verses in database
# 🚀 Starting indexing...
#   📝 Prepared BG_2_47
#   ... (8 verses)
# 💾 Indexing to ChromaDB...
# ✅ Indexing complete! 8 verses in vector store
```

### Re-indexing

```python
# Reset and re-index
python scripts/index_verses.py
# Responds to prompt: Reset and re-index? (y/n)
```

### Programmatic Indexing

```python
from services.vector_store import get_vector_store

vector_store = get_vector_store()

# Add single verse
vector_store.add_verse(
    canonical_id="BG_2_47",
    text="karmaṇy-evādhikāras te... Act focused on duty",
    metadata={
        "chapter": 2,
        "verse": 47,
        "paraphrase": "Act focused on duty, not fruits."
    }
)

# Add batch
vector_store.add_verses_batch(
    canonical_ids=["BG_2_47", "BG_3_19"],
    texts=["text1", "text2"],
    metadatas=[{...}, {...}]
)
```

## Search Operations

### Vector Similarity Search

```python
from services.vector_store import get_vector_store

vector_store = get_vector_store()

# Search for similar verses
results = vector_store.search(
    query="How should a leader handle difficult decisions?",
    top_k=5
)

# Results structure
{
    "ids": ["BG_2_47", "BG_18_63", ...],
    "distances": [0.234, 0.456, ...],  # Lower = more similar
    "documents": ["verse text 1", "verse text 2", ...],
    "metadatas": [{...}, {...}, ...]
}
```

### Filtered Search

```python
# Search with metadata filter
results = vector_store.search(
    query="leadership ethics",
    top_k=3,
    where={"chapter": 2}  # Only chapter 2
)
```

### Direct Lookup

```python
# Get specific verse
verse = vector_store.get_by_id("BG_2_47")
```

## Performance Tuning

### Embedding Generation

**Batch Processing:**
```python
# Faster than one-by-one
embeddings = embedding_service.encode([text1, text2, text3])
```

**Caching:**
- Embeddings are deterministic
- Can cache frequently accessed embeddings
- Use Redis for distributed caching (future)

### Search Optimization

**top_k Selection:**
- Default: 5 verses
- Configurable via `RAG_TOP_K_VERSES` setting
- Lower = faster but less context
- Higher = more context but slower

**Metadata Filters:**
- Pre-filter by chapter or principles
- Reduces search space
- Faster retrieval

## Monitoring

### Health Check

```bash
curl http://localhost:8000/health/ready

{
  "status": "ready",
  "checks": {
    "database": true,
    "chroma": true,
    "ollama": false
  }
}
```

### Collection Stats

```python
from services.vector_store import get_vector_store

vector_store = get_vector_store()

# Get count
count = vector_store.count()
print(f"Verses indexed: {count}")
```

## Troubleshooting

### Issue: ChromaDB not persisting data

**Solution:**
```bash
# Check persist directory exists and is writable
ls -la ./chroma_data

# Ensure environment variable is set
echo $CHROMA_PERSIST_DIRECTORY
```

### Issue: Embedding model download fails

**Solution:**
```bash
# Manually download model
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Check internet connection
# Check disk space (~200MB needed)
```

### Issue: Search returns no results

**Solution:**
```bash
# Check if verses are indexed
python -c "from services.vector_store import get_vector_store; print(get_vector_store().count())"

# Re-index if count is 0
python scripts/index_verses.py
```

### Issue: Slow search performance

**Optimization:**
- Reduce `top_k` parameter
- Use metadata filters
- Consider GPU acceleration (future)

## Migration Path

### SQLite → PostgreSQL

ChromaDB embeddings remain the same. Only metadata storage changes.

### Local → Hosted ChromaDB

```python
# Update config to use Chroma server
CHROMA_HOST=chroma.example.com
CHROMA_PORT=8000
```

### Scaling

**Current (MVP):**
- Local ChromaDB
- 8 seed verses
- Single instance

**Future:**
- Hosted ChromaDB cluster
- 700 full verses
- Horizontal scaling

## Best Practices

1. **Index after database updates**
   ```bash
   # After adding verses to DB
   python scripts/index_verses.py
   ```

2. **Backup ChromaDB data**
   ```bash
   tar -czf chroma_backup.tar.gz chroma_data/
   ```

3. **Version embeddings**
   - Include model version in metadata
   - Re-index if model changes

4. **Monitor disk usage**
   - ChromaDB grows with data
   - Plan for ~1MB per 100 verses

5. **Test search quality**
   - Run sample queries
   - Verify top results are relevant
   - Adjust embedding strategy if needed

## References

- ChromaDB Docs: https://docs.trychroma.com/
- sentence-transformers: https://www.sbert.net/
- Embedding Model: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
