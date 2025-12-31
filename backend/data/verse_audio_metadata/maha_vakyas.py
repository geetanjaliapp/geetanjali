"""
Maha Vakyas (Great Utterances) - Verses requiring special treatment.

These are the most significant verses in the Bhagavad Geeta, requiring
careful audio generation with emphasis, slower pacing, and special
TTS descriptions.

Classification:
- maha_vakya: Supreme importance (10-15 verses)
- key_teaching: Important philosophical points (30-40 verses)

The maha vakyas receive custom TTS descriptions to ensure
proper delivery of these profound teachings.
"""

from typing import TypedDict


class MahaVakyaConfig(TypedDict):
    """Configuration for a maha vakya verse."""

    canonical_id: str
    theological_weight: str  # "maha_vakya" or "key_teaching"
    emotional_tone: str
    intensity: str
    pacing: str
    context_notes: str
    tts_description_override: str | None


# =============================================================================
# Maha Vakyas (Great Utterances) - Supreme Importance
# =============================================================================

MAHA_VAKYAS: list[MahaVakyaConfig] = [
    # 2.47 - THE most famous verse: Karma Yoga essence
    {
        "canonical_id": "BG_2_47",
        "theological_weight": "maha_vakya",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "slow",
        "context_notes": (
            "The most quoted verse of the Geeta. Foundation of Karma Yoga. "
            "Requires slow, emphatic delivery with pauses between phrases."
        ),
        "tts_description_override": (
            "Aryan speaks with command emotion in a slow, deliberate pace. "
            "Strong, resonant delivery with slight pauses between phrases. "
            "Very clear audio with no background noise."
        ),
    },
    # 2.48 - Yoga definition: Equanimity in success/failure
    {
        "canonical_id": "BG_2_48",
        "theological_weight": "maha_vakya",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "slow",
        "context_notes": (
            "Definition of Yoga as equanimity. Pairs with 2.47 as core teaching."
        ),
        "tts_description_override": None,
    },
    # 4.7-8 - Divine incarnation (yada yada hi dharmasya)
    {
        "canonical_id": "BG_4_7",
        "theological_weight": "maha_vakya",
        "emotional_tone": "authoritative",
        "intensity": "powerful",
        "pacing": "measured",
        "context_notes": (
            "Krishna reveals his divine mission - 'Whenever dharma declines...'"
            "One of the most recited verses. Majestic, cosmic tone."
        ),
        "tts_description_override": (
            "Aryan speaks with command emotion and authority. "
            "Measured pace with powerful delivery. Majestic tone. "
            "Very clear audio with no background noise."
        ),
    },
    {
        "canonical_id": "BG_4_8",
        "theological_weight": "maha_vakya",
        "emotional_tone": "authoritative",
        "intensity": "powerful",
        "pacing": "measured",
        "context_notes": (
            "Continuation of divine mission - 'I manifest myself age after age.'"
        ),
        "tts_description_override": None,
    },
    # 9.22 - Divine providence (yoga-kshemam vahamyaham)
    {
        "canonical_id": "BG_9_22",
        "theological_weight": "maha_vakya",
        "emotional_tone": "compassionate",
        "intensity": "strong",
        "pacing": "slow",
        "context_notes": (
            "Promise of divine protection - 'I carry what they lack and preserve what they have.'"
            "Deeply devotional, intimate assurance."
        ),
        "tts_description_override": (
            "Aryan speaks with warmth and compassion in a slow pace. "
            "Gentle yet strong delivery. Intimate, reassuring tone. "
            "Very clear audio with no background noise."
        ),
    },
    # 11.32 - Time as destroyer (kalo'smi loka-kshaya-krit)
    {
        "canonical_id": "BG_11_32",
        "theological_weight": "maha_vakya",
        "emotional_tone": "awe",
        "intensity": "powerful",
        "pacing": "measured",
        "context_notes": (
            "Krishna as Time/Death - 'I am Time, the destroyer of worlds.'"
            "Made famous by Oppenheimer. Cosmic, overwhelming."
        ),
        "tts_description_override": (
            "Aryan speaks with surprise emotion and overwhelming power. "
            "Measured pace with deep, resonant delivery. Cosmic scale. "
            "Very clear audio with no background noise."
        ),
    },
    # 18.65 - Devotional surrender (man-mana bhava mad-bhakto)
    {
        "canonical_id": "BG_18_65",
        "theological_weight": "maha_vakya",
        "emotional_tone": "compassionate",
        "intensity": "strong",
        "pacing": "slow",
        "context_notes": (
            "Final teaching on devotion - 'Fix your mind on Me, be devoted to Me.'"
            "Intimate, personal instruction."
        ),
        "tts_description_override": None,
    },
    # 18.66 - Ultimate surrender (sarva-dharman parityajya)
    {
        "canonical_id": "BG_18_66",
        "theological_weight": "maha_vakya",
        "emotional_tone": "compassionate",
        "intensity": "powerful",
        "pacing": "slow",
        "context_notes": (
            "THE climactic verse - 'Abandon all dharmas and surrender to Me alone.'"
            "The supreme secret. Culmination of entire teaching."
        ),
        "tts_description_override": (
            "Aryan speaks with deep compassion and powerful conviction. "
            "Slow, deliberate pace with emphasis on each phrase. "
            "Intimate yet commanding. Very clear audio."
        ),
    },
]


# =============================================================================
# Key Teaching Verses (Important but not Maha Vakya level)
# =============================================================================

KEY_TEACHING_VERSES: list[str] = [
    # Chapter 2: Self and detachment
    "BG_2_11",  # Krishna's first teaching words
    "BG_2_12",  # Eternal existence of souls
    "BG_2_13",  # Soul passes through bodies
    "BG_2_14",  # Endure pleasure/pain
    "BG_2_19",  # Neither slays nor is slain
    "BG_2_20",  # Eternal, unborn Self
    "BG_2_22",  # Soul changes bodies like garments
    "BG_2_23",  # Indestructible Self
    "BG_2_62",  # Chain of attachment -> destruction
    "BG_2_63",  # Continuation of chain
    "BG_2_70",  # Ocean analogy for peace
    # Chapter 3: Karma Yoga
    "BG_3_9",  # Sacrifice without attachment
    "BG_3_19",  # Perform duty without attachment
    "BG_3_21",  # Leaders set example
    "BG_3_27",  # Gunas act, not the Self
    "BG_3_35",  # Better one's own dharma
    # Chapter 4: Knowledge
    "BG_4_18",  # Inaction in action
    "BG_4_33",  # Knowledge sacrifice
    "BG_4_34",  # Approach a teacher
    # Chapter 5: Renunciation
    "BG_5_18",  # Equal vision
    # Chapter 6: Meditation
    "BG_6_5",  # Elevate yourself by yourself
    "BG_6_6",  # Self is friend and enemy
    "BG_6_35",  # Mind controlled by practice
    # Chapter 7-9: Devotion and Knowledge
    "BG_7_7",  # Nothing higher than Me
    "BG_7_19",  # The wise surrender to Me
    "BG_8_7",  # Remember Me at all times
    # Chapter 10: Divine glories
    "BG_10_20",  # I am the Self in all
    "BG_10_41",  # Whatever is glorious...
    # Chapter 12: Bhakti
    "BG_12_13",  # Qualities of a devotee (start)
    "BG_12_14",
    "BG_12_15",
    "BG_12_18",
    "BG_12_19",
    "BG_12_20",
    # Chapter 13: Field and Knower
    "BG_13_2",  # Kshetra-kshetrajna
    "BG_13_28",  # Same Lord in all beings
    # Chapter 15: Supreme Person
    "BG_15_15",  # In the heart of all
    # Chapter 18: Conclusion
    "BG_18_55",  # By devotion one knows Me
    "BG_18_61",  # Lord dwells in the heart
    "BG_18_78",  # Where Krishna and Arjuna are...
]


# =============================================================================
# Helper Functions
# =============================================================================


def is_maha_vakya(canonical_id: str) -> bool:
    """Check if a verse is a maha vakya."""
    return any(mv["canonical_id"] == canonical_id for mv in MAHA_VAKYAS)


def is_key_teaching(canonical_id: str) -> bool:
    """Check if a verse is a key teaching."""
    return canonical_id in KEY_TEACHING_VERSES


def get_theological_weight(canonical_id: str) -> str:
    """Get the theological weight for a verse."""
    if is_maha_vakya(canonical_id):
        return "maha_vakya"
    if is_key_teaching(canonical_id):
        return "key_teaching"
    return "standard"


def get_maha_vakya_config(canonical_id: str) -> MahaVakyaConfig | None:
    """Get the full config for a maha vakya verse."""
    for mv in MAHA_VAKYAS:
        if mv["canonical_id"] == canonical_id:
            return mv
    return None


def get_all_special_verses() -> list[str]:
    """Get all verses with special treatment (maha vakya + key teaching)."""
    maha_vakya_ids = [mv["canonical_id"] for mv in MAHA_VAKYAS]
    return list(set(maha_vakya_ids + KEY_TEACHING_VERSES))
