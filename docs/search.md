---
layout: default
title: Search
description: How search works in Geetanjali - unified hybrid search across Bhagavad Geeta verses.
---

# Search

Geetanjali provides a unified hybrid search that automatically detects query intent and returns relevant verses with full transparency about why each result matched.

## Search Strategies

The search system uses five strategies, executed in priority order:

| Strategy | Trigger | Example Query | Score |
|----------|---------|---------------|-------|
| **Canonical** | Verse reference pattern | `2.47`, `BG_2_47`, `chapter 2 verse 47` | 1.0 |
| **Sanskrit** | Devanagari or IAST text | `कर्मणयेवाधिकारस्ते`, `karmaṇy` | 0.95 |
| **Keyword** | English text | `duty`, `attachment`, `action` | 0.7-0.8 |
| **Principle** | Topic filter | `?principle=detachment` | 0.65 |
| **Semantic** | Meaning-based (fallback) | `how to handle failure` | 0.3-0.7 |

### Strategy Selection

```
Query: "2.47"
  → Detected as canonical reference
  → Returns exact verse match (BG_2_47)

Query: "कर्म"
  → Detected as Sanskrit (Devanagari)
  → Searches sanskrit_devanagari and sanskrit_iast fields

Query: "focus on duty"
  → Detected as English keyword
  → Searches translations and paraphrases
  → Falls back to semantic if few results
```

## Ranking Algorithm

Results are ranked using a weighted combination:

```
rank_score = (weight_match_type × type_score)
           + (weight_score × raw_score)
           + (featured_boost if is_featured)
```

Default weights:
- `weight_match_type`: 1.0
- `weight_score`: 0.5
- `featured_boost`: 0.15

### Match Type Priorities

| Type | Base Score | After Weighting |
|------|------------|-----------------|
| Exact canonical | 1.0 | 1.0 |
| Exact Sanskrit | 0.95 | 0.95 |
| Keyword (translation) | 0.8 | 0.8 |
| Keyword (paraphrase) | 0.7 | 0.7 |
| Principle filter | 0.65 | 0.65 |
| Semantic match | varies | 0.3-0.7 |

Featured verses (curated selection) get a +0.15 boost.

## API Reference

### Search Verses

```
GET /api/v1/search?q={query}&chapter={n}&principle={tag}&limit={n}&offset={n}
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `chapter` | int | Filter by chapter (1-18) |
| `principle` | string | Filter by consulting principle |
| `limit` | int | Results per page (default: 20) |
| `offset` | int | Pagination offset |

**Response:**

```json
{
  "query": "karma yoga",
  "strategy": "keyword",
  "total": 12,
  "total_count": 45,
  "results": [
    {
      "canonical_id": "BG_2_47",
      "chapter": 2,
      "verse": 47,
      "sanskrit_devanagari": "कर्मण्येवाधिकारस्ते...",
      "sanskrit_iast": "karmaṇy-evādhikāras te...",
      "translation_en": "You have the right to work only...",
      "paraphrase_en": "Focus on your duty without attachment...",
      "principles": ["duty_focused_action", "non_attachment"],
      "is_featured": true,
      "match": {
        "type": "keyword_paraphrase",
        "field": "paraphrase_en",
        "score": 0.8,
        "highlight": "Focus on your <mark>duty</mark> without..."
      },
      "rank_score": 1.35
    }
  ],
  "moderation": null,
  "suggestion": null
}
```

### Get Available Principles

```
GET /api/v1/search/principles
```

Returns list of all consulting principles that can be used as filters.

## Match Transparency

Every search result includes a `match` object explaining why it appeared:

- **type**: Which strategy matched (canonical, sanskrit, keyword, semantic, principle)
- **field**: Which database field contained the match
- **score**: Raw match quality score (0-1)
- **highlight**: Matched text with `<mark>` tags for display

This transparency lets users understand and verify why each verse was returned.

## Situational Query Detection

Queries that look like personal situations trigger a consultation suggestion:

```
Query: "How do I handle stress at work?"
  → Detected as situational query
  → Response includes suggestion:
    {
      "type": "consultation",
      "message": "Looking for guidance? Try our consultation feature...",
      "cta": "Get Guidance"
    }
```

Trigger patterns:
- Starts with "my", "i am", "i'm", "i feel"
- Contains "how do i", "how can i", "what should i"
- Contains "struggling", "confused", "anxious", "stressed"

## Content Moderation

Search queries are checked against the content filter before execution. Blocked queries return:

```json
{
  "query": "...",
  "strategy": "blocked",
  "total": 0,
  "results": [],
  "moderation": {
    "blocked": true,
    "message": "Content policy violation: profanity"
  }
}
```

Canonical verse references (e.g., "BG 2.47") bypass moderation since they're known-safe lookups.

## Frontend Integration

### Search Page (`/search`)

Dedicated search experience with:
- Full-text search input
- Chapter filter dropdown
- Match transparency (type badge, highlighted text)
- Strategy indicator
- Consultation suggestion banner
- Recent searches (localStorage)
- Keyboard shortcut (Cmd/Ctrl+K)

### Verse Browser Bridge

The verse browser (`/verses`) includes a search bar that navigates to `/search?q=...`, bridging the browse and search experiences.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  services/search/                                            │
├─────────────────────────────────────────────────────────────┤
│  __init__.py      Public exports                            │
│  types.py         Dataclasses, enums, serialization         │
│  config.py        SearchConfig with ranking weights         │
│  parser.py        QueryParser for intent detection          │
│  utils.py         SQL escaping, highlighting                │
│  ranking.py       Score computation, result merging         │
│  service.py       SearchService orchestrator                │
│                                                              │
│  strategies/                                                 │
│    canonical.py   Exact verse reference lookup              │
│    sanskrit.py    Devanagari/IAST text search              │
│    keyword.py     Full-text translation/paraphrase search   │
│    principle.py   JSONB principle filtering                 │
│    semantic.py    ChromaDB vector similarity                │
└─────────────────────────────────────────────────────────────┘
```

## Performance

| Operation | Latency |
|-----------|---------|
| Canonical lookup | ~5ms |
| Keyword search | ~20ms |
| Semantic search | ~40ms |
| Full hybrid (all strategies) | ~60ms |

Semantic search includes embedding generation (~15ms) and ChromaDB query (~25ms).

## Configuration

Search weights can be adjusted in `SearchConfig`:

```python
@dataclass
class SearchConfig:
    limit: int = 20
    offset: int = 0
    semantic_top_k: int = 10
    semantic_min_score: float = 0.3
    weight_match_type: float = 1.0
    weight_featured: float = 0.15
    weight_score: float = 0.5
```

For production tuning, these could be moved to environment variables or settings.
