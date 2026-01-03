---
layout: default
title: Audio Recitations
description: AI-generated Sanskrit verse recitations for the Bhagavad Gita.
---

# Audio Recitations

Geetanjali includes AI-generated Sanskrit recitations of the Bhagavad Gita verses. Hear proper pronunciation while you read.

## Overview

Each verse can be played aloud with a natural Sanskrit recitation. The voice is **Aryan**—a male voice trained specifically for Indian languages with clear enunciation and a measured pace suitable for contemplation.

**Technology**: [Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts) by AI4Bharat

**Current coverage**: All 700 verses + 9 Geeta Dhyanam invocations

---

## How It Works

```
Sanskrit Text → AI Voice Synthesis → Audio File
      ↓                ↓                  ↓
  Devanagari      Aryan voice       MP3 (128kbps)
  from source     with curated      ready for
  scripture       tempo/emotion     playback
```

Each verse is individually processed with metadata that controls:

| Aspect | Effect |
|--------|--------|
| **Tempo** | Measured pace for most verses; slower for key teachings |
| **Emotion** | Serene for wisdom, firm for commands, compassionate for consolation |
| **Emphasis** | Special treatment for *maha vakyas* (great sayings) |

### Maha Vakyas

Foundational verses like BG 2.47 (*karmaṇy evādhikāras te*) receive enhanced treatment:
- Slower, more deliberate delivery
- Greater gravitas in tone
- Pauses for absorption

---

## Audio Quality

- **Format**: MP3, 128kbps stereo
- **Duration**: 7–15 seconds per verse (varies with length)
- **Voice**: Aryan (male, Sanskrit-optimized)
- **Clarity**: Optimized for both speakers and headphones

---

## Playback Features

### Single Verse

Click the play button on any verse card or detail page. Controls include:
- Play/pause toggle
- Progress bar with seek
- Playback speed (0.75×, 1×, 1.25×)
- Loop mode for memorization

### Reading Mode

Sequential playback with two auto-advance modes:

| Mode | Behavior |
|------|----------|
| **Listen** | Plays audio, advances after completion + 800ms pause |
| **Read** | Timer-based at 80% of audio duration (silent reading pace) |

The next verse audio preloads at 80% progress to eliminate gaps.

### Study Mode

Sequential playback of a verse's sections in one flow:

```
Sanskrit Audio → English Translation → Hindi Translation → Insight
```

- **Trigger**: Study Mode icon on Verse Detail page
- **Behavior**: Plays each section with brief pauses between
- **UI**: Progress dots show current section, popover displays section name
- **Accessibility**: Screen readers announce section transitions via aria-live

Useful for immersive learning without manual navigation.

### Media Controls

Lock screen and notification controls work via the Media Session API. Pause, resume, and see verse info without unlocking your device.

---

## Offline Audio

Audio files cache automatically for offline playback.

**How it works:**
- First play caches the MP3 via Service Worker
- Subsequent plays serve from cache instantly
- Cloud icon in MiniPlayer indicates cached status

**Cache limits:**
- 100MB quota with LRU eviction
- Manage in Settings → Audio Cache (see file count, clear cache)

**Technical:**
- Service Worker intercepts `/audio/` requests
- Supports Range requests for seeking within cached files
- Falls back to network on cache miss

---

## For Contributors

### Generation Workflow

Audio generation uses a three-step pipeline:

1. **Export metadata** from the database (runs locally via Docker)
2. **Generate audio** using Indic Parler-TTS in Google Colab (GPU required)
3. **Post-process** WAV to MP3 and organize files

Scripts are in `backend/scripts/`:

| Script | Purpose |
|--------|---------|
| `export_tts_metadata.py` | Export verse text + voice parameters |
| `indic_parler_tts.ipynb` | Colab notebook for TTS generation |
| `process_tts_audio.py` | Convert WAV → MP3, organize files |

### Adding a New Chapter

1. Curate voice metadata in `backend/data/verse_audio_metadata/chapter_XX.py`
2. Export: `docker compose exec backend python /app/scripts/export_tts_metadata.py --chapter XX`
3. Generate in Colab (upload JSON, run cells, download ZIP)
4. Process: `python3 backend/scripts/process_tts_audio.py ~/Downloads/chapter_XX_wav.zip`
5. Commit MP3 files to `public/audio/mp3/XX/`

### Resuming Interrupted Generation

The Colab notebook checkpoints progress. If your session disconnects:

1. Reconnect and re-run setup cells
2. Re-upload the same metadata JSON
3. Run the generation cell—it resumes from the checkpoint

---

## File Structure

```
public/audio/mp3/
├── 01/           # Chapter 1 (47 files)
├── 02/           # Chapter 2 (72 files)
├── ...
├── 18/           # Chapter 18 (78 files)
└── dhyanam/      # Geeta Dhyanam (9 files)
```

Files follow the canonical ID pattern: `BG_{chapter}_{verse}.mp3`

**Total: 710 MP3 files** (701 verses + 9 dhyanam)

---

## Architecture

```
frontend/src/
├── components/audio/
│   ├── AudioPlayerContext.tsx  # Global audio state
│   ├── AudioPlayer.tsx         # Reusable player UI
│   ├── MiniPlayer.tsx          # Compact player for reading mode
│   ├── StudyModePlayer.tsx     # Study mode UI and controls
│   └── FloatingAudioBar.tsx    # Fixed bottom bar during scroll
├── hooks/
│   ├── useAutoAdvance.ts       # Listen/Read mode logic
│   ├── useStudyMode.ts         # Study mode state machine
│   └── useAudioCache.ts        # Cache status and management
└── lib/
    └── audioPreload.ts         # Background preloading
```

The audio context ensures only one audio plays at a time. When a new verse starts, any playing audio stops automatically.

---

## Text-to-Speech (TTS) API

For user-selected text (translations, commentaries), Geetanjali provides real-time TTS via the `/api/v1/tts` endpoint.

### Voices

| Language | Voice | Description |
|----------|-------|-------------|
| Hindi (`hi`) | `hi-IN-MadhurNeural` | Male, clear Sanskrit pronunciation |
| English (`en`) | `en-US-AriaNeural` | Female, natural reading voice |

### Caching

TTS responses are cached in Redis to reduce latency and API costs:

- **TTL**: 24 hours
- **Key format**: `tts:{lang}:{rate}:{pitch}:{text_hash}`
- **Cache hit**: Served immediately with `X-Cache: HIT` header
- **Cache miss**: Generated via Edge TTS, then cached

### Metrics

Prometheus metrics for monitoring TTS health:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `geetanjali_tts_requests_total` | Counter | `lang`, `result` | Total TTS requests |
| `geetanjali_tts_cache_hits_total` | Counter | — | Cache hit count |
| `geetanjali_tts_cache_misses_total` | Counter | — | Cache miss count |

**Grafana dashboard**: The main Geetanjali dashboard includes a TTS panel showing request volume and cache hit rate.

### Rate Limiting

- **Limit**: 30 requests/minute per user/IP
- **Scope**: Applied at the API gateway level

---

## Acknowledgments

- [AI4Bharat](https://ai4bharat.org/) for the Indic Parler-TTS model
- Sanskrit text from traditional sources
