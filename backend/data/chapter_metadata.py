"""
Book and Chapter metadata for the Bhagavad Geeta.

This file contains curated content for the Reading Mode experience:
- Book intro (cover page)
- Chapter intros (18 chapters)

Content authored with attention to:
- Accessibility for modern readers
- Authentic Sanskrit terminology with transliterations
- Concise but evocative descriptions
- Neutral, non-sectarian presentation

Sync to database via: POST /api/v1/admin/sync-metadata
"""

from typing import TypedDict


class BookMetadata(TypedDict):
    """Structure for the book intro / cover page."""

    sanskrit_title: str
    transliteration: str
    english_title: str
    tagline: str
    verse_count: int
    chapter_count: int
    intro_text: str


class ChapterMetadata(TypedDict, total=False):
    """Structure for chapter intro pages.

    Required fields are marked in the class; optional audio-related
    fields use total=False to allow gradual addition.
    """

    # Required fields (existing)
    chapter_number: int
    sanskrit_name: str
    transliteration: str
    english_title: str
    subtitle: str
    summary: str
    verse_count: int
    key_themes: list[str]

    # Hero verse: most representative/celebrated verse from the chapter
    # Used in chapter intro UI to give a taste of the chapter's essence
    hero_verse_id: str  # Format: "BG_chapter_verse" e.g., "BG_2_47"

    # Optional: Dhyana shloka (invocation verse for the chapter)
    # These are traditionally recited before studying each chapter
    dhyana_shloka_sanskrit: str  # Devanagari text
    dhyana_shloka_iast: str  # IAST transliteration
    dhyana_shloka_meaning: str  # English meaning
    dhyana_shloka_source: str  # "Geeta Dhyanam" / "Traditional"

    # Optional: Audio generation tracking
    audio_intro_path: str | None  # Path to generated intro audio
    audio_intro_duration_ms: int | None  # Duration in milliseconds


# =============================================================================
# BOOK METADATA (Cover Page)
# =============================================================================

BOOK_METADATA: BookMetadata = {
    "sanskrit_title": "श्रीमद्भगवद्गीता",
    "transliteration": "Śrīmad Bhagavad Gītā",
    "english_title": "The Song of the Divine",
    "tagline": "700 verses · 18 chapters · Timeless wisdom",
    "verse_count": 700,
    "chapter_count": 18,
    "intro_text": (
        "On the battlefield of Kurukshetra, at the threshold of a great war, "
        "the warrior prince Arjuna faces a crisis of conscience. His charioteer, "
        "Lord Krishna, responds not with simple comfort but with a profound teaching "
        "on duty, action, knowledge, and devotion—a dialogue that has guided seekers "
        "for over two millennia."
    ),
}


# =============================================================================
# CHAPTER METADATA (Chapter Intros)
# =============================================================================

CHAPTER_METADATA: list[ChapterMetadata] = [
    {
        "chapter_number": 1,
        "sanskrit_name": "अर्जुनविषादयोग",
        "transliteration": "Arjuna Viṣāda Yoga",
        "english_title": "The Yoga of Arjuna's Despair",
        "subtitle": "When duty and conscience collide",
        "summary": (
            "As the two armies stand ready for battle, Arjuna asks Krishna to drive "
            "his chariot between them. Seeing his teachers, grandfathers, and kinsmen "
            "arrayed on both sides, Arjuna is overcome with grief and refuses to fight. "
            "His bow slips from his hands."
        ),
        "verse_count": 47,
        "key_themes": ["moral crisis", "attachment", "compassion", "dharma conflict"],
        "hero_verse_id": "BG_1_47",  # Arjuna drops his bow in despair
    },
    {
        "chapter_number": 2,
        "sanskrit_name": "सांख्ययोग",
        "transliteration": "Sāṅkhya Yoga",
        "english_title": "The Yoga of Knowledge",
        "subtitle": "The eternal nature of the Self",
        "summary": (
            "Krishna begins his teaching by distinguishing the eternal Self from the "
            "perishable body. He introduces the foundational concept of acting without "
            "attachment to results—the heart of the Geeta's practical philosophy. "
            "This chapter contains many of the most celebrated verses."
        ),
        "verse_count": 72,
        "key_themes": ["immortal Self", "detachment", "karma yoga", "equanimity"],
        "hero_verse_id": "BG_2_47",  # Karma yoga essence - right to action, not fruits
    },
    {
        "chapter_number": 3,
        "sanskrit_name": "कर्मयोग",
        "transliteration": "Karma Yoga",
        "english_title": "The Yoga of Action",
        "subtitle": "Work as worship",
        "summary": (
            "Arjuna asks why he should engage in terrible action if knowledge is superior. "
            "Krishna explains that no one can remain actionless—even maintaining the body "
            "requires action. The path lies not in renouncing action but in acting without "
            "selfish attachment, offering all work as sacrifice."
        ),
        "verse_count": 43,
        "key_themes": ["selfless action", "duty", "sacrifice", "leadership by example"],
        "hero_verse_id": "BG_3_19",  # Work without attachment attains the Supreme
    },
    {
        "chapter_number": 4,
        "sanskrit_name": "ज्ञानकर्मसंन्यासयोग",
        "transliteration": "Jñāna Karma Sannyāsa Yoga",
        "english_title": "The Yoga of Knowledge and Renunciation of Action",
        "subtitle": "The divine descent and the fire of knowledge",
        "summary": (
            "Krishna reveals that he has taught this eternal yoga before, age after age, "
            "whenever dharma declines. He describes how action performed with knowledge "
            "and detachment burns away karma like fire consumes fuel. The wise see "
            "inaction in action, and action in inaction."
        ),
        "verse_count": 42,
        "key_themes": [
            "divine incarnation",
            "knowledge as purifier",
            "guru",
            "sacrifice",
        ],
        "hero_verse_id": "BG_4_7",  # Yada yada hi dharmasya - divine descent
    },
    {
        "chapter_number": 5,
        "sanskrit_name": "कर्मसंन्यासयोग",
        "transliteration": "Karma Sannyāsa Yoga",
        "english_title": "The Yoga of Renunciation",
        "subtitle": "The harmony of paths",
        "summary": (
            "Arjuna asks which is better: the renunciation of action or disciplined action. "
            "Krishna teaches that both lead to liberation, but yoga of action is superior "
            "for most seekers. The wise person acts with senses controlled, seeing all "
            "beings equally, untouched by results like a lotus leaf by water."
        ),
        "verse_count": 29,
        "key_themes": ["renunciation", "equality", "inner peace", "true sannyasa"],
        "hero_verse_id": "BG_5_18",  # Equal vision - brahmin, cow, elephant, dog
    },
    {
        "chapter_number": 6,
        "sanskrit_name": "ध्यानयोग",
        "transliteration": "Dhyāna Yoga",
        "english_title": "The Yoga of Meditation",
        "subtitle": "Mastering the restless mind",
        "summary": (
            "Krishna describes the practice of meditation: the proper seat, posture, "
            "and technique for stilling the mind. He acknowledges the mind's restlessness "
            "but assures that it can be controlled through practice and detachment. "
            "Even the yogi who falls from the path is not lost."
        ),
        "verse_count": 47,
        "key_themes": [
            "meditation",
            "self-discipline",
            "mind control",
            "gradual progress",
        ],
        "hero_verse_id": "BG_6_5",  # Self as friend and enemy
    },
    {
        "chapter_number": 7,
        "sanskrit_name": "ज्ञानविज्ञानयोग",
        "transliteration": "Jñāna Vijñāna Yoga",
        "english_title": "The Yoga of Knowledge and Realization",
        "subtitle": "The manifest and unmanifest Divine",
        "summary": (
            "Krishna reveals his higher and lower natures—the material elements and the "
            "conscious life force that sustains all beings. Among thousands of seekers, "
            "perhaps one truly knows him. Four types of virtuous people worship him, "
            "but the wise devotee who knows his essential nature is most dear."
        ),
        "verse_count": 30,
        "key_themes": ["divine nature", "maya", "devotion", "rare knowledge"],
        "hero_verse_id": "BG_7_7",  # All strung on Me like pearls on a thread
    },
    {
        "chapter_number": 8,
        "sanskrit_name": "अक्षरब्रह्मयोग",
        "transliteration": "Akṣara Brahma Yoga",
        "english_title": "The Yoga of the Imperishable Absolute",
        "subtitle": "The moment of death and beyond",
        "summary": (
            "Arjuna asks about Brahman, the Self, karma, and the gods. Krishna explains "
            "that whatever one remembers at the moment of death determines one's next state. "
            "Those who remember him at death attain him. He describes the cosmic cycles "
            "of creation and the path of no return."
        ),
        "verse_count": 28,
        "key_themes": ["death", "remembrance", "cosmic cycles", "liberation"],
        "hero_verse_id": "BG_8_6",  # Whatever one remembers at death...
    },
    {
        "chapter_number": 9,
        "sanskrit_name": "राजविद्याराजगुह्ययोग",
        "transliteration": "Rāja Vidyā Rāja Guhya Yoga",
        "english_title": "The Yoga of Royal Knowledge and Royal Secret",
        "subtitle": "The sovereign mystery",
        "summary": (
            "Krishna shares the most confidential knowledge: he pervades the entire "
            "universe yet is not bound by it. All beings rest in him as the wind rests "
            "in space. With simple devotion—a leaf, a flower, fruit, or water—anyone "
            "can reach him. He is equally disposed to all, yet his devotees are in him."
        ),
        "verse_count": 34,
        "key_themes": ["supreme secret", "devotion", "universal presence", "grace"],
        "hero_verse_id": "BG_9_22",  # Yoga-kshema - I carry what they lack
    },
    {
        "chapter_number": 10,
        "sanskrit_name": "विभूतियोग",
        "transliteration": "Vibhūti Yoga",
        "english_title": "The Yoga of Divine Manifestations",
        "subtitle": "The glory pervading all things",
        "summary": (
            "To strengthen Arjuna's devotion, Krishna describes his divine glories—he is "
            "the source from which all beings emanate. Among the Adityas, he is Vishnu; "
            "among lights, the sun; among words, the syllable Om. Whatever is glorious, "
            "powerful, or beautiful springs from but a spark of his splendor."
        ),
        "verse_count": 42,
        "key_themes": ["divine glories", "omnipresence", "excellence", "wonder"],
        "hero_verse_id": "BG_10_20",  # I am the Self in all beings
    },
    {
        "chapter_number": 11,
        "sanskrit_name": "विश्वरूपदर्शनयोग",
        "transliteration": "Viśvarūpa Darśana Yoga",
        "english_title": "The Yoga of the Vision of the Universal Form",
        "subtitle": "The terrifying and wondrous cosmic vision",
        "summary": (
            "Arjuna asks to see Krishna's divine form. Krishna grants him divine eyes "
            "to behold the universe contained within his body—all beings, all gods, "
            "all times. Arjuna sees creation and destruction, and is overwhelmed with "
            "awe and terror. He begs Krishna to return to his gentle human form."
        ),
        "verse_count": 55,
        "key_themes": [
            "cosmic form",
            "time as destroyer",
            "divine vision",
            "surrender",
        ],
        "hero_verse_id": "BG_11_32",  # Kalo'smi - I am Time, the destroyer
    },
    {
        "chapter_number": 12,
        "sanskrit_name": "भक्तियोग",
        "transliteration": "Bhakti Yoga",
        "english_title": "The Yoga of Devotion",
        "subtitle": "The path of love",
        "summary": (
            "Arjuna asks who is the better yogi: one who worships the personal form "
            "or the formless Absolute? Krishna affirms that both paths lead to him, "
            "but the path of devotion to his personal form is easier for embodied beings. "
            "He describes the qualities that make a devotee dear to him."
        ),
        "verse_count": 20,
        "key_themes": [
            "devotion",
            "personal vs impersonal",
            "qualities of devotee",
            "love",
        ],
        "hero_verse_id": "BG_12_13",  # Qualities of a devotee dear to Me
    },
    {
        "chapter_number": 13,
        "sanskrit_name": "क्षेत्रक्षेत्रज्ञविभागयोग",
        "transliteration": "Kṣetra Kṣetrajña Vibhāga Yoga",
        "english_title": "The Yoga of the Field and the Knower",
        "subtitle": "Matter and consciousness distinguished",
        "summary": (
            "Krishna distinguishes between the field (the body and material nature) and "
            "the knower of the field (the conscious Self). He describes what constitutes "
            "true knowledge: humility, non-violence, equanimity, devotion. One who truly "
            "understands this distinction is liberated."
        ),
        "verse_count": 35,
        "key_themes": [
            "body and Self",
            "true knowledge",
            "prakriti and purusha",
            "discrimination",
        ],
        "hero_verse_id": "BG_13_2",  # Know Me as the Knower of the field
    },
    {
        "chapter_number": 14,
        "sanskrit_name": "गुणत्रयविभागयोग",
        "transliteration": "Guṇatraya Vibhāga Yoga",
        "english_title": "The Yoga of the Three Gunas",
        "subtitle": "The three qualities of nature",
        "summary": (
            "Krishna explains the three gunas—sattva (goodness), rajas (passion), and "
            "tamas (inertia)—that bind the soul to the body. Sattva attaches through "
            "happiness, rajas through action, tamas through negligence. One who transcends "
            "all three through devotion attains liberation."
        ),
        "verse_count": 27,
        "key_themes": [
            "three gunas",
            "bondage",
            "transcendence",
            "qualities of nature",
        ],
        "hero_verse_id": "BG_14_5",  # Three gunas bind the soul to body
    },
    {
        "chapter_number": 15,
        "sanskrit_name": "पुरुषोत्तमयोग",
        "transliteration": "Puruṣottama Yoga",
        "english_title": "The Yoga of the Supreme Person",
        "subtitle": "The ultimate reality",
        "summary": (
            "Krishna describes the imperishable ashvattha tree with roots above and branches "
            "below—a metaphor for the material world. He who cuts this tree with the axe "
            "of detachment attains the supreme abode. Krishna is the Supreme Person, "
            "beyond both the perishable and imperishable."
        ),
        "verse_count": 20,
        "key_themes": [
            "supreme person",
            "world tree",
            "liberation",
            "ultimate reality",
        ],
        "hero_verse_id": "BG_15_15",  # I am in all hearts, memory and knowledge
    },
    {
        "chapter_number": 16,
        "sanskrit_name": "दैवासुरसम्पद्विभागयोग",
        "transliteration": "Daivāsura Sampad Vibhāga Yoga",
        "english_title": "The Yoga of Divine and Demonic Natures",
        "subtitle": "The two destinies",
        "summary": (
            "Krishna contrasts divine qualities (fearlessness, purity, compassion, "
            "non-violence) with demonic ones (pride, arrogance, anger, harshness). "
            "The divine lead to liberation, the demonic to bondage. Three gates lead "
            "to ruin: lust, anger, and greed. One should let scripture guide action."
        ),
        "verse_count": 24,
        "key_themes": [
            "divine qualities",
            "demonic qualities",
            "three gates of hell",
            "discernment",
        ],
        "hero_verse_id": "BG_16_1",  # Divine qualities - fearlessness, purity...
    },
    {
        "chapter_number": 17,
        "sanskrit_name": "श्रद्धात्रयविभागयोग",
        "transliteration": "Śraddhātraya Vibhāga Yoga",
        "english_title": "The Yoga of the Three Kinds of Faith",
        "subtitle": "Faith according to nature",
        "summary": (
            "Arjuna asks about those who worship with faith but ignore scriptural rules. "
            "Krishna explains that faith, like food, sacrifice, and austerity, takes three "
            "forms according to the gunas. Sattvic faith, food, and practice lead to purity "
            "and wisdom; rajasic to passion; tamasic to delusion."
        ),
        "verse_count": 28,
        "key_themes": ["three types of faith", "food", "austerity", "charity"],
        "hero_verse_id": "BG_17_3",  # Faith determines one's nature
    },
    {
        "chapter_number": 18,
        "sanskrit_name": "मोक्षसंन्यासयोग",
        "transliteration": "Mokṣa Sannyāsa Yoga",
        "english_title": "The Yoga of Liberation through Renunciation",
        "subtitle": "The final teaching",
        "summary": (
            "In this culminating chapter, Krishna summarizes his teaching. He distinguishes "
            "renunciation from tyaga (abandoning the fruits of action). He describes how "
            "each person should follow their own nature and duty. In the most intimate verse, "
            "he asks Arjuna to abandon all dharmas and surrender to him alone—he will liberate "
            "him from all sin."
        ),
        "verse_count": 78,
        "key_themes": [
            "renunciation",
            "surrender",
            "dharma",
            "liberation",
            "final instruction",
        ],
        "hero_verse_id": "BG_18_66",  # Sarva dharman - surrender to Me alone
    },
]


def get_book_metadata() -> BookMetadata:
    """Return the book intro metadata."""
    return BOOK_METADATA.copy()


def get_chapter_metadata(chapter_number: int) -> ChapterMetadata | None:
    """Return metadata for a specific chapter."""
    for chapter in CHAPTER_METADATA:
        if chapter["chapter_number"] == chapter_number:
            return chapter.copy()
    return None


def get_all_chapter_metadata() -> list[ChapterMetadata]:
    """Return metadata for all chapters."""
    return [ch.copy() for ch in CHAPTER_METADATA]
