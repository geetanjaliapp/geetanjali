"""
Default verse audio metadata values.

Defaults are applied when a verse does not have explicit metadata.
Hierarchy: Explicit > Chapter defaults > Speaker defaults > Global defaults

This file establishes the baseline for TTS generation across the Geeta.
"""

from typing import TypedDict


class VerseAudioDefaults(TypedDict, total=False):
    """Type for default metadata values."""

    speaker: str
    addressee: str
    discourse_type: str
    discourse_context: str | None
    emotional_tone: str
    intensity: str
    pacing: str
    theological_weight: str


# =============================================================================
# Global Defaults (fallback for everything)
# =============================================================================

GLOBAL_DEFAULTS: VerseAudioDefaults = {
    "speaker": "krishna",
    "addressee": "arjuna",
    "discourse_type": "teaching",
    "discourse_context": None,
    "emotional_tone": "neutral",
    "intensity": "moderate",
    "pacing": "moderate",
    "theological_weight": "standard",
}


# =============================================================================
# Speaker-based Defaults
# =============================================================================

SPEAKER_DEFAULTS: dict[str, VerseAudioDefaults] = {
    "krishna": {
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
    },
    "arjuna": {
        "addressee": "krishna",
        "discourse_type": "question",
        "emotional_tone": "sorrowful",
        "intensity": "soft",
        "pacing": "moderate",
    },
    "sanjaya": {
        "addressee": "dhritarashtra",
        "discourse_type": "narration",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
    },
    "dhritarashtra": {
        "addressee": "sanjaya",
        "discourse_type": "question",
        "emotional_tone": "neutral",
        "intensity": "soft",
        "pacing": "moderate",
    },
}


# =============================================================================
# Chapter-based Defaults (for Krishna's verses primarily)
# =============================================================================

CHAPTER_DEFAULTS: dict[int, VerseAudioDefaults] = {
    # Chapter 1: Arjuna's Despair - mostly Sanjaya narration and Arjuna's grief
    1: {
        "emotional_tone": "sorrowful",
        "discourse_context": "battlefield_despair",
    },
    # Chapter 2: Sankhya Yoga - foundational teaching, gradual shift to authority
    2: {
        "emotional_tone": "compassionate",
        "discourse_context": "teaching_basic",
    },
    # Chapter 3: Karma Yoga - practical teaching on action
    3: {
        "emotional_tone": "compassionate",
        "discourse_context": "teaching_practical",
    },
    # Chapter 4: Jnana Yoga - divine revelation, historical context
    4: {
        "emotional_tone": "authoritative",
        "discourse_context": "revelation_divine",
    },
    # Chapter 5: Karma Sannyasa - comparing paths
    5: {
        "emotional_tone": "compassionate",
        "discourse_context": "teaching_comparative",
    },
    # Chapter 6: Dhyana Yoga - meditative instruction
    6: {
        "emotional_tone": "compassionate",
        "pacing": "slow",
        "discourse_context": "teaching_meditation",
    },
    # Chapter 7: Jnana Vijnana - esoteric knowledge
    7: {
        "emotional_tone": "authoritative",
        "discourse_context": "teaching_esoteric",
    },
    # Chapter 8: Aksara Brahma - cosmic knowledge, death/liberation
    8: {
        "emotional_tone": "authoritative",
        "discourse_context": "teaching_cosmic",
    },
    # Chapter 9: Raja Vidya - most confidential knowledge
    9: {
        "emotional_tone": "compassionate",
        "intensity": "strong",
        "discourse_context": "teaching_secret",
    },
    # Chapter 10: Vibhuti Yoga - divine manifestations
    10: {
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "discourse_context": "revelation_divine",
    },
    # Chapter 11: Vishwarupa - cosmic vision, overwhelming
    11: {
        "emotional_tone": "awe",
        "intensity": "powerful",
        "discourse_context": "revelation_cosmic",
    },
    # Chapter 12: Bhakti Yoga - devotional, intimate
    12: {
        "emotional_tone": "compassionate",
        "intensity": "soft",
        "discourse_context": "teaching_devotional",
    },
    # Chapter 13: Kshetra Kshetrajna - analytical teaching
    13: {
        "emotional_tone": "neutral",
        "discourse_context": "teaching_analytical",
    },
    # Chapter 14: Gunatraya - analytical on three gunas
    14: {
        "emotional_tone": "neutral",
        "discourse_context": "teaching_analytical",
    },
    # Chapter 15: Purushottama - supreme person revelation
    15: {
        "emotional_tone": "authoritative",
        "discourse_context": "teaching_esoteric",
    },
    # Chapter 16: Daiva Asura - contrasting natures
    16: {
        "emotional_tone": "authoritative",
        "discourse_context": "teaching_ethical",
    },
    # Chapter 17: Shraddhatraya - faith and its forms
    17: {
        "emotional_tone": "neutral",
        "discourse_context": "teaching_practical",
    },
    # Chapter 18: Moksha Sannyasa - culminating, intimate conclusion
    18: {
        "emotional_tone": "compassionate",
        "intensity": "strong",
        "discourse_context": "teaching_final",
    },
}


# =============================================================================
# Helper Functions
# =============================================================================


def get_defaults_for_verse(
    canonical_id: str, speaker: str = "krishna"
) -> VerseAudioDefaults:
    """
    Get merged defaults for a verse.

    Merge order (later overrides earlier):
    1. Global defaults
    2. Speaker defaults
    3. Chapter defaults

    Args:
        canonical_id: Verse identifier like "BG_2_47"
        speaker: Who is speaking the verse

    Returns:
        Merged defaults dict
    """
    # Extract chapter number from canonical_id (e.g., "BG_2_47" -> 2)
    parts = canonical_id.split("_")
    if len(parts) >= 2:
        try:
            chapter = int(parts[1])
        except ValueError:
            chapter = 0
    else:
        chapter = 0

    # Start with global defaults
    result: VerseAudioDefaults = GLOBAL_DEFAULTS.copy()

    # Merge speaker defaults
    if speaker in SPEAKER_DEFAULTS:
        result.update(SPEAKER_DEFAULTS[speaker])

    # Merge chapter defaults
    if chapter in CHAPTER_DEFAULTS:
        result.update(CHAPTER_DEFAULTS[chapter])

    # Ensure speaker is set correctly
    result["speaker"] = speaker

    return result


def get_chapter_emotional_arc(chapter: int) -> str:
    """Get a brief description of the emotional arc for a chapter."""
    arcs = {
        1: "grief → despair → surrender",
        2: "compassion → wisdom → equanimity",
        3: "questioning → clarity → duty",
        4: "revelation → wonder → acceptance",
        5: "inquiry → understanding → peace",
        6: "instruction → discipline → assurance",
        7: "teaching → mystery → devotion",
        8: "questioning → cosmic view → hope",
        9: "secret → intimacy → grace",
        10: "wonder → enumeration → awe",
        11: "request → vision → terror → surrender",
        12: "question → assurance → love",
        13: "inquiry → analysis → discrimination",
        14: "teaching → classification → transcendence",
        15: "metaphor → reality → supreme",
        16: "divine → demonic → discernment",
        17: "faith → practice → purity",
        18: "summary → renunciation → surrender → liberation",
    }
    return arcs.get(chapter, "teaching → understanding")
