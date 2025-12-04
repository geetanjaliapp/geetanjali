"""Vector store service using ChromaDB."""

import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from config import settings
from services.embeddings import get_embedding_service

logger = logging.getLogger(__name__)


class VectorStore:
    """Service for storing and retrieving verse embeddings."""

    def __init__(self):
        """Initialize ChromaDB client and collection."""
        # Use HTTP client if CHROMA_HOST is set (for Docker/remote), otherwise local
        if settings.CHROMA_HOST:
            logger.info(
                f"Initializing ChromaDB HTTP client: {settings.CHROMA_HOST}:{settings.CHROMA_PORT}"
            )
            self.client = chromadb.HttpClient(
                host=settings.CHROMA_HOST, port=settings.CHROMA_PORT
            )
        else:
            logger.info(
                f"Initializing ChromaDB local client at: {settings.CHROMA_PERSIST_DIRECTORY}"
            )
            self.client = chromadb.Client(
                ChromaSettings(
                    persist_directory=settings.CHROMA_PERSIST_DIRECTORY,
                    anonymized_telemetry=False,
                )
            )

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"description": "Bhagavad Geeta verses for RAG retrieval"},
        )

        logger.info(f"ChromaDB collection '{settings.CHROMA_COLLECTION_NAME}' ready")

        # Get embedding service
        self.embedding_service = get_embedding_service()

    def add_verse(
        self,
        canonical_id: str,
        text: str,
        metadata: Dict[str, Any],
        embedding: Optional[List[float]] = None,
    ):
        """
        Add a verse to the vector store.

        Args:
            canonical_id: Canonical verse ID
            text: Verse text (Sanskrit + paraphrase)
            metadata: Additional metadata
            embedding: Pre-computed embedding (optional)
        """
        # Generate embedding if not provided
        if embedding is None:
            embedding = self.embedding_service.encode(text)

        # Add to collection
        self.collection.add(
            ids=[canonical_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata],
        )

        logger.debug(f"Added verse {canonical_id} to vector store")

    @retry(
        stop=stop_after_attempt(settings.CHROMA_MAX_RETRIES),
        wait=wait_exponential(
            min=settings.CHROMA_RETRY_MIN_WAIT, max=settings.CHROMA_RETRY_MAX_WAIT
        ),
        retry=retry_if_exception_type((chromadb.errors.ChromaError, ConnectionError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def add_verses_batch(
        self,
        canonical_ids: List[str],
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        embeddings: Optional[List[List[float]]] = None,
    ):
        """
        Add multiple verses in batch.

        Args:
            canonical_ids: List of canonical verse IDs
            texts: List of verse texts
            metadatas: List of metadata dicts
            embeddings: Pre-computed embeddings (optional)

        Raises:
            ChromaError: If batch add fails after retries
        """
        # Generate embeddings if not provided
        if embeddings is None:
            embeddings = self.embedding_service.encode(texts)

        # Add to collection
        self.collection.add(
            ids=canonical_ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )

        logger.info(f"Added {len(canonical_ids)} verses to vector store")

    @retry(
        stop=stop_after_attempt(settings.CHROMA_MAX_RETRIES),
        wait=wait_exponential(
            min=settings.CHROMA_RETRY_MIN_WAIT, max=settings.CHROMA_RETRY_MAX_WAIT
        ),
        retry=retry_if_exception_type((chromadb.errors.ChromaError, ConnectionError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def search(
        self, query: str, top_k: int = 5, where: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Search for similar verses using vector similarity.

        Args:
            query: Query text
            top_k: Number of results to return
            where: Metadata filter (optional)

        Returns:
            Search results with ids, distances, documents, metadatas

        Raises:
            ChromaError: If search fails after retries
        """
        # Generate query embedding
        query_embedding = self.embedding_service.encode(query)

        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding], n_results=top_k, where=where
        )

        logger.debug(
            f"Vector search for '{query[:50]}...' returned {len(results['ids'][0])} results"
        )

        return {
            "ids": results["ids"][0],
            "distances": results["distances"][0],
            "documents": results["documents"][0],
            "metadatas": results["metadatas"][0],
        }

    def get_by_id(self, canonical_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a verse by canonical ID.

        Args:
            canonical_id: Canonical verse ID

        Returns:
            Verse data or None if not found
        """
        try:
            result = self.collection.get(ids=[canonical_id])
            if result["ids"]:
                return {
                    "id": result["ids"][0],
                    "document": result["documents"][0],
                    "metadata": result["metadatas"][0],
                }
        except Exception as e:
            logger.error(f"Error getting verse {canonical_id}: {e}")

        return None

    def delete_verse(self, canonical_id: str):
        """
        Delete a verse from the vector store.

        Args:
            canonical_id: Canonical verse ID
        """
        self.collection.delete(ids=[canonical_id])
        logger.debug(f"Deleted verse {canonical_id} from vector store")

    def count(self) -> int:
        """
        Get total number of verses in the store.

        Returns:
            Count of verses
        """
        return int(self.collection.count())

    def reset(self):
        """
        Clear all verses from the store.

        Warning: This deletes all data!
        """
        self.client.delete_collection(settings.CHROMA_COLLECTION_NAME)
        self.collection = self.client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"description": "Bhagavad Geeta verses for RAG retrieval"},
        )
        logger.warning("Vector store reset - all verses deleted")


# Global vector store instance
_vector_store = None


def get_vector_store() -> VectorStore:
    """
    Get or create the global vector store instance.

    Returns:
        VectorStore instance
    """
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
