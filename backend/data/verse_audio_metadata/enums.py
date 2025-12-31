"""
Valid enum values for verse audio metadata.

These values match the database constraints in VerseAudioMetadata model.
Use these constants when creating metadata to ensure validation passes.
"""

from typing import Literal

# Speaker - who is speaking the verse
Speaker = Literal["krishna", "arjuna", "sanjaya", "dhritarashtra"]

VALID_SPEAKERS: list[Speaker] = ["krishna", "arjuna", "sanjaya", "dhritarashtra"]

# Addressee - who is being addressed
Addressee = Literal["arjuna", "krishna", "dhritarashtra", "sanjaya", "assembly"]

VALID_ADDRESSEES: list[Addressee] = [
    "arjuna",
    "krishna",
    "dhritarashtra",
    "sanjaya",
    "assembly",
]

# Discourse type - the nature of the speech
DiscourseType = Literal[
    "teaching",  # Instructional content
    "question",  # Inquiry or doubt
    "declaration",  # Divine proclamation
    "lament",  # Expression of grief
    "vision",  # Describing divine vision
    "prayer",  # Supplication or praise
    "narration",  # Descriptive storytelling
]

VALID_DISCOURSE_TYPES: list[DiscourseType] = [
    "teaching",
    "question",
    "declaration",
    "lament",
    "vision",
    "prayer",
    "narration",
]

# Emotional tone - the primary emotion for TTS
EmotionalTone = Literal[
    "neutral",  # Balanced, even delivery
    "compassionate",  # Warm, caring
    "authoritative",  # Commanding, firm
    "sorrowful",  # Sad, grieving
    "fearful",  # Trembling, scared
    "joyful",  # Happy, uplifting
    "awe",  # Wonder, reverence
    "urgent",  # Emphatic, pressing
]

VALID_EMOTIONAL_TONES: list[EmotionalTone] = [
    "neutral",
    "compassionate",
    "authoritative",
    "sorrowful",
    "fearful",
    "joyful",
    "awe",
    "urgent",
]

# Intensity - how strongly to deliver
Intensity = Literal["soft", "moderate", "strong", "powerful"]

VALID_INTENSITIES: list[Intensity] = ["soft", "moderate", "strong", "powerful"]

# Pacing - speed of delivery
Pacing = Literal["slow", "moderate", "measured"]

VALID_PACINGS: list[Pacing] = ["slow", "moderate", "measured"]

# Theological weight - importance classification
TheologicalWeight = Literal["standard", "key_teaching", "maha_vakya"]

VALID_THEOLOGICAL_WEIGHTS: list[TheologicalWeight] = [
    "standard",  # Regular verse
    "key_teaching",  # Important philosophical point
    "maha_vakya",  # Great utterance - most significant verses
]


def is_valid_speaker(value: str) -> bool:
    """Check if speaker value is valid."""
    return value in VALID_SPEAKERS


def is_valid_emotional_tone(value: str) -> bool:
    """Check if emotional tone value is valid."""
    return value in VALID_EMOTIONAL_TONES


def is_valid_theological_weight(value: str) -> bool:
    """Check if theological weight value is valid."""
    return value in VALID_THEOLOGICAL_WEIGHTS


def validate_metadata(metadata: dict) -> list[str]:
    """Validate a verse metadata dict. Returns list of errors."""
    errors = []

    if metadata.get("speaker") not in VALID_SPEAKERS:
        errors.append(f"Invalid speaker: {metadata.get('speaker')}")

    if metadata.get("addressee") and metadata["addressee"] not in VALID_ADDRESSEES:
        errors.append(f"Invalid addressee: {metadata.get('addressee')}")

    if (
        metadata.get("discourse_type")
        and metadata["discourse_type"] not in VALID_DISCOURSE_TYPES
    ):
        errors.append(f"Invalid discourse_type: {metadata.get('discourse_type')}")

    if (
        metadata.get("emotional_tone")
        and metadata["emotional_tone"] not in VALID_EMOTIONAL_TONES
    ):
        errors.append(f"Invalid emotional_tone: {metadata.get('emotional_tone')}")

    if metadata.get("intensity") and metadata["intensity"] not in VALID_INTENSITIES:
        errors.append(f"Invalid intensity: {metadata.get('intensity')}")

    if metadata.get("pacing") and metadata["pacing"] not in VALID_PACINGS:
        errors.append(f"Invalid pacing: {metadata.get('pacing')}")

    if (
        metadata.get("theological_weight")
        and metadata["theological_weight"] not in VALID_THEOLOGICAL_WEIGHTS
    ):
        errors.append(
            f"Invalid theological_weight: {metadata.get('theological_weight')}"
        )

    return errors
