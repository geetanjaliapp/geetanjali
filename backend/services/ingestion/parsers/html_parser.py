"""
HTML Parser for extracting Bhagavad Geeta verses from web sources.
"""

import logging
import re
from typing import Dict, List, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class HTMLParser:
    """
    Parse HTML sources to extract verse data.

    Supports different HTML structures from various websites.
    """

    def __init__(self):
        """Initialize HTML parser."""
        logger.info("HTMLParser initialized")

    def parse(self, html: str, source_config: Dict) -> List[Dict]:
        """
        Parse HTML content based on source configuration.

        Args:
            html: Raw HTML content
            source_config: Source configuration dict with metadata

        Returns:
            List of parsed verse dictionaries

        Raises:
            ValueError: If source format is unknown
        """
        source_name = source_config.get("name", "unknown")

        if "sacred-texts" in source_config.get("url", "").lower():
            return self.parse_sacred_texts(html, source_config)
        else:
            logger.warning(f"Unknown HTML source format for: {source_name}")
            return []

    def parse_sacred_texts(self, html: str, source_config: Dict) -> List[Dict]:
        """
        Parse sacred-texts.com Bhagavad Geeta format.

        The site has an index page with links to individual chapters.
        Each chapter page contains verses with Sanskrit and English text.

        Args:
            html: HTML content from sacred-texts.com
            source_config: Source configuration

        Returns:
            List of verse dictionaries
        """
        soup = BeautifulSoup(html, 'lxml')
        verses = []

        logger.info("Parsing sacred-texts.com format")

        # Check if this is the index page with chapter links
        chapter_links = soup.find_all('a', href=re.compile(r'bg\d+\.htm'))

        if chapter_links:
            # This is the index page - we need to fetch individual chapters
            logger.info(f"Found {len(chapter_links)} chapter links on index page")
            # Return empty list - caller should fetch individual chapter pages
            return []

        # Parse individual chapter page
        # Sacred-texts structure typically has verses in <p> tags or specific div classes

        # Try to extract chapter number from title or URL
        chapter_num = self._extract_chapter_number(soup, source_config.get("url", ""))

        if not chapter_num:
            logger.warning("Could not determine chapter number")
            return []

        # Find verse blocks - sacred-texts often uses <p> tags with specific patterns
        # Look for patterns like "47." or verse numbers
        verse_blocks = self._find_verse_blocks(soup)

        for verse_num, verse_data in verse_blocks:
            canonical_id = f"BG_{chapter_num}_{verse_num}"

            verse_dict = {
                "canonical_id": canonical_id,
                "chapter": chapter_num,
                "verse": verse_num,
                "sanskrit_devanagari": verse_data.get("sanskrit", ""),
                "translation_text": verse_data.get("translation", ""),
                "source": source_config.get("url", ""),
                "license": source_config.get("license", "Public Domain"),
                "translator": source_config.get("translator", ""),
                "year": source_config.get("year"),
            }

            verses.append(verse_dict)

        logger.info(f"Parsed {len(verses)} verses from chapter {chapter_num}")
        return verses

    def _extract_chapter_number(self, soup: BeautifulSoup, url: str) -> Optional[int]:
        """
        Extract chapter number from page title or URL.

        Args:
            soup: BeautifulSoup object
            url: Source URL

        Returns:
            Chapter number or None
        """
        # Try to extract from URL pattern like "bg12.htm"
        url_match = re.search(r'bg(\d+)\.htm', url)
        if url_match:
            return int(url_match.group(1))

        # Try to extract from page title
        title = soup.find('title')
        if title:
            title_text = title.get_text()
            # Look for patterns like "Chapter 2" or "Adhyaya 2"
            title_match = re.search(r'(?:Chapter|Adhyaya)\s+(\d+)', title_text, re.IGNORECASE)
            if title_match:
                return int(title_match.group(1))

        # Try to find in h1, h2 tags
        for heading in soup.find_all(['h1', 'h2', 'h3']):
            heading_text = heading.get_text()
            heading_match = re.search(r'(?:Chapter|Adhyaya)\s+(\d+)', heading_text, re.IGNORECASE)
            if heading_match:
                return int(heading_match.group(1))

        return None

    def _find_verse_blocks(self, soup: BeautifulSoup) -> List[tuple]:
        """
        Find and extract verse blocks from the page.

        Args:
            soup: BeautifulSoup object

        Returns:
            List of (verse_number, verse_data) tuples
        """
        verses = []

        # Strategy 1: Look for verse numbers followed by text
        # Pattern: "47." or "47:" followed by Sanskrit and English
        all_paragraphs = soup.find_all('p')

        current_verse_num = None
        current_sanskrit = None
        current_translation = None

        for p in all_paragraphs:
            text = p.get_text().strip()

            # Check if this paragraph starts with a verse number
            verse_num_match = re.match(r'^(\d+)[\.\:\)]', text)

            if verse_num_match:
                # Save previous verse if exists
                if current_verse_num and (current_sanskrit or current_translation):
                    verses.append((
                        current_verse_num,
                        {
                            "sanskrit": current_sanskrit or "",
                            "translation": current_translation or ""
                        }
                    ))

                # Start new verse
                current_verse_num = int(verse_num_match.group(1))
                # Remove the verse number from text
                remaining_text = text[verse_num_match.end():].strip()

                # Check if this line contains Devanagari (simple heuristic)
                if self._contains_devanagari(remaining_text):
                    current_sanskrit = remaining_text
                    current_translation = None
                else:
                    current_sanskrit = None
                    current_translation = remaining_text

            elif current_verse_num:
                # Continuation of current verse
                if self._contains_devanagari(text):
                    if current_sanskrit:
                        current_sanskrit += " " + text
                    else:
                        current_sanskrit = text
                else:
                    if current_translation:
                        current_translation += " " + text
                    else:
                        current_translation = text

        # Add the last verse
        if current_verse_num and (current_sanskrit or current_translation):
            verses.append((
                current_verse_num,
                {
                    "sanskrit": current_sanskrit or "",
                    "translation": current_translation or ""
                }
            ))

        return verses

    def _contains_devanagari(self, text: str) -> bool:
        """
        Check if text contains Devanagari script.

        Args:
            text: Text to check

        Returns:
            True if Devanagari characters found
        """
        # Devanagari Unicode range: U+0900 to U+097F
        devanagari_pattern = re.compile(r'[\u0900-\u097F]')
        return bool(devanagari_pattern.search(text))

    def get_chapter_urls(self, index_html: str, base_url: str) -> List[str]:
        """
        Extract chapter URLs from index page.

        Args:
            index_html: HTML content of index page
            base_url: Base URL for resolving relative links

        Returns:
            List of full chapter URLs
        """
        soup = BeautifulSoup(index_html, 'lxml')
        chapter_links = soup.find_all('a', href=re.compile(r'bg\d+\.htm'))

        urls = []
        for link in chapter_links:
            href = link.get('href')
            if href:
                # Make absolute URL
                if href.startswith('http'):
                    full_url = href
                else:
                    # Remove filename from base_url and append href
                    base = base_url.rsplit('/', 1)[0] if '/' in base_url else base_url
                    full_url = f"{base}/{href}"

                urls.append(full_url)

        logger.info(f"Extracted {len(urls)} chapter URLs from index")
        return urls
