"""
Build Parler-TTS description strings from verse metadata.

The description controls how Aryan (the AI4Bharat voice) speaks the verse.
Descriptions should include:
- Emotion (maps to Parler-TTS emotion support)
- Pacing (slow, moderate, measured)
- Intensity (pitch and expressivity)
- Audio quality directive

Reference emotions available in Indic Parler-TTS:
Command, Anger, Narration, Conversation, Disgust, Fear,
Happy, Neutral, News, Sad, Surprise

We map our emotional_tone enum to these TTS emotions.
"""


# =============================================================================
# Emotion Mapping (our enums -> Parler-TTS emotions)
# =============================================================================

EMOTION_MAP = {
    "neutral": "in a calm, clear tone",
    "compassionate": "with warmth and compassion",
    "authoritative": "with command emotion and steady authority",
    "sorrowful": "with sad emotion in a heavy, mournful tone",
    "fearful": "with fear emotion, voice trembling slightly",
    "joyful": "with happy emotion in an uplifting tone",
    "awe": "with surprise emotion and reverent wonder",
    "urgent": "with urgency and emphatic delivery",
}


# =============================================================================
# Pacing Mapping
# =============================================================================

PACING_MAP = {
    "slow": "at a slow, deliberate pace",
    "moderate": "at a moderate pace",
    "measured": "with measured, thoughtful pacing",
}


# =============================================================================
# Intensity Mapping (pitch and expressivity)
# =============================================================================

INTENSITY_MAP = {
    "soft": "with low pitch and gentle expressivity",
    "moderate": "with balanced pitch",
    "strong": "with slightly expressive delivery",
    "powerful": "with highly expressive, powerful delivery",
}


# =============================================================================
# Main Builder Function
# =============================================================================


def build_tts_description(metadata: dict) -> str:
    """
    Build Parler-TTS description from verse metadata.

    Args:
        metadata: Dict with keys like emotional_tone, pacing, intensity,
                  and optionally tts_description_override

    Returns:
        A natural language description for Parler-TTS
    """
    # Check for custom override first
    if metadata.get("tts_description_override"):
        return str(metadata["tts_description_override"])

    parts = ["Aryan speaks"]

    # Emotional tone
    emotional_tone = metadata.get("emotional_tone", "neutral")
    parts.append(EMOTION_MAP.get(emotional_tone, "in a calm tone"))

    # Pacing
    pacing = metadata.get("pacing", "moderate")
    parts.append(PACING_MAP.get(pacing, "at a moderate pace"))

    # Intensity
    intensity = metadata.get("intensity", "moderate")
    parts.append(INTENSITY_MAP.get(intensity, "with balanced pitch"))

    # Always end with audio quality directive
    parts.append("Very clear audio with no background noise.")

    return " ".join(parts)


# =============================================================================
# Preset Descriptions (for quick reference)
# =============================================================================

PRESET_DESCRIPTIONS = {
    "meditative": (
        "Aryan speaks in a calm, meditative tone with slow pace and "
        "clear pronunciation. Very clear audio with no background noise."
    ),
    "authoritative": (
        "Aryan speaks with command emotion and steady authority at a measured pace. "
        "Very clear audio with no background noise."
    ),
    "contemplative": (
        "Aryan speaks with thoughtful, measured pacing and balanced delivery. "
        "Clear pronunciation with slight pauses. Very clear audio."
    ),
    "devotional": (
        "Aryan speaks with warmth and gentle expressivity at a slow pace. "
        "Reverent, intimate tone. Very clear audio with no background noise."
    ),
    "intense": (
        "Aryan speaks with powerful delivery and emphatic expression. "
        "Strong, resonant voice. Very clear audio with no background noise."
    ),
    "sorrowful": (
        "Aryan speaks with sad emotion in a heavy, mournful tone at a slow pace. "
        "Soft, lamenting delivery. Very clear audio with no background noise."
    ),
    "cosmic": (
        "Aryan speaks with surprise emotion and overwhelming power. "
        "Deep, resonant delivery with awe. Very clear audio."
    ),
    "narration": (
        "Aryan speaks in a neutral, narrative tone at a moderate pace. "
        "Clear, descriptive delivery. Very clear audio with no background noise."
    ),
}


def get_preset_description(preset_name: str) -> str | None:
    """Get a preset description by name."""
    return PRESET_DESCRIPTIONS.get(preset_name)


# =============================================================================
# Special Case Builders
# =============================================================================


def build_dhyana_shloka_description() -> str:
    """Get description for dhyana shloka (invocation verse)."""
    return (
        "Aryan speaks in a slow, deeply reverential tone with measured pauses. "
        "Low pitch, meditative pacing. Very clear audio with no background noise."
    )


def build_maha_vakya_description(
    emotion: str = "authoritative", intensity: str = "strong"
) -> str:
    """Get description template for maha vakya (great utterance)."""
    emotion_text = EMOTION_MAP.get(emotion, "with authority")
    intensity_text = INTENSITY_MAP.get(intensity, "with strong delivery")

    return (
        f"Aryan speaks {emotion_text} at a slow, deliberate pace "
        f"{intensity_text}. Clear pronunciation with slight pauses for emphasis. "
        "Very clear audio."
    )


def build_question_description() -> str:
    """Get description for question verses (typically Arjuna)."""
    return (
        "Aryan speaks with questioning intonation and soft delivery. "
        "Moderate pace with thoughtful pauses. "
        "Very clear audio with no background noise."
    )


def build_lament_description() -> str:
    """Get description for lament verses (Arjuna's despair)."""
    return (
        "Aryan speaks with sad emotion in a heavy, anguished tone. "
        "Slow pace with trembling quality. Soft, sorrowful delivery. "
        "Very clear audio with no background noise."
    )
