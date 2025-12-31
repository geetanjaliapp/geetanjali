#!/usr/bin/env python3
"""
Export verse audio metadata to JSON for TTS generation in Colab.

Usage (run from project root via Docker):
    # Export to stdout
    docker compose exec backend python /app/scripts/export_tts_metadata.py --chapter 1

    # Export to file (recommended)
    docker compose exec backend python /app/scripts/export_tts_metadata.py --chapter 1 --pretty > /tmp/chapter_1_metadata.json

Output includes:
    - chapters: TTS metadata (speaker, tone, description) for each verse
    - verses: Normalized Sanskrit text (dandi→comma fix applied)
    - export_info: Verse count and chapter info for Colab

Workflow:
    1. Run this script to export chapter metadata
    2. Upload JSON to Colab notebook
    3. Run TTS generation in Colab
    4. Download WAV zip and process with process_tts_audio.py

Note: Requires database access - must run via Docker.
"""

import argparse
import json
import sys

# When running inside Docker, /app is the backend directory
sys.path.insert(0, "/app")

from data.verse_audio_metadata import build_tts_description, get_chapter_metadata
from data.verse_audio_metadata.defaults import get_defaults_for_verse
from data.verse_audio_metadata.maha_vakyas import get_theological_weight
from data.verse_audio_metadata.text_normalizer import normalize_for_tts
from db.connection import SessionLocal
from models.verse import Verse

# Import chapter modules to trigger registration
try:
    from data.verse_audio_metadata import chapter_02
except ImportError:
    pass

# Verse counts per chapter
VERSE_COUNTS = {
    1: 47,
    2: 72,
    3: 43,
    4: 42,
    5: 29,
    6: 47,
    7: 30,
    8: 28,
    9: 34,
    10: 42,
    11: 55,
    12: 20,
    13: 35,
    14: 27,
    15: 20,
    16: 24,
    17: 28,
    18: 78,
}


def export_chapter(chapter: int) -> dict:
    """Export metadata and verses for a chapter."""

    # Get verses from database and normalize for TTS
    verses = {}
    with SessionLocal() as db:
        for cid, text in (
            db.query(Verse.canonical_id, Verse.sanskrit_devanagari)
            .filter(Verse.chapter == chapter)
            .all()
        ):
            if text:
                # Normalize: remove verse numbering, fix line breaks
                verses[cid] = normalize_for_tts(text)

    # Build metadata for each verse
    chapter_metadata = get_chapter_metadata(chapter)
    verse_list = []

    for verse_num in range(1, VERSE_COUNTS.get(chapter, 0) + 1):
        canonical_id = f"BG_{chapter}_{verse_num}"

        # Start with defaults
        metadata = get_defaults_for_verse(canonical_id)

        # Override with explicit metadata
        explicit = chapter_metadata.get(canonical_id)
        if explicit:
            metadata.update(explicit)

        # Ensure theological weight
        if metadata.get("theological_weight") == "standard":
            metadata["theological_weight"] = get_theological_weight(canonical_id)

        # Build TTS description
        metadata["tts_description"] = build_tts_description(metadata)
        metadata["canonical_id"] = canonical_id

        verse_list.append(metadata)

    return {
        "chapters": {str(chapter): verse_list},
        "verses": verses,
        "export_info": {
            "verse_count": len(verse_list),
            "chapters": [chapter],
            "includes_text": True,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Export verse audio metadata for TTS")
    parser.add_argument(
        "--chapter", type=int, required=True, help="Chapter number (1-18)"
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args()

    data = export_chapter(args.chapter)

    indent = 2 if args.pretty else None
    print(json.dumps(data, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    main()
