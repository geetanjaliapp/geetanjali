"""
Geeta Dhyanam - Nine invocation verses traditionally recited before studying the Bhagavad Geeta.

These nine shlokas are a complete set, not chapter-specific. They are traditionally
recited as a single invocation before beginning study of the Geeta.

Content includes:
- Sanskrit (Devanagari)
- IAST transliteration
- English translation
- Hindi translation (authentic, from traditional commentaries)
- Theme/purpose of each verse

Sources:
- Geeta Mahatmya (Padma Purana)
- Traditional Vedantic commentaries
- Sanskrit texts from Gita Press, Gorakhpur

Usage: Display on Book Intro page in a horizontal scroll carousel.
"""

from typing import TypedDict


class GeetaDhyanamVerse(TypedDict):
    """Structure for a single Geeta Dhyanam verse."""

    verse_number: int
    sanskrit: str
    iast: str
    english: str
    hindi: str
    theme: str
    duration_ms: int  # Audio duration in milliseconds (for auto-advance timing)
    audio_url: str  # Path to pre-generated audio file


# =============================================================================
# GEETA DHYANAM - 9 SACRED INVOCATION VERSES
# =============================================================================

GEETA_DHYANAM: list[GeetaDhyanamVerse] = [
    {
        "verse_number": 1,
        "sanskrit": (
            "ॐ पार्थाय प्रतिबोधितां भगवता नारायणेन स्वयं\n"
            "व्यासेन ग्रथितां पुराणमुनिना मध्ये महाभारतम् ।\n"
            "अद्वैतामृतवर्षिणीं भगवतीमष्टादशाध्यायिनीं\n"
            "अम्ब त्वामनुसन्दधामि भगवद्गीते भवद्वेषिणीम् ॥१॥"
        ),
        "iast": (
            "oṁ pārthāya pratibodhitāṁ bhagavatā nārāyaṇena svayaṁ\n"
            "vyāsena grathitāṁ purāṇamuninā madhye mahābhāratam |\n"
            "advaitāmṛtavarṣiṇīṁ bhagavatīm aṣṭādaśādhyāyinīṁ\n"
            "amba tvām anusandadhāmi bhagavadgīte bhavadveṣiṇīm ||1||"
        ),
        "english": (
            "O Bhagavad Geeta, imparted to Arjuna by Lord Narayana Himself, "
            "woven into the Mahabharata by sage Vyasa, showering the nectar of "
            "non-dual wisdom across eighteen chapters—O Divine Mother, destroyer "
            "of rebirth, I meditate upon you."
        ),
        "hindi": (
            "जिसे स्वयं भगवान नारायण ने अर्जुन को प्रबोध प्रदान किया, जिसे पुराण मुनि "
            "वेदव्यास ने महाभारत के मध्य में संकलित किया, जो अद्वैत अमृत की वर्षा करने "
            "वाली है, अठारह अध्यायों वाली भगवती है—हे माता भगवद्गीते! मैं तुम्हारा ध्यान "
            "करता हूँ, जो संसार के बंधन को नष्ट करने वाली हो।"
        ),
        "theme": "Invocation to Geeta as divine mother",
        "duration_ms": 18773,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_01.mp3",
    },
    {
        "verse_number": 2,
        "sanskrit": (
            "नमोऽस्तु ते व्यास विशालबुद्धे\n"
            "फुल्लारविन्दायतपत्रनेत्रे ।\n"
            "येन त्वया भारततैलपूर्णः\n"
            "प्रज्वालितो ज्ञानमयः प्रदीपः ॥२॥"
        ),
        "iast": (
            "namo'stu te vyāsa viśālabuddhe\n"
            "phullāravindāyatapatranetre |\n"
            "yena tvayā bhāratatailapūrṇaḥ\n"
            "prajvālito jñānamayaḥ pradīpaḥ ||2||"
        ),
        "english": (
            "Salutations to you, O Vyasa, of vast intellect, with eyes like the "
            "petals of a fully-bloomed lotus. By you, the lamp of knowledge has "
            "been lit, filled with the oil of the Mahabharata."
        ),
        "hindi": (
            "हे विशाल बुद्धि वाले व्यास! हे खिले हुए कमल की पंखुड़ी के समान विशाल "
            "नेत्रों वाले! आपको मेरा नमस्कार है। आपने महाभारत रूपी तेल से परिपूर्ण "
            "ज्ञान के दीपक को प्रज्वलित किया है।"
        ),
        "theme": "Homage to Sage Vyasa",
        "duration_ms": 11923,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_02.mp3",
    },
    {
        "verse_number": 3,
        "sanskrit": (
            "प्रपन्नपारिजाताय तोत्रवेत्रैकपाणये ।\n" "ज्ञानमुद्राय कृष्णाय गीतामृतदुहे नमः ॥३॥"
        ),
        "iast": (
            "prapannapārijātāya totravetraikapāṇaye |\n"
            "jñānamudrāya kṛṣṇāya gītāmṛtaduhe namaḥ ||3||"
        ),
        "english": (
            "Salutations to Krishna, the wish-fulfilling tree for those who "
            "surrender to Him, who holds the cowherd's staff, displays the "
            "gesture of wisdom, and milks the nectar of the Geeta."
        ),
        "hindi": (
            "शरणागतों के लिए पारिजात वृक्ष के समान, एक हाथ में गोपालक की छड़ी "
            "धारण करने वाले, ज्ञान मुद्रा धारण करने वाले, गीता रूपी अमृत का दोहन "
            "करने वाले श्रीकृष्ण को नमस्कार है।"
        ),
        "theme": "Salutation to Krishna (wish-fulfiller)",
        "duration_ms": 10228,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_03.mp3",
    },
    {
        "verse_number": 4,
        "sanskrit": (
            "सर्वोपनिषदो गावो दोग्धा गोपालनन्दनः ।\n"
            "पार्थो वत्सः सुधीर्भोक्ता दुग्धं गीतामृतं महत् ॥४॥"
        ),
        "iast": (
            "sarvopaniṣado gāvo dogdhā gopālanandanaḥ |\n"
            "pārtho vatsaḥ sudhīr bhoktā dugdhaṁ gītāmṛtaṁ mahat ||4||"
        ),
        "english": (
            "All the Upanishads are the cows; the milker is Krishna, the cowherd's "
            "son; Arjuna is the calf; the wise are the drinkers; and the milk is "
            "the supreme nectar of the Geeta."
        ),
        "hindi": (
            "समस्त उपनिषद गौएँ हैं, गोपालनन्दन श्रीकृष्ण दूध दोहने वाले हैं, अर्जुन "
            "बछड़ा है, बुद्धिमान साधक इस दूध के भोक्ता हैं, और यह महान गीतामृत ही "
            "वह दुग्ध है।"
        ),
        "theme": "Geeta as milk of Upanishads (famous metaphor)",
        "duration_ms": 8731,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_04.mp3",
    },
    {
        "verse_number": 5,
        "sanskrit": ("वसुदेवसुतं देवं कंसचाणूरमर्दनम् ।\n" "देवकीपरमानन्दं कृष्णं वन्दे जगद्गुरुम् ॥५॥"),
        "iast": (
            "vasudevasutaṁ devaṁ kaṁsacāṇūramardanam |\n"
            "devakīparamānandaṁ kṛṣṇaṁ vande jagadgurum ||5||"
        ),
        "english": (
            "I bow to Krishna, the son of Vasudeva, the divine Lord, the slayer "
            "of Kamsa and Chanura, the supreme joy of Devaki, the teacher of "
            "the world."
        ),
        "hindi": (
            "वसुदेव के पुत्र, कंस और चाणूर का वध करने वाले, माता देवकी को परम आनंद "
            "देने वाले, संपूर्ण जगत के गुरु भगवान श्रीकृष्ण को मैं वंदन करता हूँ।"
        ),
        "theme": "Krishna as Jagadguru (World Teacher)",
        "duration_ms": 8557,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_05.mp3",
    },
    {
        "verse_number": 6,
        "sanskrit": (
            "भीष्मद्रोणतटा जयद्रथजला गान्धारनीलोत्पला\n"
            "शल्यग्राहवती कृपेण वहनी कर्णेन वेलाकुला ।\n"
            "अश्वत्थामविकर्णघोरमकरा दुर्योधनावर्तिनी\n"
            "सोत्तीर्णा खलु पाण्डवैः रणनदी कैवर्तकः केशवः ॥६॥"
        ),
        "iast": (
            "bhīṣmadroṇataṭā jayadrathajalā gāndhāranīlotpalā\n"
            "śalyagrāhavatī kṛpeṇa vahanī karṇena velākulā |\n"
            "aśvatthāmavikarṇaghoramakarā duryodhanāvartinī\n"
            "sottīrṇā khalu pāṇḍavaiḥ raṇanadī kaivartakaḥ keśavaḥ ||6||"
        ),
        "english": (
            "The battle-river had Bhishma and Drona as its banks, Jayadratha as "
            "water, Shakuni as the blue lotus, Shalya as crocodile, Kripa as the "
            "current, Karna as waves, Ashvatthama and Vikarna as sea-monsters, "
            "Duryodhana as the whirlpool. The Pandavas crossed with Krishna as boatman."
        ),
        "hindi": (
            "जिस युद्ध रूपी नदी के दो तट भीष्म और द्रोण हैं, जयद्रथ जिसका जल है, "
            "गान्धार (शकुनि) नीलकमल है, शल्य मगरमच्छ है, कृपाचार्य प्रवाह है, कर्ण "
            "लहरों के समान है, अश्वत्थामा और विकर्ण भयानक मकर हैं, दुर्योधन भँवर है—"
            "उस भयंकर रणनदी को पाण्डवों ने पार किया, जिसके केवट (नाविक) स्वयं केशव थे।"
        ),
        "theme": "War as river, Krishna as boatman",
        "duration_ms": 18007,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_06.mp3",
    },
    {
        "verse_number": 7,
        "sanskrit": (
            "पाराशर्यवचः सरोजममलं गीतार्थगन्धोत्कटं\n"
            "नानाख्यानककेसरं हरिकथासम्बोधनाबोधितम् ।\n"
            "लोके सज्जनषट्पदैरहरहः पेपीयमानं मुदा\n"
            "भूयाद्भारतपङ्कजं कलिमलप्रध्वंसनं श्रेयसे ॥७॥"
        ),
        "iast": (
            "pārāśaryavacaḥ sarojam amalaṁ gītārthagandhotkaṭaṁ\n"
            "nānākhyānakakesaraṁ harikathāsambodhanābodhitam |\n"
            "loke sajjanaṣaṭpadair aharahaḥ pepīyamānaṁ mudā\n"
            "bhūyād bhāratapaṅkajaṁ kalimalapradhvaṁsanaṁ śreyase ||7||"
        ),
        "english": (
            "May the lotus of the Mahabharata, born from Vyasa's words, pure and "
            "fragrant with the Geeta's essence, bloomed through discourses on Lord "
            "Hari, drunk daily by virtuous souls like bees—may it destroy the "
            "impurities of Kali Yuga."
        ),
        "hindi": (
            "पराशर के पुत्र (वेदव्यास) के वचन रूपी यह निर्मल कमल, गीता के अर्थ रूपी "
            "सुगंध से परिपूर्ण है, विविध आख्यान इसकी केसर हैं, हरि की कथाओं से यह "
            "प्रबुद्ध है। संसार में सज्जन रूपी भौंरे प्रतिदिन आनंदपूर्वक इसका पान करते "
            "हैं। यह महाभारत रूपी कमल कलियुग के पापों का नाश करने वाला हो।"
        ),
        "theme": "Mahabharata as divine lotus",
        "duration_ms": 21200,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_07.mp3",
    },
    {
        "verse_number": 8,
        "sanskrit": (
            "मूकं करोति वाचालं पङ्गुं लङ्घयते गिरिम् ।\n" "यत्कृपा तमहं वन्दे परमानन्दमाधवम् ॥८॥"
        ),
        "iast": (
            "mūkaṁ karoti vācālaṁ paṅguṁ laṅghayate girim |\n"
            "yatkṛpā tam ahaṁ vande paramānandamādhavam ||8||"
        ),
        "english": (
            "I salute that Madhava (Krishna), the source of supreme bliss, by whose "
            "grace the mute becomes eloquent and the lame crosses over mountains."
        ),
        "hindi": (
            "जिनकी कृपा से गूँगे वाचाल हो जाते हैं और लँगड़े पर्वतों को लाँघ जाते हैं, "
            "उन परमानंद स्वरूप श्रीमाधव को मैं वंदन करता हूँ।"
        ),
        "theme": "Power of divine grace",
        "duration_ms": 8464,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_08.mp3",
    },
    {
        "verse_number": 9,
        "sanskrit": (
            "यं ब्रह्मा वरुणेन्द्ररुद्रमरुतः स्तुन्वन्ति दिव्यैः स्तवैः\n"
            "वेदैः साङ्गपदक्रमोपनिषदैर्गायन्ति यं सामगाः ।\n"
            "ध्यानावस्थिततद्गतेन मनसा पश्यन्ति यं योगिनो\n"
            "यस्यान्तं न विदुः सुरासुरगणा देवाय तस्मै नमः ॥९॥"
        ),
        "iast": (
            "yaṁ brahmā varuṇendrarudramarutaḥ stunvanti divyaiḥ stavaiḥ\n"
            "vedaiḥ sāṅgapadakramopaniṣadair gāyanti yaṁ sāmagāḥ |\n"
            "dhyānāvasthitatadgatena manasā paśyanti yaṁ yogino\n"
            "yasyāntaṁ na viduḥ surāsuragaṇā devāya tasmai namaḥ ||9||"
        ),
        "english": (
            "Salutations to that Supreme Lord whom Brahma, Varuna, Indra, Rudra, "
            "and the Maruts praise with divine hymns; whom the Sama Veda singers "
            "glorify; whom yogis behold in meditation; and whose limits neither "
            "gods nor demons know."
        ),
        "hindi": (
            "जिनकी स्तुति ब्रह्मा, वरुण, इन्द्र, रुद्र और मरुद्गण दिव्य स्तोत्रों से करते "
            "हैं; जिनका गायन सामवेद के गायक अंग, पद, क्रम और उपनिषदों सहित वेदों द्वारा "
            "करते हैं; जिनका दर्शन योगीजन ध्यान में स्थित एकाग्र मन से करते हैं; जिनके "
            "अंत को देवता और असुर गण भी नहीं जानते—उन परम देव को मेरा नमस्कार है।"
        ),
        "theme": "Final prostration to the infinite",
        "duration_ms": 21885,
        "audio_url": "/audio/mp3/dhyanam/DHYANAM_09.mp3",
    },
]

# Total duration of all 9 verses (for UI display)
GEETA_DHYANAM_TOTAL_DURATION_MS = sum(v["duration_ms"] for v in GEETA_DHYANAM)

# Total count for reference
GEETA_DHYANAM_COUNT = len(GEETA_DHYANAM)


def get_geeta_dhyanam() -> list[GeetaDhyanamVerse]:
    """Return all Geeta Dhyanam verses."""
    return [verse.copy() for verse in GEETA_DHYANAM]


def get_geeta_dhyanam_verse(verse_number: int) -> GeetaDhyanamVerse | None:
    """Return a specific Geeta Dhyanam verse by number (1-9)."""
    for verse in GEETA_DHYANAM:
        if verse["verse_number"] == verse_number:
            return verse.copy()
    return None
