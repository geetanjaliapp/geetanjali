"""Vector store service using ChromaDB with built-in embeddings."""

import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from config import settings
from utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpen
from utils.metrics import chromadb_circuit_breaker_state

logger = logging.getLogger(__name__)


class VectorStoreCircuitBreaker(CircuitBreaker):
    """
    Circuit breaker for ChromaDB vector store.

    When ChromaDB fails repeatedly, the circuit opens and callers
    should fall back to SQL-based keyword search.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 60.0,
    ):
        """
        Initialize vector store circuit breaker.

        Args:
            failure_threshold: Consecutive failures before opening (default: 3)
            recovery_timeout: Seconds before testing recovery (default: 60)
        """
        super().__init__(
            name="chromadb",
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )

    def _update_metric(self, state: str) -> None:
        """Update Prometheus gauge for circuit breaker state."""
        chromadb_circuit_breaker_state.set(self.STATE_VALUES.get(state, 0))


class VectorStore:
    """Service for storing and retrieving verse embeddings."""

    def __init__(self):
        """Initialize ChromaDB client and collection with built-in embeddings."""
        # Circuit breaker for ChromaDB operations (uses config settings)
        self._circuit_breaker: VectorStoreCircuitBreaker = VectorStoreCircuitBreaker(
            failure_threshold=settings.CB_CHROMADB_FAILURE_THRESHOLD,
            recovery_timeout=float(settings.CB_CHROMADB_RECOVERY_TIMEOUT),
        )

        # Create embedding function - ChromaDB will handle embeddings internally
        # Using the same model as before: all-MiniLM-L6-v2
        self.embedding_function = (
            embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.EMBEDDING_MODEL
            )
        )

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

        # Get or create collection with embedding function
        self.collection = self.client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"description": "Bhagavad Geeta verses for RAG retrieval"},
            embedding_function=self.embedding_function,
        )

        logger.info(
            f"ChromaDB collection '{settings.CHROMA_COLLECTION_NAME}' ready with built-in embeddings"
        )

    @property
    def circuit_breaker(self) -> VectorStoreCircuitBreaker:
        """Get the circuit breaker instance for external status checks."""
        return self._circuit_breaker

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
            embedding: Pre-computed embedding (optional, for migration compatibility)
        """
        # Add to collection - ChromaDB will generate embedding from text
        # if embedding is provided (legacy), use it; otherwise let ChromaDB embed
        if embedding is not None:
            self.collection.add(
                ids=[canonical_id],
                embeddings=[embedding],
                documents=[text],
                metadatas=[metadata],
            )
        else:
            # Let ChromaDB's embedding function handle it
            self.collection.add(
                ids=[canonical_id],
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
            embeddings: Pre-computed embeddings (optional, for migration compatibility)

        Raises:
            ChromaError: If batch add fails after retries
        """
        # Add to collection - ChromaDB will generate embeddings from texts
        if embeddings is not None:
            self.collection.add(
                ids=canonical_ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
            )
        else:
            # Let ChromaDB's embedding function handle it
            self.collection.add(
                ids=canonical_ids,
                documents=texts,
                metadatas=metadatas,
            )

        logger.info(f"Added {len(canonical_ids)} verses to vector store")

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
            CircuitBreakerOpen: If circuit breaker is open (caller should use SQL fallback)
            ChromaError: If search fails after retries
        """
        # Check circuit breaker before attempting search
        if not self._circuit_breaker.allow_request():
            raise CircuitBreakerOpen(
                self._circuit_breaker.name,
                self._circuit_breaker.recovery_timeout,
            )

        try:
            result = self._search_with_retry(query, top_k, where)
            self._circuit_breaker.record_success()
            return result
        except (chromadb.errors.ChromaError, ConnectionError) as e:
            # Record failure after retries exhaust
            self._circuit_breaker.record_failure()
            logger.warning(f"ChromaDB search failed after retries: {e}")
            raise

    @retry(
        stop=stop_after_attempt(settings.CHROMA_MAX_RETRIES),
        wait=wait_exponential(
            min=settings.CHROMA_RETRY_MIN_WAIT, max=settings.CHROMA_RETRY_MAX_WAIT
        ),
        retry=retry_if_exception_type((chromadb.errors.ChromaError, ConnectionError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _search_with_retry(
        self, query: str, top_k: int = 5, where: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Internal search method with retry logic.

        This is separated from search() so circuit breaker failures are only
        recorded after all retries are exhausted.
        """
        # Search using query text - ChromaDB's embedding function handles embedding
        results = self.collection.query(
            query_texts=[query], n_results=top_k, where=where
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
            embedding_function=self.embedding_function,
        )
        logger.warning("Vector store reset - all verses deleted")

    def cleanup(self) -> None:
        """
        Clean up resources held by the vector store.

        Releases the embedding model and closes client connections.
        Should be called during application shutdown.
        """
        try:
            # Release embedding function reference (allows GC of model)
            if hasattr(self, "embedding_function"):
                self.embedding_function = None

            # ChromaDB HTTP client cleanup (if using HTTP client)
            if hasattr(self, "client") and self.client is not None:
                # Note: ChromaDB HttpClient doesn't have an explicit close method,
                # but setting to None allows garbage collection
                self.client = None

            self.collection = None
            logger.debug("Vector store cleanup complete")
        except Exception as e:
            logger.warning(f"Error during vector store cleanup: {e}")


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


def cleanup_vector_store() -> None:
    """
    Clean up the global vector store instance.

    Should be called during application shutdown.
    """
    global _vector_store
    if _vector_store is not None:
        _vector_store.cleanup()
        _vector_store = None
        logger.info("Vector store cleaned up")
