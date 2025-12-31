"""
Verse Audio Metadata - Code-first curation for TTS generation.

This package provides the infrastructure for curating verse-by-verse
audio generation metadata. It follows a code-first pattern where
metadata is authored in Python files and synced to the database.

Usage:
    from data.verse_audio_metadata import (
        get_verse_metadata,
        get_chapter_metadata,
        get_all_metadata,
        build_tts_description,
    )

    # Get metadata for a specific verse
    metadata = get_verse_metadata("BG_2_47")

    # Build TTS description from metadata
    description = build_tts_description(metadata)

Structure:
    - enums.py: Valid enum values (matches DB constraints)
    - defaults.py: Default values by speaker/chapter
    - maha_vakyas.py: Special treatment verses
    - tts_description_builder.py: Build Parler-TTS descriptions
    - chapter_NN.py: Per-chapter verse metadata (added as curated)
"""

from typing import Optional

from .defaults import (
    CHAPTER_DEFAULTS,
    GLOBAL_DEFAULTS,
    SPEAKER_DEFAULTS,
    get_defaults_for_verse,
)
from .enums import (
    VALID_EMOTIONAL_TONES,
    VALID_SPEAKERS,
    VALID_THEOLOGICAL_WEIGHTS,
    validate_metadata,
)
from .maha_vakyas import (
    KEY_TEACHING_VERSES,
    MAHA_VAKYAS,
    get_maha_vakya_config,
    get_theological_weight,
    is_key_teaching,
    is_maha_vakya,
)
from .tts_description_builder import (
    PRESET_DESCRIPTIONS,
    build_tts_description,
    get_preset_description,
)

# Registry of curated chapter metadata
# Will be populated as chapter_NN.py files are added
_CHAPTER_METADATA: dict[int, dict[str, dict]] = {}


def register_chapter_metadata(chapter: int, metadata: dict[str, dict]) -> None:
    """
    Register metadata for a chapter.

    Called by chapter_NN.py modules to add their metadata to the registry.

    Args:
        chapter: Chapter number (1-18)
        metadata: Dict mapping canonical_id to verse metadata
    """
    _CHAPTER_METADATA[chapter] = metadata


def get_verse_metadata(canonical_id: str) -> dict:
    """
    Get metadata for a specific verse.

    Resolution order:
    1. Explicit chapter metadata (if curated)
    2. Maha vakya config (if applicable)
    3. Computed defaults

    Args:
        canonical_id: Verse identifier like "BG_2_47"

    Returns:
        Complete metadata dict for the verse
    """
    # Parse canonical_id
    parts = canonical_id.split("_")
    if len(parts) < 3:
        raise ValueError(f"Invalid canonical_id: {canonical_id}")

    chapter = int(parts[1])

    # Check for explicit chapter metadata
    if chapter in _CHAPTER_METADATA:
        chapter_data = _CHAPTER_METADATA[chapter]
        if canonical_id in chapter_data:
            return chapter_data[canonical_id].copy()

    # Check for maha vakya config
    mv_config = get_maha_vakya_config(canonical_id)
    if mv_config:
        result = get_defaults_for_verse(
            canonical_id, mv_config.get("speaker", "krishna")
        )
        result.update(mv_config)
        return result

    # Fall back to computed defaults
    result = get_defaults_for_verse(canonical_id)

    # Apply theological weight
    result["theological_weight"] = get_theological_weight(canonical_id)

    return result


def get_chapter_metadata(chapter: int) -> dict[str, dict]:
    """
    Get all verse metadata for a chapter.

    Args:
        chapter: Chapter number (1-18)

    Returns:
        Dict mapping canonical_id to metadata for each verse in the chapter
    """
    return _CHAPTER_METADATA.get(chapter, {}).copy()


def get_all_metadata() -> dict[str, dict]:
    """
    Get all curated verse metadata across all chapters.

    Returns:
        Dict mapping canonical_id to metadata for all curated verses
    """
    result = {}
    for chapter_data in _CHAPTER_METADATA.values():
        result.update(chapter_data)
    return result


def get_curated_chapters() -> list[int]:
    """Get list of chapters that have been curated."""
    return sorted(_CHAPTER_METADATA.keys())


def get_verse_count_by_chapter() -> dict[int, int]:
    """Get count of curated verses per chapter."""
    return {ch: len(data) for ch, data in _CHAPTER_METADATA.items()}


# Export public API
__all__ = [
    # Enums
    "VALID_SPEAKERS",
    "VALID_EMOTIONAL_TONES",
    "VALID_THEOLOGICAL_WEIGHTS",
    "validate_metadata",
    # Defaults
    "GLOBAL_DEFAULTS",
    "SPEAKER_DEFAULTS",
    "CHAPTER_DEFAULTS",
    "get_defaults_for_verse",
    # Maha vakyas
    "MAHA_VAKYAS",
    "KEY_TEACHING_VERSES",
    "is_maha_vakya",
    "is_key_teaching",
    "get_theological_weight",
    "get_maha_vakya_config",
    # TTS
    "build_tts_description",
    "get_preset_description",
    "PRESET_DESCRIPTIONS",
    # Registry
    "register_chapter_metadata",
    "get_verse_metadata",
    "get_chapter_metadata",
    "get_all_metadata",
    "get_curated_chapters",
    "get_verse_count_by_chapter",
]
