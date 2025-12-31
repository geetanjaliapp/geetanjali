"""Query parser for search intent detection.

Analyzes user queries to determine search intent:
- Canonical verse references (2.47, BG_2_47)
- Sanskrit text (Devanagari or IAST)
- Situational queries (personal dilemmas)
- General keyword queries
"""

import re
import unicodedata
from re import Pattern


class QueryParser:
    """Parse search queries to detect intent and extract patterns.

    Compiled regex patterns are cached at instance level for performance.
    Thread-safe for read operations.

    Example:
        parser = QueryParser()
        if ref := parser.parse_canonical("2.47"):
            chapter, verse = ref
            # Handle canonical lookup
        elif parser.is_sanskrit_query(query):
            # Handle Sanskrit search
    """

    # Canonical ID patterns
    # Supports: BG_2_47, BG-2-47, 2.47, 2:47, 2-47, chapter 2 verse 47
    CANONICAL_PATTERNS: list[str] = [
        r"^BG[_-]?(\d{1,2})[_-](\d{1,3})$",  # BG_2_47, BG-2-47
        r"^(\d{1,2})[:.\-](\d{1,3})$",  # 2.47, 2:47, 2-47
        r"^chapter\s*(\d{1,2})\s*(?:verse|v|shloka|sloka)?\s*(\d{1,3})$",
        r"^ch?\s*(\d{1,2})\s*v?\s*(\d{1,3})$",  # ch 2 v 47, c2v47
    ]

    # Devanagari Unicode range (for Sanskrit detection)
    DEVANAGARI_RANGE: tuple[int, int] = (0x0900, 0x097F)

    # IAST diacritical characters (for Sanskrit detection)
    IAST_CHARS: set[str] = set("āīūṛṝḷḹēōṃḥñṅṭḍṇśṣĀĪŪṚṜḶḸĒŌṂḤÑṄṬḌṆŚṢ")

    # Situational query patterns (indicate personal dilemma)
    SITUATIONAL_PATTERNS: list[str] = [
        r"\b(my|i|we|our)\b.*\b(struggling|facing|dealing|worried|concerned|confused)\b",
        r"\bhow\s+(do|can|should)\s+(i|we)\b",
        r"\b(help|advice|guidance)\s+(me|us)\b",
        r"\bwhat\s+should\s+(i|we)\s+do\b",
        r"\bi('m|\s+am)\s+(feeling|facing|dealing)\b",
        # Decision-making and life guidance queries
        r"\b(want|need)\s+to\s+(decide|choose|figure out)\b",
        r"\bwhat\s+to\s+do\s+(in|with|about)\b",
        r"\b(stuck|lost|uncertain|unsure)\b.*\b(life|career|work|job|relationship)\b",
        r"\b(life|career|work)\s+(decision|choice|dilemma|problem)\b",
        r"\bhow\s+to\s+(handle|deal|cope|manage|overcome)\b",
        r"\b(stressed|anxious|overwhelmed)\s+(about|with|at)?\b",
    ]

    def __init__(self) -> None:
        """Initialize parser with compiled regex patterns."""
        self._canonical_re: list[Pattern[str]] = [
            re.compile(p, re.IGNORECASE) for p in self.CANONICAL_PATTERNS
        ]
        self._situational_re: list[Pattern[str]] = [
            re.compile(p, re.IGNORECASE) for p in self.SITUATIONAL_PATTERNS
        ]

    def parse_canonical(self, query: str) -> tuple[int, int] | None:
        """Try to parse query as a canonical verse reference.

        Args:
            query: User search query

        Returns:
            Tuple of (chapter, verse) if parsed, None otherwise

        Example:
            >>> parser.parse_canonical("2.47")
            (2, 47)
            >>> parser.parse_canonical("duty")
            None
        """
        query = query.strip()

        for pattern in self._canonical_re:
            match = pattern.match(query)
            if match:
                chapter = int(match.group(1))
                verse = int(match.group(2))
                # Validate chapter is in valid Geeta range (1-18)
                if 1 <= chapter <= 18:
                    return (chapter, verse)

        return None

    def is_sanskrit_query(self, query: str) -> bool:
        """Check if query contains Sanskrit text.

        Detects both Devanagari script and IAST transliteration
        with diacritical marks.

        Args:
            query: User search query

        Returns:
            True if query contains Sanskrit characters

        Example:
            >>> parser.is_sanskrit_query("कर्म")
            True
            >>> parser.is_sanskrit_query("karmaṇy")
            True
            >>> parser.is_sanskrit_query("duty")
            False
        """
        for char in query:
            code = ord(char)
            # Check Devanagari range
            if self.DEVANAGARI_RANGE[0] <= code <= self.DEVANAGARI_RANGE[1]:
                return True
            # Check IAST diacritics
            if char in self.IAST_CHARS:
                return True
        return False

    def is_situational_query(self, query: str) -> bool:
        """Check if query describes a personal situation.

        Detects queries that sound like personal dilemmas,
        which might be better served by the consultation feature.

        Args:
            query: User search query

        Returns:
            True if query appears to describe a personal situation

        Example:
            >>> parser.is_situational_query("My team is struggling")
            True
            >>> parser.is_situational_query("duty without attachment")
            False
        """
        query_lower = query.lower()
        for pattern in self._situational_re:
            if pattern.search(query_lower):
                return True
        return False

    def normalize_for_search(self, query: str) -> str:
        """Normalize query for text matching.

        Removes extra whitespace and normalizes spacing.

        Args:
            query: Raw user query

        Returns:
            Normalized query string
        """
        return " ".join(query.split())

    def normalize_iast(self, text: str) -> str:
        """Normalize IAST text for fuzzy matching.

        Converts diacritical characters to base ASCII:
        ā→a, ṇ→n, ś→s, etc.

        Useful for matching when user types without diacritics.

        Args:
            text: Text with IAST diacritics

        Returns:
            Normalized ASCII text

        Example:
            >>> parser.normalize_iast("karmaṇy")
            "karmany"
        """
        # NFKD decomposition separates base char from combining marks
        decomposed = unicodedata.normalize("NFKD", text)
        # Remove combining diacritical marks
        normalized = "".join(
            char for char in decomposed if not unicodedata.combining(char)
        )
        return normalized.lower()
