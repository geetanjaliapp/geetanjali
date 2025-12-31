"""
Chapter 2: Sankhya Yoga - The Yoga of Knowledge

Dominant mood: Teaching, philosophical foundation
Speaker structure:
  - Verse 1: Sanjaya (narration - describes Arjuna's state)
  - Verse 2-3: Krishna (questions Arjuna's despondency)
  - Verses 4-10: Arjuna (despair, questions, surrender)
  - Verses 11-72: Krishna (the teaching begins)

Key themes:
  - Eternal soul (atman)
  - Karma Yoga introduction
  - Sthitaprajna (steady wisdom)

Maha Vakyas: 2.47, 2.48
Key Teachings: 2.11-14, 2.19-23, 2.62-63, 2.70

Audio generation notes:
- Verse 1: Sanjaya's narration - neutral, descriptive
- Verses 4-10: Arjuna's despair - sorrowful, gradually intensifying
- Verse 7: Pivotal surrender - special emphasis
- Verse 11: Krishna begins teaching - shift to compassionate authority
- Verses 47-53: Core karma yoga - slow, emphatic, measured
- Verses 54-72: Sthitaprajna - calm, meditative, profound
"""

from . import register_chapter_metadata

CHAPTER_2_METADATA: dict[str, dict] = {
    # ===========================================================================
    # VERSE 1: Sanjaya's Narration
    # ===========================================================================
    "BG_2_1": {
        "speaker": "sanjaya",
        "addressee": "dhritarashtra",
        "discourse_type": "narration",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Sanjaya describes Arjuna's state to Dhritarashtra. "
            "Eyes filled with tears, dejected, overwhelmed by compassion."
        ),
    },
    # ===========================================================================
    # VERSES 2-3: Krishna's Initial Response
    # ===========================================================================
    "BG_2_2": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "question",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Krishna's first words - questioning Arjuna's unworthy despondency. "
            "'Whence has this dejection come upon you at this critical hour?'"
        ),
    },
    "BG_2_3": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "declaration",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Krishna admonishes Arjuna - 'Do not yield to unmanliness. "
            "Shake off this paltry faint-heartedness and arise!'"
        ),
    },
    # ===========================================================================
    # VERSES 4-10: Arjuna's Despair and Surrender
    # ===========================================================================
    "BG_2_4": {
        "speaker": "arjuna",
        "addressee": "krishna",
        "discourse_type": "question",
        "emotional_tone": "sorrowful",
        "intensity": "soft",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Arjuna questions - how can I fight against Bhishma and Drona? "
            "Beginning of his moral dilemma articulation."
        ),
    },
    "BG_2_5": {
        "speaker": "arjuna",
        "addressee": "krishna",
        "discourse_type": "lament",
        "emotional_tone": "sorrowful",
        "intensity": "moderate",
        "pacing": "slow",
        "theological_weight": "standard",
        "context_notes": (
            "Arjuna considers living by begging rather than slaying teachers. "
            "Even victory would be stained with their blood."
        ),
    },
    "BG_2_6": {
        "speaker": "arjuna",
        "addressee": "krishna",
        "discourse_type": "lament",
        "emotional_tone": "sorrowful",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Arjuna expresses uncertainty - 'I do not know which is better for us.'"
        ),
    },
    "BG_2_7": {
        "speaker": "arjuna",
        "addressee": "krishna",
        "discourse_type": "prayer",
        "emotional_tone": "sorrowful",
        "intensity": "moderate",
        "pacing": "slow",
        "theological_weight": "key_teaching",
        "context_notes": (
            "PIVOTAL: Arjuna surrenders as disciple - 'I am your student. "
            "Teach me, for I have taken refuge in you.' "
            "The guru-shishya relationship formally begins."
        ),
    },
    "BG_2_8": {
        "speaker": "arjuna",
        "addressee": "krishna",
        "discourse_type": "lament",
        "emotional_tone": "sorrowful",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Arjuna admits even sovereignty over earth or heaven "
            "would not remove his grief."
        ),
    },
    "BG_2_9": {
        "speaker": "sanjaya",
        "addressee": "dhritarashtra",
        "discourse_type": "narration",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Sanjaya narrates: Arjuna declares 'I will not fight' and falls silent."
        ),
    },
    "BG_2_10": {
        "speaker": "sanjaya",
        "addressee": "dhritarashtra",
        "discourse_type": "narration",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "Sanjaya describes Krishna smiling and speaking to the grieving Arjuna."
        ),
    },
    # ===========================================================================
    # VERSES 11-30: Nature of the Self (Atman)
    # ===========================================================================
    "BG_2_11": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "discourse_context": "teaching_basic",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Krishna's teaching BEGINS. 'You grieve for those who should not be "
            "grieved for, yet speak words of wisdom.' The apparent contradiction."
        ),
    },
    "BG_2_12": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Eternal existence of all souls - 'Never was there a time when I did not exist.'"
        ),
    },
    "BG_2_13": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Soul passes through childhood, youth, old age - and to another body. "
            "The wise are not deluded."
        ),
    },
    "BG_2_14": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Sense contacts give pleasure and pain - they come and go. "
            "Endure them bravely, O Bharata."
        ),
    },
    "BG_2_15": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "One unmoved by pleasure and pain is fit for immortality.",
    },
    "BG_2_16": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "The unreal has no being; the real never ceases to be.",
    },
    "BG_2_17": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "That which pervades all is indestructible.",
    },
    "BG_2_18": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Bodies are perishable; the soul is eternal and immeasurable.",
    },
    "BG_2_19": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": ("Neither slays nor is slain - the soul is beyond killing."),
    },
    "BG_2_20": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "slow",
        "theological_weight": "key_teaching",
        "context_notes": (
            "The Self is never born, never dies. Unborn, eternal, changeless, ancient. "
            "One of the most important verses on atman."
        ),
    },
    "BG_2_21": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "question",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "How can one who knows the Self as indestructible cause death?",
    },
    "BG_2_22": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Famous garment analogy - as one casts off worn clothes and puts on new ones, "
            "so the soul casts off bodies."
        ),
    },
    "BG_2_23": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Weapons cannot cut, fire cannot burn, water cannot wet, wind cannot dry "
            "the Self. Powerful declaration of immortality."
        ),
    },
    "BG_2_24": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Eternal, all-pervading, stable, immovable, everlasting.",
    },
    "BG_2_25": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Unmanifest, inconceivable, unchanging - knowing this, grieve not.",
    },
    "BG_2_26": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Even if you think the Self constantly dies and is reborn, still grieve not.",
    },
    "BG_2_27": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Death is certain for the born; rebirth is certain for the dead.",
    },
    "BG_2_28": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "soft",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Beings are unmanifest in origin, manifest in between, unmanifest again.",
    },
    "BG_2_29": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "awe",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "Some behold the Self as a wonder, others hear of it as a wonder.",
    },
    "BG_2_30": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "The Self in all bodies is ever indestructible - grieve not.",
    },
    # ===========================================================================
    # VERSES 31-38: Kshatriya Duty
    # ===========================================================================
    "BG_2_31": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Considering your own dharma as a Kshatriya, you should not waver.",
    },
    "BG_2_32": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "A righteous war is like an open door to heaven for Kshatriyas.",
    },
    "BG_2_33": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "If you refuse this righteous battle, abandoning duty and honor, you will incur sin.",
    },
    "BG_2_34": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "People will speak of your everlasting dishonor.",
    },
    "BG_2_35": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Great warriors will think you fled from fear.",
    },
    "BG_2_36": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Your enemies will speak ill of your prowess - what could be more painful?",
    },
    "BG_2_37": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Slain, you gain heaven; victorious, you enjoy earth. Arise, resolved to fight!",
    },
    "BG_2_38": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": (
            "Treat pleasure and pain, gain and loss, victory and defeat alike. "
            "Prepare for battle and incur no sin."
        ),
    },
    # ===========================================================================
    # VERSES 39-53: Karma Yoga Introduction (Core Teaching)
    # ===========================================================================
    "BG_2_39": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": (
            "Transition to Yoga teaching - 'This wisdom of Sankhya I have declared; "
            "now hear of Yoga.'"
        ),
    },
    "BG_2_40": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "In Yoga, no effort is wasted; even a little protects from great fear.",
    },
    "BG_2_41": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "The resolute mind is one-pointed; the irresolute has many branches.",
    },
    "BG_2_42": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Critique of those attached to Vedic rituals for heavenly pleasures.",
    },
    "BG_2_43": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Those desiring enjoyments and power are deluded by ritualism.",
    },
    "BG_2_44": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Those attached to pleasure and power cannot attain steady wisdom.",
    },
    "BG_2_45": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "Transcend the three gunas, be free from opposites, established in sattva.",
    },
    "BG_2_46": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "For a knower of Brahman, the Vedas are like a small well when there is a flood.",
    },
    "BG_2_47": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "declaration",
        "discourse_context": "teaching_advanced",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "slow",
        "theological_weight": "maha_vakya",
        "context_notes": (
            "THE MOST FAMOUS VERSE - Karma Yoga essence. "
            "'Your right is to work only, never to the fruits.' "
            "Slow, emphatic delivery with pauses between padas."
        ),
        "tts_description_override": (
            "Aryan speaks with command emotion in a slow, deliberate pace. "
            "Strong, resonant delivery with slight pauses between phrases. "
            "Emphatic pronunciation. Very clear audio with no background noise."
        ),
    },
    "BG_2_48": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "slow",
        "theological_weight": "maha_vakya",
        "context_notes": (
            "Definition of Yoga - 'Perform action established in yoga, abandoning attachment. "
            "Yoga is equanimity.' Pairs with 2.47."
        ),
    },
    "BG_2_49": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Action for results is far inferior to yoga of wisdom.",
    },
    "BG_2_50": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "The wise, united in wisdom, cast off results. Yoga is skill in action.",
    },
    "BG_2_51": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "The wise, abandoning fruits of action, are freed from the bondage of rebirth.",
    },
    "BG_2_52": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "When your intellect crosses the mire of delusion, you become indifferent.",
    },
    "BG_2_53": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": (
            "When your mind stands unshaken in samadhi, you will attain yoga."
        ),
    },
    # ===========================================================================
    # VERSES 54-72: Sthitaprajna (Steady Wisdom)
    # ===========================================================================
    "BG_2_54": {
        "speaker": "arjuna",
        "addressee": "krishna",
        "discourse_type": "question",
        "emotional_tone": "neutral",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Arjuna's key question: 'What are the marks of one of steady wisdom? "
            "How does he speak, sit, walk?'"
        ),
    },
    "BG_2_55": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": (
            "When one gives up all desires of the mind and is content in the Self alone."
        ),
    },
    "BG_2_56": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "Undisturbed by sorrow, unattached to happiness, free from fear and anger.",
    },
    "BG_2_57": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "Without attachment anywhere, neither rejoicing nor hating.",
    },
    "BG_2_58": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "As a tortoise withdraws its limbs, so the sage withdraws senses.",
    },
    "BG_2_59": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Sense objects turn away from the abstinent, but the taste remains.",
    },
    "BG_2_60": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "The turbulent senses forcibly carry away the mind of even a wise striver.",
    },
    "BG_2_61": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Controlling all senses, sit in yoga, intent on Me as the Supreme.",
    },
    "BG_2_62": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "The chain of destruction begins: Contemplating sense objects leads to attachment."
        ),
    },
    "BG_2_63": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "strong",
        "pacing": "measured",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Continuation: anger → delusion → memory loss → intellect destruction → ruin. "
            "Famous chain of self-destruction."
        ),
    },
    "BG_2_64": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "Self-controlled among objects, with senses under control, attains peace.",
    },
    "BG_2_65": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "In peace, all sorrows are destroyed; the serene intellect becomes steady.",
    },
    "BG_2_66": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "For the uncontrolled, there is no wisdom or meditation, no peace or happiness.",
    },
    "BG_2_67": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "The mind following wandering senses carries away wisdom like wind a boat.",
    },
    "BG_2_68": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "moderate",
        "theological_weight": "standard",
        "context_notes": "One who restrains senses from objects has steady wisdom.",
    },
    "BG_2_69": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "authoritative",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "What is night for all beings is day for the sage; what is day for beings is night for the sage.",
    },
    "BG_2_70": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "slow",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Famous ocean analogy: As waters enter the ocean without disturbing it, "
            "so desires enter the sage without disturbing him. Peace for the desireless."
        ),
    },
    "BG_2_71": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "teaching",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "measured",
        "theological_weight": "standard",
        "context_notes": "One who gives up all desires, without craving, without ego - he attains peace.",
    },
    "BG_2_72": {
        "speaker": "krishna",
        "addressee": "arjuna",
        "discourse_type": "declaration",
        "emotional_tone": "compassionate",
        "intensity": "moderate",
        "pacing": "slow",
        "theological_weight": "key_teaching",
        "context_notes": (
            "Chapter conclusion: This is the Brahmi state. Established in it at death, "
            "one attains Brahma-nirvana. Climactic closing."
        ),
    },
}


# Register with the main metadata system
register_chapter_metadata(2, CHAPTER_2_METADATA)


def get_chapter_2_metadata() -> dict[str, dict]:
    """Return metadata for Chapter 2 verses."""
    return CHAPTER_2_METADATA.copy()
