---
layout: default
title: Content Management
description: How content is sourced, ingested, and synced in Geetanjali.
---

# Content Management

Geetanjali uses a **code-first approach** where content metadata is authored in Python files and synced to the database. This enables version control, code review, and repeatable deployments.

## Content Types

| Type | Source | Records | Sync Method |
|------|--------|---------|-------------|
| **Verses** | External APIs | 700 | `ingest_data.py` |
| **Featured Verses** | `featured_verses.py` | 180 | `/admin/sync-featured` |
| **Chapter Metadata** | `chapter_metadata.py` | 18 + 1 book | `/admin/sync-metadata` |
| **Geeta Dhyanam** | `geeta_dhyanam.py` | 9 | Direct API query |
| **Audio Metadata** | `verse_audio_metadata/` | 700 | `extract_audio_durations.py` |
| **Audio Files** | Colab TTS pipeline | 709 MP3s | Manual |

---

## Scripts

### Data Ingestion

| Script | Purpose |
|--------|---------|
| `ingest_data.py` | Initial verse ingestion from external sources |
| `init_db.py` | Database schema initialization |
| `backfill_paraphrase_metadata.py` | Sync paraphrases to ChromaDB |

### Audio Processing

| Script | Purpose |
|--------|---------|
| `export_tts_metadata.py` | Export verse data for Colab TTS |
| `export_dhyanam_metadata.py` | Export Dhyanam data for Colab |
| `process_tts_audio.py` | Convert Colab WAV to MP3 |
| `process_dhyanam_audio.py` | Convert Dhyanam WAV to MP3 |
| `qa_audio_files.py` | QA check for truncation/anomalies |
| `extract_audio_durations.py` | Extract MP3 durations to DB |

All scripts are in `backend/scripts/`.

---

## Admin API

```bash
# Sync featured verses
curl -X POST http://localhost:8000/api/v1/admin/sync-featured \
  -H "X-API-Key: YOUR_KEY"

# Sync chapter metadata
curl -X POST http://localhost:8000/api/v1/admin/sync-metadata \
  -H "X-API-Key: YOUR_KEY"

# Trigger verse enrichment (LLM paraphrases)
curl -X POST http://localhost:8000/api/v1/admin/enrich \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "force": false}'

# Check status
curl http://localhost:8000/api/v1/admin/status \
  -H "X-API-Key: YOUR_KEY"
```

---

## Data Files

Located in `backend/data/`:

| File | Content |
|------|---------|
| `featured_verses.py` | 180 curated verse IDs |
| `chapter_metadata.py` | Book + 18 chapter intros |
| `geeta_dhyanam.py` | 9 invocation verses |
| `verse_audio_metadata/` | TTS generation configs |

### Audio Metadata Hierarchy

Audio metadata resolves in order:
1. Explicit chapter config (`chapter_02.py`)
2. Maha vakya overrides (`maha_vakyas.py`)
3. Chapter defaults (`defaults.py[chapter]`)
4. Speaker defaults (`defaults.py[speaker]`)
5. Global defaults (`defaults.py[GLOBAL]`)

---

## Audio Generation

Full pipeline:

```
1. Export metadata
   docker compose exec backend python /app/scripts/export_tts_metadata.py --chapter N

2. Generate in Colab (upload JSON, run cells, download ZIP)

3. Process audio
   docker compose exec backend python /app/scripts/process_tts_audio.py chapter_N_wav.zip

4. Extract durations
   docker compose exec backend python /app/scripts/extract_audio_durations.py

5. QA check
   docker compose exec backend python /app/scripts/qa_audio_files.py --chapter N
```

### QA Thresholds

| Check | Threshold |
|-------|-----------|
| Minimum duration | 3 seconds (truncation detection) |
| Syllable rate | 1.5–5.0 per second |
| Maximum duration | 60s (verses), 120s (dhyanam) |

---

## Database Tables

| Table | Key Fields |
|-------|------------|
| `verses` | canonical_id, sanskrit_devanagari, translation_en, is_featured |
| `verse_audio_metadata` | canonical_id, audio_duration_ms, audio_file_path |
| `book_metadata` | book_key, intro_text, verse_count |
| `chapter_metadata` | chapter_number, summary, hero_verse_id |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Sync returns 0 records | Run `ingest_data.py` first |
| Audio not playing | Check `audio_file_path` in verse_audio_metadata |
| TTS truncation | Text normalizer should convert `।` to `,` |
| Duration missing | Run `extract_audio_durations.py` |

### Verification

```bash
# Check verse count
curl http://localhost:8000/api/v1/admin/status

# Check audio file exists
ls -la public/audio/mp3/02/BG_2_47.mp3

# Check duration in DB
docker compose exec db psql -U postgres -c \
  "SELECT canonical_id, audio_duration_ms FROM verse_audio_metadata WHERE canonical_id='BG_2_47'"
```
