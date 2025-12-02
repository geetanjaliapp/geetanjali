"""
Data ingestion services for Bhagavad Geeta verses.

This package provides automated fetching, parsing, enrichment, and persistence
of Geeta verses, translations, and commentaries from various sources.
"""

from .fetcher import Fetcher
from .validator import Validator

__all__ = ["Fetcher", "Validator"]
