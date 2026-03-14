"""Data module for static curated content."""

from data.chapter_metadata import (
    BOOK_METADATA,
    CHAPTER_METADATA,
    get_all_chapter_metadata,
    get_book_metadata,
    get_chapter_metadata,
)
from data.featured_verses import (
    FEATURED_VERSE_COUNT,
    FEATURED_VERSES,
    get_featured_verse_ids,
    is_featured,
)
from data.gita_dhyanam import (
    GITA_DHYANAM,
    GITA_DHYANAM_COUNT,
    get_gita_dhyanam,
    get_gita_dhyanam_verse,
)

__all__ = [
    # Featured verses
    "FEATURED_VERSES",
    "FEATURED_VERSE_COUNT",
    "get_featured_verse_ids",
    "is_featured",
    # Chapter metadata
    "BOOK_METADATA",
    "CHAPTER_METADATA",
    "get_book_metadata",
    "get_chapter_metadata",
    "get_all_chapter_metadata",
    # Gita Dhyanam
    "GITA_DHYANAM",
    "GITA_DHYANAM_COUNT",
    "get_gita_dhyanam",
    "get_gita_dhyanam_verse",
]
