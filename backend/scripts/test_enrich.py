#!/usr/bin/env python3
"""
Quick test script to enrich 1-2 verses using Anthropic.

Usage:
    python scripts/test_enrich.py [--limit N]
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.connection import SessionLocal
from models import Verse
from services.ingestion.enricher import Enricher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Test enrichment on limited verses")
    parser.add_argument("--limit", type=int, default=2, help="Number of verses to enrich")
    parser.add_argument("--verse-id", type=str, help="Specific canonical_id to enrich (e.g., BG_2_47)")
    args = parser.parse_args()

    db = SessionLocal()

    try:
        # Initialize enricher
        logger.info("Initializing enricher...")
        enricher = Enricher()

        # Get verses to enrich
        if args.verse_id:
            verses = db.query(Verse).filter(Verse.canonical_id == args.verse_id).all()
            if not verses:
                logger.error(f"Verse not found: {args.verse_id}")
                return 1
        else:
            # Get verses that need enrichment (empty paraphrase)
            verses = db.query(Verse).filter(
                (Verse.paraphrase_en.is_(None)) | (Verse.paraphrase_en == "")
            ).limit(args.limit).all()

        if not verses:
            logger.info("No verses need enrichment")
            return 0

        logger.info(f"Found {len(verses)} verses to enrich")

        for verse in verses:
            logger.info(f"\n{'='*60}")
            logger.info(f"Enriching: {verse.canonical_id}")
            logger.info(f"Translation: {verse.translation_en[:100]}...")

            # Convert to dict for enricher
            verse_data = {
                "canonical_id": verse.canonical_id,
                "translation_text": verse.translation_en,
                "sanskrit_devanagari": verse.sanskrit_devanagari,
            }

            # Enrich
            enriched = enricher.enrich_verse(
                verse_data,
                extract_principles=True,
                generate_paraphrase=True,
                transliterate=False  # Already have IAST
            )

            # Show results
            logger.info(f"\nResults for {verse.canonical_id}:")
            logger.info(f"  Paraphrase: {enriched.get('paraphrase_en', 'N/A')}")
            logger.info(f"  Principles: {enriched.get('consulting_principles', [])}")

            # Update database
            verse.paraphrase_en = enriched.get("paraphrase_en", "")
            verse.consulting_principles = enriched.get("consulting_principles", [])
            db.commit()

            logger.info(f"  Saved to database!")

        logger.info(f"\n{'='*60}")
        logger.info(f"Enrichment complete for {len(verses)} verses")
        return 0

    except Exception as e:
        logger.error(f"Enrichment failed: {e}", exc_info=True)
        return 1

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
