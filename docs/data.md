---
layout: default
title: Data Sources
description: Bhagavad Geeta content sources, licensing, and data ingestion for Geetanjali.
---

# Data

Bhagavad Geeta content sources, licensing, and ingestion.

## Sources

### Primary: gita/gita Repository
- URL: https://github.com/gita/gita
- License: The Unlicense (Public Domain)
- Content: 701 verses across 18 chapters
- Format: JSON with Sanskrit, transliteration, translations

### Secondary: VedicScriptures API
- URL: https://github.com/vedicscriptures/bhagavad-gita-api
- License: MIT
- Content: Additional translations and commentaries
- Used for: Enriching verse data with multiple perspectives

### Sanskrit Text
The original Bhagavad Geeta verses are ancient texts (~5th century BCE to 2nd century CE), freely usable worldwide without copyright restrictions.

## Data Structure

Each verse contains:

```json
{
  "canonical_id": "BG_2_47",
  "chapter": 2,
  "verse": 47,
  "sanskrit_devanagari": "कर्मण्येवाधिकारस्ते...",
  "sanskrit_iast": "karmaṇy-evādhikāras te...",
  "translations": [
    {
      "author": "Swami Sivananda",
      "text": "Your right is to work only..."
    }
  ],
  "commentaries": [
    {
      "author": "Adi Shankaracharya",
      "text": "..."
    }
  ]
}
```

## Ingestion Pipeline

On first run, the backend:

1. Reads verse JSON from `data/` directory
2. Validates structure and required fields
3. Inserts into PostgreSQL (verses, translations, commentaries tables)
4. Generates embeddings using sentence-transformers
5. Stores vectors in ChromaDB for semantic search

Manual re-ingestion:
```bash
docker compose exec backend python scripts/ingest_data.py --all
```

## Embeddings

- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Dimensions: 384
- Indexed fields: Sanskrit IAST + English translation
- Storage: ChromaDB with cosine similarity

## Attribution

While the Unlicense doesn't require attribution, we acknowledge:
- gita/gita repository maintainers
- VedicScriptures API contributors
- Traditional commentators (Shankaracharya, Ramanuja, etc.)
- Translators whose work enables access to this wisdom
