"""
JSON Parser for extracting Bhagavad Geeta verses from structured JSON sources.
"""

import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class JSONParser:
    """
    Parse JSON sources to extract verse data.

    Supports different JSON schema formats from various sources.
    """

    def __init__(self):
        """Initialize JSON parser."""
        logger.info("JSONParser initialized")

    def parse(self, json_str: str, source_config: Dict) -> List[Dict]:
        """
        Parse JSON content based on source configuration.

        Args:
            json_str: Raw JSON string
            source_config: Source configuration dict with metadata

        Returns:
            List of parsed verse/translation dictionaries

        Raises:
            ValueError: If JSON is invalid or format unknown
        """
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON: {e}")
            raise ValueError(f"Invalid JSON format: {e}")

        # Check if this is a translations source
        json_type = source_config.get("json_type", "")
        if json_type == "gita_translations":
            return self._parse_translations_array(data, source_config)

        # Determine JSON schema based on structure
        if isinstance(data, list):
            return self._parse_verse_array(data, source_config)
        elif isinstance(data, dict):
            if "verses" in data:
                return self._parse_verse_array(data["verses"], source_config)
            elif "chapters" in data:
                return self._parse_chapters_format(data["chapters"], source_config)
            else:
                # Try to parse as single verse
                verse = self._parse_single_verse(data, source_config)
                return [verse] if verse else []
        else:
            logger.warning(
                f"Unknown JSON structure for source: {source_config.get('name')}"
            )
            return []

    def _parse_verse_array(self, verses: List, source_config: Dict) -> List[Dict]:
        """
        Parse array of verse objects.

        Args:
            verses: List of verse dictionaries
            source_config: Source configuration

        Returns:
            List of standardized verse dictionaries
        """
        parsed_verses = []

        for verse_data in verses:
            verse = self._parse_single_verse(verse_data, source_config)
            if verse:
                parsed_verses.append(verse)

        logger.info(f"Parsed {len(parsed_verses)} verses from array")
        return parsed_verses

    def _parse_chapters_format(self, chapters: List, source_config: Dict) -> List[Dict]:
        """
        Parse nested chapter/verse structure.

        Format: {"chapters": [{"chapter": 1, "verses": [...]}, ...]}

        Args:
            chapters: List of chapter dictionaries
            source_config: Source configuration

        Returns:
            List of standardized verse dictionaries
        """
        all_verses = []

        for chapter_data in chapters:
            chapter_num = chapter_data.get("chapter") or chapter_data.get(
                "chapter_number"
            )
            verses = chapter_data.get("verses", [])

            for verse_data in verses:
                # Inject chapter number if not present
                if "chapter" not in verse_data:
                    verse_data["chapter"] = chapter_num

                verse = self._parse_single_verse(verse_data, source_config)
                if verse:
                    all_verses.append(verse)

        logger.info(f"Parsed {len(all_verses)} verses from chapters format")
        return all_verses

    def _parse_single_verse(
        self, verse_data: Dict, source_config: Dict
    ) -> Optional[Dict]:
        """
        Parse a single verse dictionary and standardize fields.

        Args:
            verse_data: Verse dictionary from JSON
            source_config: Source configuration

        Returns:
            Standardized verse dictionary or None if invalid
        """
        # Extract chapter and verse numbers (required)
        chapter = self._extract_number(
            verse_data, ["chapter", "chapter_number", "adhyaya"]
        )
        verse_num = self._extract_number(
            verse_data, ["verse", "verse_number", "shloka", "sloka"]
        )

        if not chapter or not verse_num:
            logger.warning(f"Missing chapter/verse number in: {verse_data}")
            return None

        # Build canonical ID
        canonical_id = verse_data.get("canonical_id") or f"BG_{chapter}_{verse_num}"

        # Extract text fields (flexible field names)
        # Support gita/gita format: "text" field contains Sanskrit Devanagari
        sanskrit_devanagari = self._extract_text(
            verse_data,
            ["sanskrit_devanagari", "text", "sanskrit", "devanagari", "text_sanskrit"],
        )

        sanskrit_iast = self._extract_text(
            verse_data, ["sanskrit_iast", "transliteration", "iast", "romanized"]
        )

        translation = self._extract_text(
            verse_data,
            ["translation", "translation_text", "english", "meaning", "text_english"],
        )

        paraphrase = self._extract_text(
            verse_data, ["paraphrase", "paraphrase_en", "summary", "brief"]
        )

        # Extract word meanings (gita/gita specific field)
        word_meanings = self._extract_text(
            verse_data, ["word_meanings", "word_meaning", "pada_artha"]
        )

        # Extract metadata
        consulting_principles = verse_data.get(
            "consulting_principles"
        ) or verse_data.get("principles")

        # Build standardized verse dict
        verse = {
            "canonical_id": canonical_id,
            "chapter": chapter,
            "verse": verse_num,
            "sanskrit_devanagari": sanskrit_devanagari,
            "sanskrit_iast": sanskrit_iast,
            "translation_text": translation,
            "paraphrase_en": paraphrase,
            "word_meanings": word_meanings,
            "consulting_principles": consulting_principles,
            "source": source_config.get("url") or source_config.get("source", ""),
            "license": source_config.get("license", ""),
            "translator": source_config.get("translator", ""),
            "year": source_config.get("year"),
        }

        return verse

    def _extract_number(self, data: Dict, field_names: List[str]) -> Optional[int]:
        """
        Extract numeric value from dict trying multiple field names.

        Args:
            data: Dictionary to search
            field_names: List of possible field names

        Returns:
            Integer value or None
        """
        for field in field_names:
            value = data.get(field)
            if value is not None:
                try:
                    return int(value)
                except (ValueError, TypeError):
                    continue
        return None

    def _extract_text(self, data: Dict, field_names: List[str]) -> str:
        """
        Extract text value from dict trying multiple field names.

        Args:
            data: Dictionary to search
            field_names: List of possible field names

        Returns:
            String value or empty string
        """
        for field in field_names:
            value = data.get(field)
            if value:
                return str(value).strip()
        return ""

    def _parse_translations_array(
        self, translations: List, source_config: Dict
    ) -> List[Dict]:
        """
        Parse array of translation objects from gita/gita translation.json format.

        Format: [{"authorName": "...", "description": "...", "lang": "english", "verse_id": 1, ...}, ...]

        Groups translations by verse and returns structured data for ingestion.
        Supports filtering by specific languages via source_config.

        Args:
            translations: List of translation dictionaries
            source_config: Source configuration (can include "language" field to filter)

        Returns:
            List of translation dictionaries grouped by verse
        """
        from collections import defaultdict

        # Determine which language to filter by
        # If not specified in source config, default to 'english' for backward compatibility
        target_language = source_config.get("language", "english")

        # Group by verse_id, filtered by target language
        by_verse = defaultdict(list)
        default_translator = source_config.get(
            "default_translator", "Swami Gambirananda"
        )

        # Build translator priority and school mapping
        translator_priority = {}
        translator_school = {}
        for tp in source_config.get("translator_priority", []):
            translator_priority[tp["name"]] = tp.get("priority", 99)
            translator_school[tp["name"]] = tp.get("school", "")

        for t in translations:
            # Filter by target language
            if t.get("lang") != target_language:
                continue

            verse_id = t.get("verse_id")
            if not verse_id:
                continue

            translator_name = t.get("authorName", "")
            by_verse[verse_id].append(
                {
                    "text": t.get("description", "").strip(),
                    "language": target_language,
                    "translator": translator_name,
                    "school": translator_school.get(translator_name, ""),
                    "priority": translator_priority.get(translator_name, 99),
                    "author_id": t.get("author_id"),
                    "source": source_config.get("url", ""),
                    "license": source_config.get("license", ""),
                }
            )

        # Build output: one entry per verse with all translations
        parsed = []
        for verse_id, trans_list in by_verse.items():
            # Sort translations by priority
            trans_list.sort(key=lambda x: x.get("priority", 99))

            # Calculate chapter and verse from verse_id (1-indexed sequential)
            chapter, verse_num = self._verse_id_to_chapter_verse(verse_id)

            if not chapter:
                logger.warning(f"Could not map verse_id {verse_id} to chapter/verse")
                continue

            canonical_id = f"BG_{chapter}_{verse_num}"

            # Find default translation (by name match or highest priority)
            default_text = ""
            for t in trans_list:
                if t["translator"] == default_translator:
                    default_text = t["text"]
                    break

            # Fallback to highest priority translation if default not found
            if not default_text and trans_list:
                default_text = trans_list[0]["text"]

            parsed.append(
                {
                    "canonical_id": canonical_id,
                    "chapter": chapter,
                    "verse": verse_num,
                    "translation_en": default_text,  # Primary translation for verse table
                    "translations": trans_list,  # All translations (sorted by priority) for translations table
                    "source": source_config.get("url", ""),
                    "license": source_config.get("license", ""),
                    "_is_translation_data": True,  # Flag for pipeline to handle differently
                }
            )

        logger.info(
            f"Parsed translations for {len(parsed)} verses from {len(translations)} records"
        )
        return parsed

    def _verse_id_to_chapter_verse(self, verse_id: int) -> tuple:
        """
        Convert sequential verse_id to chapter and verse number.

        Geeta chapter verse counts:
        Ch 1: 47, Ch 2: 72, Ch 3: 43, Ch 4: 42, Ch 5: 29, Ch 6: 47,
        Ch 7: 30, Ch 8: 28, Ch 9: 34, Ch 10: 42, Ch 11: 55, Ch 12: 20,
        Ch 13: 35, Ch 14: 27, Ch 15: 20, Ch 16: 24, Ch 17: 28, Ch 18: 78

        Args:
            verse_id: 1-indexed sequential verse ID

        Returns:
            Tuple of (chapter, verse) or (None, None) if invalid
        """
        chapter_sizes = [
            47,
            72,
            43,
            42,
            29,
            47,
            30,
            28,
            34,
            42,
            55,
            20,
            35,
            27,
            20,
            24,
            28,
            78,
        ]

        if verse_id < 1 or verse_id > 701:
            return None, None

        cumulative = 0
        for chapter, size in enumerate(chapter_sizes, start=1):
            if verse_id <= cumulative + size:
                verse_num = verse_id - cumulative
                return chapter, verse_num
            cumulative += size

        return None, None
