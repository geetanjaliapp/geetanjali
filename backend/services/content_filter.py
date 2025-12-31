"""Content filtering and moderation service.

Provides two layers of content moderation:
1. Pre-submission blocklist - Rejects obvious violations before database write
   - Explicit content patterns (sexual, violence)
   - Spam/gibberish detection
   - Profanity/abuse detection (direct offensive language)
2. LLM refusal detection - Detects when LLM refuses to process content

Design principles:
- Educational, not punitive messaging
- Minimal blocklist to reduce false positives
- No content logged (privacy protection)
- Configurable via environment variables
- Contextual profanity allowed (describing situations), direct abuse blocked

Configuration:
- CONTENT_FILTER_ENABLED: Master switch (default: True)
- CONTENT_FILTER_BLOCKLIST_ENABLED: Layer 1 switch (default: True)
- CONTENT_FILTER_PROFANITY_ENABLED: Layer 1 profanity check (default: True)
- CONTENT_FILTER_LLM_REFUSAL_DETECTION: Layer 2 switch (default: True)
"""

import copy
import logging
import re
from dataclasses import dataclass
from enum import Enum
from re import Pattern

from config import settings

logger = logging.getLogger(__name__)


class ViolationType(str, Enum):
    """Types of content policy violations."""

    EXPLICIT_SEXUAL = "explicit_sexual"
    EXPLICIT_VIOLENCE = "explicit_violence"
    SPAM_GIBBERISH = "spam_gibberish"
    PROFANITY_ABUSE = "profanity_abuse"
    LLM_REFUSAL = "llm_refusal"


@dataclass
class ContentCheckResult:
    """Result of content moderation check."""

    is_violation: bool
    violation_type: ViolationType | None = None
    # Never include the actual content - privacy protection


# ============================================================================
# Blocklist Patterns (Layer 1)
# ============================================================================

# Explicit sexual content patterns
# Kept minimal and focused to reduce false positives
# These are compiled regex patterns for performance
_EXPLICIT_SEXUAL_PATTERNS = [
    # Explicit acts
    r"\b(fuck|fucking|fucked)\b",
    r"\b(sex|sexual)\s+(act|position|fantasy|slave)",
    r"\b(orgasm|orgasmic|climax)\b",
    r"\b(masturbat|jerk\s*off|jack\s*off)",
    r"\b(penis|vagina|genitals?|cock|dick|pussy)\b",
    r"\b(erotic|pornograph|xxx)\b",
    r"\b(naked|nude)\s+(photo|pic|image|video)",
    r"\b(blow\s*job|hand\s*job|rim\s*job)\b",
    r"\b(anal|oral)\s+sex\b",
    r"\b(incest|bestiality|pedophil)\b",
]

# Explicit violence/harm patterns
_EXPLICIT_VIOLENCE_PATTERNS = [
    r"\b(kill|murder|assassinate)\s+(someone|him|her|them|people)\b",
    r"\b(torture|mutilate|dismember)\b",
    r"\bhow\s+to\s+(make|build)\s+(bomb|weapon|poison)\b",
    r"\b(mass\s+shooting|school\s+shooting)\b",
    r"\b(rape|sexual\s+assault)\s+(her|him|someone)\b",
]

# Spam/gibberish patterns
_SPAM_PATTERNS = [
    r"(.)\1{10,}",  # Same character repeated 10+ times
    r"^[^a-zA-Z]{20,}$",  # 20+ chars with no letters (gibberish numbers/symbols)
    r"[^a-zA-Z\s]{30,}",  # 30+ consecutive non-letter chars anywhere in text
    r"(https?://\S+\s*){5,}",  # 5+ URLs in sequence (link spam)
    r"([a-zA-Z])\1{5,}",  # Same letter repeated 6+ times (aaaaaaa, bbbbbbb)
]

# Compile all patterns for performance
_COMPILED_SEXUAL: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _EXPLICIT_SEXUAL_PATTERNS
]
_COMPILED_VIOLENCE: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _EXPLICIT_VIOLENCE_PATTERNS
]
_COMPILED_SPAM: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _SPAM_PATTERNS
]

# ============================================================================
# Profanity/Abuse Detection (Layer 1)
# ============================================================================
# Detects DIRECT abuse, not contextual mentions of profanity.
# "f*ck you" → blocked (direct abuse)
# "He said 'this is bullshit'" → allowed (describing situation)

# Standalone profanity patterns (for search - block any profanity)
_PROFANITY_PATTERNS = [
    r"\b(f+[uü*@4]+c*k+|fck|fuk|fcuk)\b",
    r"\b(sh[i1*]+t+|sh1t)\b",
    r"\b(a+[s$]+h[o0]+le)\b",
    r"\b(b[i1]+tch|b1tch)\b",
    r"\b(d[i1]+ck|c[o0]+ck|p[e3]+n[i1]+s)\b",
    r"\b(p[u*]+ss+y|c[u*]+nt)\b",
    r"\b(wh[o0]+re|sl[u*]+t)\b",
]

# Slurs (always blocked everywhere - search and consultation)
_SLUR_PATTERNS = [
    r"\b(n+[i1*]+gg+[ae3*]+r?s?)\b",
    r"\b(f+[a@4]+gg*[o0]+t+s?)\b",
    r"\b(r+[e3]+t+[a@4]+r+d+s?)\b",
    r"\b(ch[i1]+nk+s?)\b",
    r"\b(sp[i1]+c+s?)\b",
    r"\b(k[i1]+ke+s?)\b",
]

_COMPILED_PROFANITY: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _PROFANITY_PATTERNS
]
_COMPILED_SLURS: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _SLUR_PATTERNS
]

# Direct abuse patterns: profanity directed at the reader/system
_ABUSE_PATTERNS = [
    # Profanity + second person (direct attack)
    r"\b(f+[uü*@4]+c*k+|fck|fuk)\s*(you|u|off|this|that)\b",
    r"\b(you|u|ur)\s*(suck|f+[uü*@4]+c*k|fck|fuk|stink)\b",
    # Direct insults
    r"\b(you|u)\s+(are\s+)?(an?\s+)?(idiot|moron|stupid|dumb|retard)",
    r"\b(go\s+to\s+hell|kys|kill\s+yourself)\b",
    r"\b(you\s+should\s+die|just\s+die|go\s+die)\b",  # "die" only when directed at someone
    r"\b(stfu|gtfo|foad)\b",  # Common abuse acronyms
    # Slurs (always blocked, even in context)
    r"\b(n+[i1*]+gg+[ae3*]+r?|f+[a@4]+gg*[o0]+t|r+[e3]+t+[a@4]+r+d)\b",
]

_COMPILED_ABUSE: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _ABUSE_PATTERNS
]


def _check_profanity_abuse(text: str) -> bool:
    """
    Check for direct abusive language (not contextual profanity).

    This catches direct attacks like "f*ck you" while allowing
    contextual descriptions like "my boss said this is bullshit".

    Uses pattern matching for direct abuse + better-profanity for
    obfuscation detection (f4ck, sh1t, etc.).

    Known limitation: The second-person check looks for profanity AND
    second-person pronouns anywhere in the text, not adjacency. This means
    "You told me he called it bullshit" could be blocked even though the
    profanity isn't directed at the reader. This is a design tradeoff:
    - Fewer false negatives (real abuse gets through)
    - More false positives (legitimate use blocked)
    Given educational error messages and backend authority, we err on the
    side of blocking. A proper fix would require more sophisticated NLP.

    Args:
        text: Input text to check

    Returns:
        True if text contains direct abuse
    """
    # Check direct abuse patterns first (fast, regex-based)
    for pattern in _COMPILED_ABUSE:
        if pattern.search(text):
            return True

    # Use better-profanity for obfuscation detection
    # Only import when needed to avoid startup cost if disabled
    try:
        from better_profanity import profanity

        # Check if text contains profanity with obfuscation handling
        if profanity.contains_profanity(text):
            # Found profanity - check if it's directed at the reader
            # by looking for second-person patterns nearby
            text_lower = text.lower()
            second_person = r"\b(you|u|ur|yours?|yourself)\b"
            if re.search(second_person, text_lower):
                # Profanity + second person = likely abuse
                return True
    except ImportError:
        # better-profanity not installed, skip this check
        logger.debug("better-profanity not installed, skipping obfuscation check")

    return False


# Common English words for gibberish detection
# Small set of ~150 most common words - fast lookup, catches nonsense input
_COMMON_WORDS = frozenset(
    [
        # Articles, pronouns, prepositions
        "a",
        "an",
        "the",
        "i",
        "me",
        "my",
        "we",
        "our",
        "you",
        "your",
        "he",
        "she",
        "it",
        "they",
        "them",
        "his",
        "her",
        "its",
        "their",
        "this",
        "that",
        "these",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "from",
        "up",
        "out",
        "if",
        "or",
        "and",
        "but",
        "not",
        "no",
        "so",
        "as",
        "be",
        "am",
        "is",
        "are",
        "was",
        "were",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        # Common verbs
        "can",
        "could",
        "will",
        "would",
        "should",
        "may",
        "might",
        "must",
        "shall",
        "get",
        "got",
        "make",
        "made",
        "go",
        "going",
        "went",
        "come",
        "came",
        "take",
        "know",
        "think",
        "see",
        "want",
        "need",
        "feel",
        "try",
        "help",
        "tell",
        "ask",
        "work",
        "give",
        "find",
        "say",
        "said",
        "use",
        "let",
        "keep",
        "put",
        "set",
        # Common nouns
        "people",
        "person",
        "man",
        "woman",
        "child",
        "time",
        "year",
        "day",
        "way",
        "thing",
        "world",
        "life",
        "hand",
        "part",
        "place",
        "case",
        "week",
        "work",
        "fact",
        "point",
        "home",
        "job",
        "team",
        "family",
        "friend",
        "money",
        "issue",
        # Common adjectives
        "good",
        "new",
        "first",
        "last",
        "long",
        "great",
        "little",
        "own",
        "other",
        "old",
        "right",
        "big",
        "high",
        "small",
        "large",
        "next",
        "young",
        "important",
        "few",
        "public",
        "bad",
        "same",
        "able",
        "best",
        "better",
        "sure",
        "free",
        # Question words and common adverbs
        "what",
        "which",
        "who",
        "how",
        "when",
        "where",
        "why",
        "all",
        "each",
        "every",
        "both",
        "most",
        "some",
        "any",
        "many",
        "much",
        "more",
        "very",
        "just",
        "only",
        "also",
        "well",
        "back",
        "now",
        "here",
        "there",
        "still",
        "even",
        "too",
        "never",
        # Domain-relevant words (ethical dilemmas, decisions)
        "decision",
        "choice",
        "dilemma",
        "problem",
        "situation",
        "question",
        "answer",
        "option",
        "career",
        "boss",
        "manager",
        "company",
        "business",
        "ethical",
        "moral",
        "right",
        "wrong",
        "fair",
        "honest",
        "integrity",
        "duty",
        "advice",
        "guidance",
        "help",
        "support",
        "concern",
        "worry",
        "stress",
        "conflict",
        "relationship",
        "trust",
        "respect",
        "value",
        "principle",
        "balance",
        # Extended vocabulary for professional/ethical discussions
        "personal",
        "professional",
        "standards",
        "obligations",
        "justify",
        "bending",
        "breaking",
        "following",
        "ever",
        "always",
        "sometimes",
        "often",
        "usually",
        "actually",
        "really",
        "probably",
        "maybe",
        "perhaps",
        "whether",
        "because",
        "since",
        "although",
        "though",
        "while",
        "until",
        "unless",
        "without",
        "about",
        "after",
        "before",
        "between",
        "through",
        "during",
        "against",
        "into",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "employee",
        "employer",
        "colleague",
        "coworker",
        "client",
        "customer",
        "leader",
        "leadership",
        "action",
        "actions",
        "behavior",
        "conduct",
        "approach",
        "policy",
        "policies",
        "rules",
        "rule",
        "law",
        "legal",
        "illegal",
        "something",
        "anything",
        "everything",
        "nothing",
        "someone",
        "anyone",
        "everyone",
        "nobody",
        "another",
        "others",
        "myself",
        "yourself",
        "himself",
        "herself",
        "itself",
        "themselves",
        "ourselves",
    ]
)

# Minimum thresholds for gibberish detection
# Relaxed significantly - we only want to catch true spam/nonsense, not valid English
_MIN_COMMON_WORD_RATIO = 0.12  # At least 12% common words
_MIN_DISTINCT_COMMON_WORDS = 1  # Need at least 1 common word for longer texts


def _is_gibberish(text: str) -> bool:
    """
    Check if text appears to be gibberish (no recognizable words).

    Uses a simple common-words check: if the input has too few recognizable
    English words, it's likely keyboard mashing or random characters.

    Args:
        text: Input text to check

    Returns:
        True if text appears to be gibberish
    """
    # Extract words (letters only, lowercase)
    words = re.findall(r"[a-zA-Z]+", text.lower())

    if not words:
        # No alphabetic words - allow if text is short (might be numbers, dates, etc.)
        # Block only if it's long gibberish with no letters
        return len(text.strip()) > 20

    # Count distinct common words (not just occurrences)
    # "as as as a a" should count as 2 distinct, not 5 occurrences
    found_common = {word for word in words if word in _COMMON_WORDS}
    distinct_common_count = len(found_common)
    total_words = len(words)

    # For very short inputs (1-6 words), require at least 1 common word
    # This allows natural follow-up questions like "What about option C?"
    if total_words <= 6:
        return distinct_common_count < 1

    # For longer inputs, need both:
    # 1. At least 20% of words are common (by occurrence, for natural text)
    # 2. At least 2 distinct common words (prevents "as as as a a a")
    common_occurrences = sum(1 for word in words if word in _COMMON_WORDS)
    ratio = common_occurrences / total_words if total_words > 0 else 0

    return (
        ratio < _MIN_COMMON_WORD_RATIO
        or distinct_common_count < _MIN_DISTINCT_COMMON_WORDS
    )


def check_blocklist(text: str) -> ContentCheckResult:
    """
    Check text against blocklist patterns (Layer 1).

    This is the fast, pre-submission check that catches obvious violations
    before content reaches the database.

    Can be disabled via:
    - CONTENT_FILTER_ENABLED=false (master switch)
    - CONTENT_FILTER_BLOCKLIST_ENABLED=false (layer 1 only)

    Args:
        text: Content to check (title + description)

    Returns:
        ContentCheckResult indicating if content should be blocked
    """
    # Check if filtering is enabled
    if (
        not settings.CONTENT_FILTER_ENABLED
        or not settings.CONTENT_FILTER_BLOCKLIST_ENABLED
    ):
        return ContentCheckResult(is_violation=False)

    # Check explicit sexual content
    for pattern in _COMPILED_SEXUAL:
        if pattern.search(text):
            logger.warning(
                "Blocklist violation detected",
                extra={"violation_type": ViolationType.EXPLICIT_SEXUAL.value},
            )
            return ContentCheckResult(
                is_violation=True,
                violation_type=ViolationType.EXPLICIT_SEXUAL,
            )

    # Check explicit violence
    for pattern in _COMPILED_VIOLENCE:
        if pattern.search(text):
            logger.warning(
                "Blocklist violation detected",
                extra={"violation_type": ViolationType.EXPLICIT_VIOLENCE.value},
            )
            return ContentCheckResult(
                is_violation=True,
                violation_type=ViolationType.EXPLICIT_VIOLENCE,
            )

    # Check profanity/abuse (if enabled)
    if settings.CONTENT_FILTER_PROFANITY_ENABLED and _check_profanity_abuse(text):
        logger.warning(
            "Blocklist violation detected",
            extra={
                "violation_type": ViolationType.PROFANITY_ABUSE.value,
                "input_length": len(text),
            },
        )
        return ContentCheckResult(
            is_violation=True,
            violation_type=ViolationType.PROFANITY_ABUSE,
        )

    # Check spam patterns
    for pattern in _COMPILED_SPAM:
        if pattern.search(text):
            logger.warning(
                "Blocklist violation detected",
                extra={"violation_type": ViolationType.SPAM_GIBBERISH.value},
            )
            return ContentCheckResult(
                is_violation=True,
                violation_type=ViolationType.SPAM_GIBBERISH,
            )

    # Check for gibberish (no recognizable words)
    if _is_gibberish(text):
        logger.warning(
            "Blocklist violation detected",
            extra={"violation_type": ViolationType.SPAM_GIBBERISH.value},
        )
        return ContentCheckResult(
            is_violation=True,
            violation_type=ViolationType.SPAM_GIBBERISH,
        )

    return ContentCheckResult(is_violation=False)


# ============================================================================
# Search Query Filter (Separate from Consultation)
# ============================================================================
# Search queries need different rules than consultation submissions:
# - Short queries (1-3 words) are normal: "karma", "duty dharma", "yoga meditation"
# - Any profanity blocked (not just directed) - this is sacred text search
# - Explicit content always blocked
# - Slurs always blocked


def _contains_profanity(text: str) -> bool:
    """
    Check if text contains any profanity (for search queries).

    Unlike consultation filter, this blocks ALL profanity regardless of context.
    Search queries for sacred texts should not contain profanity.

    Args:
        text: Input text to check

    Returns:
        True if text contains profanity
    """
    # Check standalone profanity patterns
    for pattern in _COMPILED_PROFANITY:
        if pattern.search(text):
            return True

    # Check slurs (always blocked)
    for pattern in _COMPILED_SLURS:
        if pattern.search(text):
            return True

    # Use better-profanity for obfuscation detection
    try:
        from better_profanity import profanity

        if profanity.contains_profanity(text):
            return True
    except ImportError:
        logger.debug("better-profanity not installed, skipping obfuscation check")

    return False


def _is_search_gibberish(text: str) -> bool:
    """
    Check if search query is gibberish.

    More lenient than consultation gibberish check:
    - Short queries (1-3 words) skip gibberish check entirely
    - Longer queries need at least one common word

    Args:
        text: Search query to check

    Returns:
        True if query appears to be gibberish
    """
    words = re.findall(r"[a-zA-Z]+", text.lower())

    # No alphabetic words - check if it's just symbols/numbers
    if not words:
        # Allow short non-alphabetic (might be verse numbers like "2.47")
        return len(text.strip()) > 15

    # Short queries (1-3 words): skip gibberish check
    # "karma", "duty dharma", "yoga meditation practice" are all valid
    if len(words) <= 3:
        return False

    # For longer queries (4+ words), require at least one common word
    found_common = {word for word in words if word in _COMMON_WORDS}
    return len(found_common) < 1


def check_search_query(query: str) -> ContentCheckResult:
    """
    Check search query against content policy.

    Designed specifically for search queries on sacred text:
    - Block explicit sexual/violence content
    - Block ALL profanity (stricter than consultation)
    - Block slurs
    - Light gibberish check only for longer queries (4+ words)
    - Allow short spiritual terms: "karma", "dharma", "yoga", "satya"

    Can be disabled via:
    - CONTENT_FILTER_ENABLED=false (master switch)

    Args:
        query: Search query to check

    Returns:
        ContentCheckResult indicating if query should be blocked
    """
    # Check if filtering is enabled
    if not settings.CONTENT_FILTER_ENABLED:
        return ContentCheckResult(is_violation=False)

    # Check explicit sexual content
    for pattern in _COMPILED_SEXUAL:
        if pattern.search(query):
            logger.warning(
                "Search query blocked",
                extra={"violation_type": ViolationType.EXPLICIT_SEXUAL.value},
            )
            return ContentCheckResult(
                is_violation=True,
                violation_type=ViolationType.EXPLICIT_SEXUAL,
            )

    # Check explicit violence
    for pattern in _COMPILED_VIOLENCE:
        if pattern.search(query):
            logger.warning(
                "Search query blocked",
                extra={"violation_type": ViolationType.EXPLICIT_VIOLENCE.value},
            )
            return ContentCheckResult(
                is_violation=True,
                violation_type=ViolationType.EXPLICIT_VIOLENCE,
            )

    # Check profanity (strict - any profanity blocked for sacred text search)
    if _contains_profanity(query):
        logger.warning(
            "Search query blocked",
            extra={"violation_type": ViolationType.PROFANITY_ABUSE.value},
        )
        return ContentCheckResult(
            is_violation=True,
            violation_type=ViolationType.PROFANITY_ABUSE,
        )

    # Check spam patterns (repeated chars, etc.)
    for pattern in _COMPILED_SPAM:
        if pattern.search(query):
            logger.warning(
                "Search query blocked",
                extra={"violation_type": ViolationType.SPAM_GIBBERISH.value},
            )
            return ContentCheckResult(
                is_violation=True,
                violation_type=ViolationType.SPAM_GIBBERISH,
            )

    # Check gibberish (lenient for search)
    if _is_search_gibberish(query):
        logger.warning(
            "Search query blocked",
            extra={"violation_type": ViolationType.SPAM_GIBBERISH.value},
        )
        return ContentCheckResult(
            is_violation=True,
            violation_type=ViolationType.SPAM_GIBBERISH,
        )

    return ContentCheckResult(is_violation=False)


# ============================================================================
# LLM Refusal Detection (Layer 2)
# ============================================================================

# Patterns that indicate LLM refused to process content
# These are softer patterns - we're detecting refusal, not blocking
_LLM_REFUSAL_PATTERNS = [
    r"I (?:can't|cannot|won't|am not able to|'m not able to) (?:assist|help|provide|create|generate|write)",
    r"I'm (?:sorry|afraid),? (?:but )?I (?:can't|cannot|won't)",
    r"(?:This|That|Your) (?:request|content|message) (?:appears to |seems to )?(?:contain|include|involve)",
    r"(?:inappropriate|explicit|harmful|offensive) (?:content|material|request)",
    r"(?:violates?|against) (?:my |our )?(?:guidelines|policies|terms|content policy)",
    r"not (?:able|willing|going) to (?:assist|help|provide|engage) with (?:this|that|such)",
    r"(?:outside|beyond) (?:my|the) (?:scope|boundaries|capabilities)",
    r"I (?:must|need to) (?:decline|refuse|respectfully decline)",
    # Additional Claude-specific patterns
    r"I apologize,? but I (?:can't|cannot|won't)",
    r"I'm designed to (?:be helpful|assist),? (?:but|however) I (?:can't|cannot)",
    r"I don't (?:feel comfortable|think I should) (?:assist|help|provide)",
    r"(?:ethically|safely) (?:unable|cannot) to (?:assist|help|provide)",
    r"not something I(?:'m able| can) (?:to )?(?:help|assist) with",
]

_COMPILED_REFUSAL: list[Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in _LLM_REFUSAL_PATTERNS
]


def _contains_valid_json(text: str) -> bool:
    """
    Check if response contains valid JSON with expected structure.

    If the LLM generated valid JSON with our expected fields,
    it's very unlikely to be a refusal - even if refusal-like
    phrases appear in the content (e.g., quoted dialogue).
    """
    import json

    # Try to find and parse JSON in the response
    # Handle both raw JSON and markdown-wrapped JSON
    json_text = text.strip()

    # Remove markdown code block if present
    if json_text.startswith("```"):
        # Find the end of the code block
        lines = json_text.split("\n")
        # Skip first line (```json) and find closing ```
        json_lines = []
        in_block = False
        for line in lines:
            if line.startswith("```") and not in_block:
                in_block = True
                continue
            if line.startswith("```") and in_block:
                break
            if in_block:
                json_lines.append(line)
        json_text = "\n".join(json_lines)

    # Try to parse as JSON
    try:
        data = json.loads(json_text)
        # Check for expected fields that indicate a valid consultation response
        if isinstance(data, dict):
            has_summary = "executive_summary" in data
            has_options = "options" in data and isinstance(data["options"], list)
            if has_summary or has_options:
                return True
    except (json.JSONDecodeError, ValueError):
        pass

    return False


def _is_match_inside_quotes(text: str, match_start: int, match_end: int) -> bool:
    """
    Check if a match position is inside quoted text.

    This helps avoid false positives where refusal-like phrases
    appear in dialogue suggestions (e.g., "tell them 'I can't help'").

    Only counts quotes that appear to be string delimiters (not contractions).
    """
    # Count quotes before the match position
    text_before = text[:match_start]

    # For double quotes, simple count works (they're rarely used in contractions)
    double_quotes = text_before.count('"') - text_before.count('\\"')

    # For single quotes, be smarter - only count quotes that look like string delimiters
    # Skip contractions like I'm, can't, won't, don't by requiring space/punctuation before quote
    import re

    # Match single quotes that are likely string delimiters:
    # - preceded by space, punctuation, or start of string
    # - followed by a word character
    quote_pattern = re.compile(r"(?:^|[\s,;:({])'(?=\w)")
    single_quote_openers = len(quote_pattern.findall(text_before))

    # If odd number of quote openers, we're inside a quoted string
    return (single_quote_openers % 2 == 1) or (double_quotes % 2 == 1)


def detect_llm_refusal(response_text: str) -> tuple[bool, str | None]:
    """
    Detect if LLM response indicates a refusal (Layer 2).

    This detects when Claude or other LLMs refuse to process content
    due to their built-in safety guidelines.

    Detection strategy (to minimize false positives):
    1. If response contains valid JSON with expected fields, NOT a refusal
    2. Pattern must match in first 500 chars (refusals happen at start)
    3. Pattern must not be inside quotes (avoids matching dialogue)

    Can be disabled via:
    - CONTENT_FILTER_ENABLED=false (master switch)
    - CONTENT_FILTER_LLM_REFUSAL_DETECTION=false (layer 2 only)

    Args:
        response_text: Raw LLM response text (before JSON parsing)

    Returns:
        Tuple of (is_refusal, matched_pattern)
    """
    # Check if detection is enabled
    if (
        not settings.CONTENT_FILTER_ENABLED
        or not settings.CONTENT_FILTER_LLM_REFUSAL_DETECTION
    ):
        return False, None

    # Strategy 1: If response contains valid JSON, it's not a refusal
    # LLM wouldn't generate complete consultation JSON and then refuse
    if _contains_valid_json(response_text):
        logger.debug("Response contains valid JSON - not a refusal")
        return False, None

    # Strategy 2 & 3: Check patterns in first 500 chars, exclude quoted text
    # Real refusals happen at the start, not buried in content
    check_text = response_text[:500]

    for pattern in _COMPILED_REFUSAL:
        match = pattern.search(check_text)
        if match:
            # Strategy 3: Skip if match is inside quotes
            if _is_match_inside_quotes(check_text, match.start(), match.end()):
                logger.debug(
                    f"Refusal pattern '{match.group(0)}' found but inside quotes - skipping"
                )
                continue

            logger.warning(
                "LLM refusal detected in response",
                extra={"violation_type": ViolationType.LLM_REFUSAL.value},
            )
            return True, match.group(0)

    return False, None


# ============================================================================
# Educational Response Messages
# ============================================================================

# Main educational message for policy violations
POLICY_VIOLATION_RESPONSE = {
    "executive_summary": (
        "We weren't able to provide guidance for this request. "
        "Geetanjali is designed to help with genuine ethical dilemmas—difficult "
        "decisions where values conflict, such as workplace integrity, family "
        "responsibilities, or leadership challenges."
    ),
    "options": [
        {
            "title": "Reflect on Your Underlying Concern",
            "description": (
                "If there's a genuine ethical question beneath your request, "
                "consider what values are truly in tension and what decision "
                "you're actually facing."
            ),
            "pros": [
                "Clarifies your real question",
                "Opens path to meaningful guidance",
            ],
            "cons": ["Requires honest self-reflection"],
            "sources": [],
        },
        {
            "title": "Rephrase Your Dilemma",
            "description": (
                "Try describing your situation differently: What's the ethical "
                "tension? Who are the stakeholders? What values are in conflict?"
            ),
            "pros": ["May unlock relevant guidance", "Focuses on actionable elements"],
            "cons": ["Requires effort to articulate"],
            "sources": [],
        },
        {
            "title": "Explore the Bhagavad Geeta Directly",
            "description": (
                "Browse our verse collection to find wisdom that resonates with "
                "your situation. The Geeta addresses duty, action, detachment, "
                "and ethical living."
            ),
            "pros": ["Direct access to timeless wisdom", "Self-directed exploration"],
            "cons": ["Less structured guidance"],
            "sources": [],
        },
    ],
    "recommended_action": {
        "option": 2,
        "steps": [
            "Identify the core decision you're facing",
            "Note the stakeholders who would be affected",
            "Describe the values or principles in tension",
            "Submit a new consultation with this framing",
        ],
        "sources": [],
    },
    "reflection_prompts": [
        "What ethical tension am I truly wrestling with?",
        "If I described this situation to a wise mentor, how would I frame it?",
        "What would acting with integrity look like in my circumstances?",
    ],
    "sources": [],
    "confidence": 0.0,
    "scholar_flag": True,
    "policy_violation": True,
}


def get_policy_violation_response() -> dict:
    """
    Get the educational response for policy violations.

    Returns:
        Dict matching OutputResultSchema structure with educational content
        (deep copy to prevent mutation of the template)
    """
    return copy.deepcopy(POLICY_VIOLATION_RESPONSE)


# ============================================================================
# Pre-submission Validation Error
# ============================================================================


class ContentPolicyError(Exception):
    """
    Exception raised when content violates policy at submission time.

    This is used for Layer 1 (blocklist) violations where we want to
    reject the submission entirely before database write.
    """

    def __init__(self, violation_type: ViolationType):
        self.violation_type = violation_type
        self.message = self._get_user_message(violation_type)
        super().__init__(self.message)

    @staticmethod
    def _get_user_message(violation_type: ViolationType) -> str:
        """Get user-friendly error message for violation type."""
        # Differentiated messages by violation type
        if violation_type == ViolationType.SPAM_GIBBERISH:
            return (
                "Please enter a clear description of your dilemma. "
                "We couldn't understand your input.\n\n"
                "Try describing:\n"
                "• The specific situation you're facing\n"
                "• The decision you need to make\n"
                "• Why it feels difficult or conflicting"
            )

        if violation_type == ViolationType.PROFANITY_ABUSE:
            return (
                "Please rephrase without direct offensive language. "
                "We're here to help with genuine ethical dilemmas.\n\n"
                "If you're describing a difficult situation involving harsh language, "
                'try framing it as: "My colleague said something hurtful" rather than '
                "quoting the exact words."
            )

        # Default message for explicit content violations
        return (
            "We couldn't process this submission. Geetanjali helps with genuine "
            "ethical dilemmas—difficult decisions about right action, duty, and "
            "integrity.\n\n"
            "If you're facing a real dilemma, try describing:\n"
            "• The ethical tension you're experiencing\n"
            "• The stakeholders affected by your decision\n"
            "• The values or principles in conflict\n\n"
            "The Bhagavad Geeta's wisdom is most helpful when we approach it "
            "with sincere questions about how to live and act with integrity."
        )


def validate_submission_content(title: str, description: str) -> None:
    """
    Validate content before submission (Layer 1 check).

    Call this before creating a case to catch obvious violations.

    Args:
        title: Case title
        description: Case description

    Raises:
        ContentPolicyError: If content violates blocklist policies
    """
    combined_text = f"{title} {description}"
    result = check_blocklist(combined_text)

    if result.is_violation:
        raise ContentPolicyError(result.violation_type)  # type: ignore[arg-type]
