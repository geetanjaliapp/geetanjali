#!/usr/bin/env python3
"""
Backfill paraphrase into ChromaDB metadata for existing verses.

This script updates existing ChromaDB entries to include the paraphrase_en
from PostgreSQL in the metadata, enabling consultation prompts to use
pre-computed paraphrases instead of regenerating them.

Usage:
    python scripts/backfill_paraphrase_metadata.py [--dry-run]
"""

import sys
import argparse
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.connection import SessionLocal
from models.verse import Verse
from services.vector_store import get_vector_store
from services.embeddings import get_embedding_service
from services.cache import cache, verse_key

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def backfill_paraphrase_metadata(dry_run: bool = False):
    """
    Backfill paraphrase_en into ChromaDB metadata for all verses.

    Args:
        dry_run: If True, only report what would be done without making changes
    """
    db = SessionLocal()
    vector_store = get_vector_store()
    embedding_service = get_embedding_service()

    try:
        # Get all verses with paraphrase_en
        verses_with_paraphrase = (
            db.query(Verse)
            .filter(Verse.paraphrase_en.isnot(None), Verse.paraphrase_en != "")
            .all()
        )

        logger.info(f"Found {len(verses_with_paraphrase)} verses with paraphrase_en")

        updated = 0
        skipped = 0
        errors = 0

        for verse in verses_with_paraphrase:
            try:
                # Get existing entry from vector store
                existing = vector_store.get_by_id(verse.canonical_id)

                if not existing or not existing.get("ids"):
                    logger.warning(
                        f"Verse {verse.canonical_id} not found in vector store, skipping"
                    )
                    skipped += 1
                    continue

                # Check if paraphrase already in metadata
                current_metadata = (
                    existing.get("metadatas", [{}])[0]
                    if existing.get("metadatas")
                    else {}
                )
                if current_metadata.get("paraphrase") == verse.paraphrase_en:
                    logger.debug(
                        f"Verse {verse.canonical_id} already has paraphrase in metadata, skipping"
                    )
                    skipped += 1
                    continue

                if dry_run:
                    paraphrase_preview = (
                        verse.paraphrase_en[:50] if verse.paraphrase_en else ""
                    )
                    logger.info(
                        f"[DRY RUN] Would update {verse.canonical_id} with paraphrase: {paraphrase_preview}..."
                    )
                    updated += 1
                    continue

                # Build updated metadata
                metadata = {
                    "chapter": verse.chapter,
                    "verse": verse.verse,
                    "paraphrase": verse.paraphrase_en,
                }

                # Add principles if present
                if verse.consulting_principles:
                    if isinstance(verse.consulting_principles, list):
                        metadata["principles"] = ",".join(verse.consulting_principles)
                    else:
                        metadata["principles"] = str(verse.consulting_principles)

                # Build embedding text (same logic as persister)
                text_parts = []
                if verse.sanskrit_iast:
                    text_parts.append(verse.sanskrit_iast)
                if verse.paraphrase_en:
                    text_parts.append(verse.paraphrase_en)

                combined_text = " ".join(text_parts)

                if not combined_text.strip():
                    logger.warning(
                        f"No text for embedding: {verse.canonical_id}, skipping"
                    )
                    skipped += 1
                    continue

                # Generate embedding
                embedding = embedding_service.encode(combined_text)

                # Delete and re-add (ChromaDB doesn't support metadata-only update easily)
                vector_store.delete_verse(verse.canonical_id)
                vector_store.add_verse(
                    canonical_id=verse.canonical_id,
                    text=combined_text,
                    metadata=metadata,
                    embedding=embedding,  # type: ignore[arg-type]
                )

                # Invalidate Redis cache for this verse
                cache.delete(verse_key(verse.canonical_id))

                logger.info(f"Updated {verse.canonical_id}")
                updated += 1

            except Exception as e:
                logger.error(f"Error updating {verse.canonical_id}: {e}")
                errors += 1

        logger.info(f"\nBackfill complete:")
        logger.info(f"  Updated: {updated}")
        logger.info(f"  Skipped: {skipped}")
        logger.info(f"  Errors:  {errors}")

        if dry_run:
            logger.info(
                "\n[DRY RUN] No changes were made. Run without --dry-run to apply changes."
            )

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Backfill paraphrase into ChromaDB metadata"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report what would be done without making changes",
    )
    args = parser.parse_args()

    backfill_paraphrase_metadata(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
