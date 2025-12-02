"""
Persister service for saving verses to PostgreSQL and ChromaDB.
"""

import logging
import uuid
from typing import Dict, List
from sqlalchemy.orm import Session

from models.verse import Verse, Translation
from services.embeddings import get_embedding_service
from services.vector_store import get_vector_store

logger = logging.getLogger(__name__)


class Persister:
    """
    Persist verses to both PostgreSQL and ChromaDB vector store.

    Handles dual-write operations with error recovery.
    """

    def __init__(self, db: Session):
        """
        Initialize persister with database session.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.embedding_service = get_embedding_service()
        self.vector_store = get_vector_store()

        logger.info("Persister initialized")

    def persist_verse(
        self,
        verse_data: Dict,
        update_existing: bool = True
    ) -> Verse:
        """
        Persist a single verse to database and vector store.

        Args:
            verse_data: Verse dictionary
            update_existing: Whether to update if verse already exists

        Returns:
            Verse model instance

        Raises:
            Exception: If persistence fails
        """
        canonical_id = verse_data["canonical_id"]

        # Check if verse already exists
        existing_verse = self.db.query(Verse).filter_by(canonical_id=canonical_id).first()

        if existing_verse:
            if update_existing:
                logger.debug(f"Updating existing verse: {canonical_id}")
                verse = self._update_verse(existing_verse, verse_data)
            else:
                logger.debug(f"Verse {canonical_id} already exists, skipping")
                return existing_verse
        else:
            logger.debug(f"Creating new verse: {canonical_id}")
            verse = self._create_verse(verse_data)

        # Generate and persist embedding
        self._persist_embedding(verse, verse_data)

        return verse

    def _create_verse(self, verse_data: Dict) -> Verse:
        """
        Create new verse in database.

        Args:
            verse_data: Verse dictionary

        Returns:
            Created Verse instance
        """
        verse = Verse(
            id=str(uuid.uuid4()),
            canonical_id=verse_data["canonical_id"],
            chapter=verse_data["chapter"],
            verse=verse_data["verse"],
            sanskrit_iast=verse_data.get("sanskrit_iast", ""),
            sanskrit_devanagari=verse_data.get("sanskrit_devanagari", ""),
            translation_en=verse_data.get("translation_en", ""),
            paraphrase_en=verse_data.get("paraphrase_en", ""),
            consulting_principles=verse_data.get("consulting_principles"),
            source=verse_data.get("source", ""),
            license=verse_data.get("license", "")
        )

        self.db.add(verse)
        self.db.flush()  # Get verse.id without committing

        logger.debug(f"Created verse {verse.canonical_id} with id {verse.id}")

        return verse

    def _update_verse(self, existing_verse: Verse, verse_data: Dict) -> Verse:
        """
        Update existing verse with new data.

        Args:
            existing_verse: Existing Verse instance
            verse_data: New verse data

        Returns:
            Updated Verse instance
        """
        # Update fields if new data provided
        if verse_data.get("sanskrit_iast"):
            existing_verse.sanskrit_iast = verse_data["sanskrit_iast"]

        if verse_data.get("sanskrit_devanagari"):
            existing_verse.sanskrit_devanagari = verse_data["sanskrit_devanagari"]

        if verse_data.get("translation_en"):
            existing_verse.translation_en = verse_data["translation_en"]

        if verse_data.get("paraphrase_en"):
            existing_verse.paraphrase_en = verse_data["paraphrase_en"]

        if verse_data.get("consulting_principles"):
            existing_verse.consulting_principles = verse_data["consulting_principles"]

        if verse_data.get("source"):
            existing_verse.source = verse_data["source"]

        if verse_data.get("license"):
            existing_verse.license = verse_data["license"]

        self.db.flush()

        logger.debug(f"Updated verse {existing_verse.canonical_id}")

        return existing_verse

    def _persist_embedding(self, verse: Verse, verse_data: Dict):
        """
        Generate and persist embedding to vector store.

        Args:
            verse: Verse model instance
            verse_data: Verse dictionary
        """
        # Prepare text for embedding (sanskrit_iast + paraphrase)
        text_parts = []

        if verse_data.get("sanskrit_iast"):
            text_parts.append(verse_data["sanskrit_iast"])

        if verse_data.get("paraphrase_en"):
            text_parts.append(verse_data["paraphrase_en"])

        if not text_parts:
            logger.warning(f"No text for embedding: {verse.canonical_id}")
            return

        combined_text = " ".join(text_parts)

        # Generate embedding
        embedding = self.embedding_service.encode(combined_text)

        # Prepare metadata (ChromaDB only accepts str, int, float, bool - not None or list)
        metadata = {}

        # Only add chapter/verse if they have valid values
        if verse.chapter is not None:
            metadata["chapter"] = verse.chapter
        if verse.verse is not None:
            metadata["verse"] = verse.verse

        # Add paraphrase for use in consultation prompts
        if verse_data.get("paraphrase_en"):
            metadata["paraphrase"] = verse_data["paraphrase_en"]

        # Add consulting principles as comma-separated string if present
        consulting_principles = verse_data.get("consulting_principles")
        if consulting_principles and isinstance(consulting_principles, list):
            metadata["principles"] = ",".join(consulting_principles)
        elif consulting_principles:
            metadata["principles"] = str(consulting_principles)

        # Add to vector store (will overwrite if exists)
        try:
            # Delete existing if present
            existing = self.vector_store.get_by_id(verse.canonical_id)
            if existing:
                self.vector_store.delete_verse(verse.canonical_id)

            # Add new
            self.vector_store.add_verse(
                canonical_id=verse.canonical_id,
                text=combined_text,
                metadata=metadata,
                embedding=embedding
            )

            logger.debug(f"Persisted embedding for {verse.canonical_id}")

        except Exception as e:
            logger.error(f"Failed to persist embedding for {verse.canonical_id}: {e}")
            # Don't fail the whole operation if embedding fails

    def persist_translation(
        self,
        verse_id: str,
        translation_data: Dict
    ) -> Translation:
        """
        Persist a translation for a verse.

        Args:
            verse_id: Verse ID (UUID)
            translation_data: Translation dictionary

        Returns:
            Created Translation instance
        """
        translation = Translation(
            id=str(uuid.uuid4()),
            verse_id=verse_id,
            text=translation_data["text"],
            language=translation_data.get("language", "en"),
            translator=translation_data.get("translator", ""),
            school=translation_data.get("school", ""),
            source=translation_data.get("source", ""),
            license=translation_data.get("license", ""),
            year=translation_data.get("year")
        )

        self.db.add(translation)
        self.db.flush()

        logger.debug(f"Created translation for verse {verse_id}")

        return translation

    def persist_batch(
        self,
        verses_data: List[Dict],
        batch_size: int = 50
    ) -> Dict[str, int]:
        """
        Persist multiple verses in batches with transaction handling.

        Args:
            verses_data: List of verse dictionaries
            batch_size: Number of verses per batch

        Returns:
            Dictionary with statistics (created, updated, errors)
        """
        stats = {"created": 0, "updated": 0, "errors": 0, "skipped": 0}

        total = len(verses_data)
        logger.info(f"Persisting {total} verses in batches of {batch_size}")

        for i in range(0, total, batch_size):
            batch = verses_data[i:i + batch_size]

            try:
                for verse_data in batch:
                    try:
                        # Check if exists
                        canonical_id = verse_data["canonical_id"]
                        existing = self.db.query(Verse).filter_by(
                            canonical_id=canonical_id
                        ).first()

                        # Check if this is translation-only data
                        is_translation_data = verse_data.get("_is_translation_data", False)

                        if existing:
                            self._update_verse(existing, verse_data)
                            stats["updated"] += 1
                            verse_instance = existing
                        elif is_translation_data:
                            # GAP FIX: Translation-only data should NOT create new verses
                            # Verses must exist first (from sanskrit source)
                            logger.warning(
                                f"Skipping translation for non-existent verse: {canonical_id}. "
                                "Run sanskrit ingestion first."
                            )
                            stats["skipped"] += 1
                            continue
                        else:
                            verse = self._create_verse(verse_data)
                            stats["created"] += 1
                            verse_instance = verse

                        # Persist embedding (skip for translation-only updates to avoid overwriting)
                        if not is_translation_data:
                            self._persist_embedding(verse_instance, verse_data)

                        # Handle single translation if present (legacy format)
                        if verse_data.get("translation_text"):
                            translation_data = {
                                "text": verse_data["translation_text"],
                                "translator": verse_data.get("translator"),
                                "year": verse_data.get("year"),
                                "source": verse_data.get("source"),
                                "license": verse_data.get("license"),
                            }
                            self.persist_translation(
                                verse_instance.id,
                                translation_data
                            )

                        # Handle multiple translations array (from translation.json)
                        if verse_data.get("translations"):
                            for trans in verse_data["translations"]:
                                # Check if this translation already exists
                                existing_trans = self.db.query(Translation).filter_by(
                                    verse_id=verse_instance.id,
                                    translator=trans.get("translator", "")
                                ).first()

                                if not existing_trans:
                                    translation_data = {
                                        "text": trans.get("text", ""),
                                        "translator": trans.get("translator", ""),
                                        "school": trans.get("school", ""),
                                        "source": trans.get("source", ""),
                                        "license": trans.get("license", ""),
                                    }
                                    self.persist_translation(
                                        verse_instance.id,
                                        translation_data
                                    )

                    except Exception as e:
                        logger.error(f"Failed to persist verse {verse_data.get('canonical_id')}: {e}")
                        stats["errors"] += 1

                # Commit batch
                self.db.commit()
                logger.info(f"Committed batch {i // batch_size + 1}: {i + len(batch)}/{total}")

            except Exception as e:
                logger.error(f"Batch commit failed: {e}")
                self.db.rollback()
                stats["errors"] += len(batch)

        logger.info(f"Batch persist complete: {stats}")
        return stats

    def get_statistics(self) -> Dict:
        """
        Get persistence statistics.

        Returns:
            Dictionary with database and vector store stats
        """
        db_count = self.db.query(Verse).count()
        vector_count = self.vector_store.count()

        return {
            "database_verses": db_count,
            "vector_store_verses": vector_count,
            "sync_status": "OK" if db_count == vector_count else "OUT_OF_SYNC"
        }
