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
from data.geeta_dhyanam import (
    GEETA_DHYANAM,
    GEETA_DHYANAM_COUNT,
    get_geeta_dhyanam,
    get_geeta_dhyanam_verse,
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
    # Geeta Dhyanam
    "GEETA_DHYANAM",
    "GEETA_DHYANAM_COUNT",
    "get_geeta_dhyanam",
    "get_geeta_dhyanam_verse",
]
