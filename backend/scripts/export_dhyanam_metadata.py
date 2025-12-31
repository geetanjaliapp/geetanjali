#!/usr/bin/env python3
"""
Export Geeta Dhyanam metadata to JSON for TTS generation in Colab.

Usage (run from project root via Docker):
    # Export to stdout
    docker compose exec backend python /app/scripts/export_dhyanam_metadata.py

    # Export to file (recommended)
    docker compose exec backend python /app/scripts/export_dhyanam_metadata.py --pretty > dhyanam_metadata.json

Output includes:
    - verses: 9 Geeta Dhyanam verses with Sanskrit text and TTS descriptions
    - export_info: Verse count and metadata for Colab

Workflow:
    1. Run this script to export dhyanam metadata
    2. Upload JSON to Colab notebook (indic_parler_tts_dhyanam.ipynb)
    3. Run TTS generation in Colab
    4. Download WAV zip and process with process_dhyanam_audio.py

Note: Uses static data from geeta_dhyanam.py - no database access required.
"""

import argparse
import json
import sys

# When running inside Docker, /app is the backend directory
sys.path.insert(0, "/app")

from data.geeta_dhyanam import get_geeta_dhyanam
from data.verse_audio_metadata.text_normalizer import normalize_for_tts
from data.verse_audio_metadata.tts_description_builder import (
    build_dhyana_shloka_description,
)

# =============================================================================
# TTS Description Mapping by Theme
# =============================================================================

THEME_DESCRIPTIONS = {
    # Verse 1: Invocation to Geeta as divine mother
    "Invocation to Geeta as divine mother": (
        "Aryan speaks in a slow, deeply reverential tone with measured pauses. "
        "Low pitch, meditative pacing with devotional warmth. "
        "Very clear audio with no background noise."
    ),
    # Verse 2: Homage to Sage Vyasa
    "Homage to Sage Vyasa": (
        "Aryan speaks with respectful, grateful tone at a slow pace. "
        "Warm, honoring delivery with slight pauses. "
        "Very clear audio with no background noise."
    ),
    # Verse 3: Salutation to Krishna (wish-fulfiller)
    "Salutation to Krishna (wish-fulfiller)": (
        "Aryan speaks with devotional warmth and gentle expressivity. "
        "Slow, tender pacing with reverent undertone. "
        "Very clear audio with no background noise."
    ),
    # Verse 4: Geeta as milk of Upanishads (famous metaphor)
    "Geeta as milk of Upanishads (famous metaphor)": (
        "Aryan speaks with contemplative, teaching tone at measured pace. "
        "Clear, deliberate delivery with poetic resonance. "
        "Very clear audio with no background noise."
    ),
    # Verse 5: Krishna as Jagadguru (World Teacher)
    "Krishna as Jagadguru (World Teacher)": (
        "Aryan speaks with command emotion and steady authority. "
        "Slow, powerful delivery with deep reverence. "
        "Very clear audio with no background noise."
    ),
    # Verse 6: War as river, Krishna as boatman
    "War as river, Krishna as boatman": (
        "Aryan speaks with dramatic, narrative tone at moderate pace. "
        "Vivid, descriptive delivery with building intensity. "
        "Very clear audio with no background noise."
    ),
    # Verse 7: Mahabharata as divine lotus
    "Mahabharata as divine lotus": (
        "Aryan speaks with poetic, contemplative tone. "
        "Flowing, lyrical delivery at slow pace. "
        "Very clear audio with no background noise."
    ),
    # Verse 8: Power of divine grace
    "Power of divine grace": (
        "Aryan speaks with humble, awestruck tone. "
        "Slow, softly powerful delivery with wonder. "
        "Very clear audio with no background noise."
    ),
    # Verse 9: Final prostration to the infinite
    "Final prostration to the infinite": (
        "Aryan speaks with profound reverence and culminating devotion. "
        "Slow, deeply meditative tone with overwhelming surrender. "
        "Very clear audio with no background noise."
    ),
}


def get_tts_description(theme: str) -> str:
    """Get TTS description for a dhyanam verse by its theme."""
    # Try exact match first
    if theme in THEME_DESCRIPTIONS:
        return THEME_DESCRIPTIONS[theme]
    # Fall back to default dhyana shloka description
    return build_dhyana_shloka_description()


def export_dhyanam() -> dict:
    """Export Geeta Dhyanam metadata for TTS generation."""
    dhyanam_verses = get_geeta_dhyanam()

    verses_data = {}
    verse_metadata = []

    for verse in dhyanam_verses:
        # Create canonical ID for dhyanam verses
        canonical_id = f"DHYANAM_{verse['verse_number']:02d}"

        # Normalize Sanskrit text for TTS
        # (Remove verse numbering, fix dandis, etc.)
        normalized_text = normalize_for_tts(verse["sanskrit"])

        verses_data[canonical_id] = normalized_text

        # Build metadata with TTS description
        metadata = {
            "canonical_id": canonical_id,
            "verse_number": verse["verse_number"],
            "theme": verse["theme"],
            "tts_description": get_tts_description(verse["theme"]),
            # Include original Sanskrit for reference
            "sanskrit_original": verse["sanskrit"],
        }
        verse_metadata.append(metadata)

    return {
        "verses": verses_data,
        "metadata": verse_metadata,
        "export_info": {
            "type": "geeta_dhyanam",
            "verse_count": len(verse_metadata),
            "description": "9 sacred invocation verses recited before Geeta study",
            "voice": "Aryan (Indic Parler-TTS)",
            "output_dir": "audio/dhyanam",
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export Geeta Dhyanam metadata for TTS generation"
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args()

    data = export_dhyanam()

    indent = 2 if args.pretty else None
    print(json.dumps(data, ensure_ascii=False, indent=indent))


if __name__ == "__main__":
    main()
