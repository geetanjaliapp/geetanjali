"""
Normalize verse text for TTS generation.

Handles:
- Verse numbering removal (।।2.47।।)
- Line break normalization (double -> single)
- Speaker intro pause markers (adds comma for natural pause)
- Mid-verse dandi to comma (prevents TTS truncation)
- Speaker intros are KEPT (they should be recited)
"""

import re

# Pattern to match verse numbering at end: ।।2.47।। or ।।18.78। (1-2 trailing dandas)
VERSE_NUMBER_PATTERN = re.compile(r"।।\d+\.\d+।{1,2}\s*$")

# Pattern to match double newlines
DOUBLE_NEWLINE_PATTERN = re.compile(r"\n\n+")

# Pattern to match mid-verse dandi (followed by more text, with or without space)
# Replaces with comma to prevent TTS from treating as sentence end
MID_VERSE_DANDI_PATTERN = re.compile(r"।(?=\s*\S)")

# Known speaker intros (without dandi)
SPEAKER_INTROS = [
    "सञ्जय उवाच",
    "श्री भगवानुवाच",
    "अर्जुन उवाच",
    "धृतराष्ट्र उवाच",
]


def normalize_for_tts(text: str) -> str:
    """
    Normalize Sanskrit verse text for TTS generation.

    Transformations:
    1. Remove verse numbering at end (।।2.47।।)
    2. Replace mid-verse dandis with commas (prevents TTS truncation)
    3. Add comma after speaker intros for natural pause
    4. Replace double newlines with single space
    5. Strip leading/trailing whitespace

    Speaker intros (e.g., "सञ्जय उवाच") are preserved with pause marker.

    Args:
        text: Raw Sanskrit verse text from database

    Returns:
        Cleaned text suitable for TTS input
    """
    if not text:
        return ""

    # Remove verse numbering at end
    text = VERSE_NUMBER_PATTERN.sub("", text)

    # Replace mid-verse dandis with commas (BEFORE adding speaker intro dandis)
    # This prevents TTS from treating mid-verse dandi as sentence end
    text = MID_VERSE_DANDI_PATTERN.sub(",", text)

    # Add comma after speaker intros for natural pause
    for intro in SPEAKER_INTROS:
        # Match intro not already followed by comma or dandi
        pattern = re.compile(rf"({re.escape(intro)})(?!\s*[,।])")
        text = pattern.sub(r"\1,", text)

    # Replace double newlines with single space (keeps flow)
    text = DOUBLE_NEWLINE_PATTERN.sub(" ", text)

    # Normalize remaining whitespace
    text = " ".join(text.split())

    return text.strip()


def normalize_batch(verses: dict[str, str]) -> dict[str, str]:
    """
    Normalize a batch of verses.

    Args:
        verses: Dict mapping canonical_id to raw text

    Returns:
        Dict mapping canonical_id to normalized text
    """
    return {cid: normalize_for_tts(text) for cid, text in verses.items()}
