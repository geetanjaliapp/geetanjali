"""
Enricher service for enhancing verse data using LLM and transliteration.
"""

import json
import logging
from pathlib import Path

from services.llm import get_llm_service
from utils.json_parsing import extract_json_from_markdown

logger = logging.getLogger(__name__)


class Enricher:
    """
    Enrich verse data with consulting principles, paraphrases, and IAST transliteration.
    """

    def __init__(self, config_dir: str = "./config"):
        """
        Initialize enricher with configuration.

        Args:
            config_dir: Path to configuration directory
        """
        self.config_dir = Path(config_dir)
        self.llm = get_llm_service()
        self.principle_taxonomy = self._load_principles()

        logger.info(
            f"Enricher initialized with {len(self.principle_taxonomy)} principles"
        )

    def _clean_paraphrase(self, text: str) -> str:
        """
        Clean markdown and formatting from LLM-generated paraphrase.

        Removes:
        - Markdown headers (# ## ###)
        - Bold markers (**)
        - Italic markers (*)
        - Extra whitespace and newlines
        - Metadata like "**Actionable Wisdom:**", "**Key Takeaway:**", etc.

        Args:
            text: Raw paraphrase text from LLM

        Returns:
            Cleaned plain text paraphrase
        """
        import re

        # Remove markdown headers
        text = re.sub(r"^#+\s+", "", text, flags=re.MULTILINE)

        # Remove bold markers (**)
        text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)

        # Remove italic markers (*)
        text = re.sub(r"\*([^*]+)\*", r"\1", text)

        # Remove metadata labels (lines ending with colon and bold markers)
        text = re.sub(r"\*\*[^:]+:\*\*\s*", "", text)

        # Replace multiple newlines with single space
        text = re.sub(r"\n+", " ", text)

        # Remove extra whitespace
        text = re.sub(r"\s+", " ", text).strip()

        return text

    def _load_principles(self) -> dict:
        """
        Load consulting principles taxonomy from config.

        Returns:
            Dictionary of principles
        """
        taxonomy_file = self.config_dir / "principle_taxonomy.json"

        if not taxonomy_file.exists():
            logger.warning(f"Principle taxonomy not found at {taxonomy_file}")
            return {}

        try:
            with open(taxonomy_file, encoding="utf-8") as f:
                principles = json.load(f)
            logger.info(f"Loaded {len(principles)} principles from taxonomy")
            return dict(principles)
        except Exception as e:
            logger.error(f"Failed to load principle taxonomy: {e}")
            return {}

    def extract_principles(
        self, verse_text: str, temperature: float = 0.1
    ) -> list[str]:
        """
        Extract consulting principles from verse using LLM with Geeta Expert persona.

        Args:
            verse_text: English translation of the verse
            temperature: LLM temperature (low for consistent tagging)

        Returns:
            List of principle IDs (2-4 principles)
        """
        if not verse_text or not verse_text.strip():
            logger.warning("Empty verse text provided for principle extraction")
            return []

        if not self.principle_taxonomy:
            logger.warning("No principle taxonomy loaded, skipping extraction")
            return []

        # Build principle list with richer context from taxonomy
        principle_list = []
        for pid, data in self.principle_taxonomy.items():
            label = data.get("label", pid)
            description = data.get("description", "")
            leadership = data.get("leadershipContext", "")
            group = data.get("group", "")
            keywords = data.get("keywords", [])

            # Include keywords and leadership context for better matching
            keywords_str = ", ".join(keywords[:5]) if keywords else ""
            principle_list.append(
                f"- {pid} ({group}): {label}\n"
                f"  Description: {description}\n"
                f"  Leadership: {leadership}\n"
                f"  Keywords: {keywords_str}"
            )

        principle_text = "\n\n".join(principle_list)

        # Build prompt with Geeta Expert persona
        prompt = f"""You are a Bhagavad Geeta scholar and expert in Vedantic philosophy, \
analyzing verses for their core teachings and applications to modern leadership.

Your task is to identify which principles from the taxonomy best represent this verse's message.

Consider:
1. The direct teaching of the verse
2. The broader context within the Geeta's philosophy (Karma, Jnana, Bhakti yoga paths)
3. Relevance to modern life and leadership application
4. The verse's emphasis - what is it primarily teaching?

Verse translation:
{verse_text}

PRINCIPLE TAXONOMY (16 principles in 4 groups):

{principle_text}

Return ONLY a valid JSON object with this exact format:
{{"principles": ["principle_id_1", "principle_id_2", "principle_id_3"]}}

Rules:
- Only use principle IDs from the list provided (e.g., "dharma", "nishkama_karma")
- Select 2-4 most relevant principles that authentically capture the verse's wisdom
- Prioritize principles that match the verse's primary teaching
- Consider the yoga path (karma/jnana/bhakti/sadachara) when grouping principles
- Must be valid JSON format"""

        try:
            # Call LLM with low temperature for consistency
            response_text = self.llm.generate_json(
                prompt=prompt, temperature=temperature
            )

            # Parse JSON response using shared utility
            result = extract_json_from_markdown(response_text)
            if result is None:
                logger.error("Failed to parse LLM JSON response")
                logger.debug(f"Response was: {response_text[:200]}")
                return []

            principles = result.get("principles", [])

            # Validate principle IDs
            valid_principles = [p for p in principles if p in self.principle_taxonomy]

            if len(valid_principles) != len(principles):
                logger.warning(
                    f"Filtered invalid principles: {set(principles) - set(valid_principles)}"
                )

            logger.debug(
                f"Extracted {len(valid_principles)} principles: {valid_principles}"
            )
            return valid_principles

        except Exception as e:
            logger.error(f"Failed to extract principles: {e}")
            return []

    def generate_paraphrase(
        self, verse_text: str, max_words: int = 25, temperature: float = 0.3
    ) -> str:
        """
        Generate short paraphrase for UI display using Geeta Expert persona.

        Args:
            verse_text: English translation of the verse
            max_words: Maximum words in paraphrase
            temperature: LLM temperature

        Returns:
            Paraphrase string
        """
        if not verse_text or not verse_text.strip():
            logger.warning("Empty verse text provided for paraphrasing")
            return ""

        prompt = f"""You are a Bhagavad Geeta scholar presenting timeless wisdom to modern professionals.

Distill this verse translation into a brief, actionable insight (maximum {max_words} words).

Guidelines:
- Focus on the practical application for modern leaders and decision-makers
- Use accessible language while preserving the verse's essence
- Avoid religious jargon; emphasize universal wisdom
- Be concise and memorable

Verse:
{verse_text}

IMPORTANT: Respond with ONLY plain text. No markdown, no headers, no formatting. \
Just a single concise sentence or brief paragraph."""

        try:
            result = self.llm.generate(
                prompt=prompt, temperature=temperature, max_tokens=100
            )

            paraphrase = result["response"].strip()

            # Remove markdown headers and formatting
            paraphrase = self._clean_paraphrase(paraphrase)

            # Remove quotes if LLM wrapped the response
            if paraphrase.startswith('"') and paraphrase.endswith('"'):
                paraphrase = paraphrase[1:-1]

            # Truncate if too long (word count)
            words = paraphrase.split()
            if len(words) > max_words:
                paraphrase = " ".join(words[:max_words]) + "..."

            logger.debug(f"Generated paraphrase: {len(words)} words")
            return str(paraphrase)

        except Exception as e:
            logger.error(f"Failed to generate paraphrase: {e}")
            return ""

    def transliterate_to_iast(self, devanagari: str) -> str:
        """
        Convert Devanagari script to IAST (International Alphabet of Sanskrit Transliteration).

        Args:
            devanagari: Sanskrit text in Devanagari script

        Returns:
            IAST transliteration
        """
        if not devanagari or not devanagari.strip():
            return ""

        try:
            from indic_transliteration import sanscript

            iast = sanscript.transliterate(
                devanagari, sanscript.DEVANAGARI, sanscript.IAST
            )

            logger.debug(f"Transliterated {len(devanagari)} chars to IAST")
            return str(iast)

        except ImportError:
            logger.error("indic-transliteration library not available")
            return ""
        except Exception as e:
            logger.error(f"Transliteration failed: {e}")
            return ""

    def enrich_verse(
        self,
        verse_data: dict,
        extract_principles: bool = True,
        generate_paraphrase: bool = True,
        transliterate: bool = True,
    ) -> dict:
        """
        Apply all enrichments to a verse.

        Args:
            verse_data: Verse dictionary
            extract_principles: Whether to extract consulting principles
            generate_paraphrase: Whether to generate paraphrase
            transliterate: Whether to transliterate to IAST

        Returns:
            Enriched verse dictionary
        """
        enriched = verse_data.copy()

        # Extract principles from translation
        # Check both translation_text (parser output) and translation_en (DB field)
        if extract_principles and not enriched.get("consulting_principles"):
            translation = enriched.get("translation_text") or enriched.get(
                "translation_en", ""
            )
            if translation:
                principles = self.extract_principles(translation)
                enriched["consulting_principles"] = principles

        # Generate paraphrase
        if generate_paraphrase and not enriched.get("paraphrase_en"):
            translation = enriched.get("translation_text") or enriched.get(
                "translation_en", ""
            )
            if translation:
                paraphrase = self.generate_paraphrase(translation)
                enriched["paraphrase_en"] = paraphrase

        # Transliterate to IAST
        if transliterate and not enriched.get("sanskrit_iast"):
            devanagari = enriched.get("sanskrit_devanagari", "")
            if devanagari:
                iast = self.transliterate_to_iast(devanagari)
                enriched["sanskrit_iast"] = iast

        return enriched

    def enrich_batch(self, verses: list[dict], **kwargs) -> list[dict]:
        """
        Enrich multiple verses in batch.

        Args:
            verses: List of verse dictionaries
            **kwargs: Arguments passed to enrich_verse

        Returns:
            List of enriched verse dictionaries
        """
        enriched_verses = []

        for i, verse in enumerate(verses):
            try:
                enriched = self.enrich_verse(verse, **kwargs)
                enriched_verses.append(enriched)

                if (i + 1) % 10 == 0:
                    logger.info(f"Enriched {i + 1}/{len(verses)} verses")

            except Exception as e:
                logger.error(f"Failed to enrich verse {verse.get('canonical_id')}: {e}")
                enriched_verses.append(verse)  # Keep original on error

        logger.info(
            f"Batch enrichment complete: {len(enriched_verses)}/{len(verses)} verses"
        )
        return enriched_verses
