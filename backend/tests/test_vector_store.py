"""Tests for vector store service.

These tests require ChromaDB and are skipped in CI environments.
Run locally with: pytest tests/test_vector_store.py -v

Circuit breaker tests are unit tests and run without ChromaDB.
"""

import os
import uuid
from unittest.mock import patch

import pytest

# Mark as slow (infrastructure-dependent) and skip in CI
pytestmark = [
    pytest.mark.slow,
    pytest.mark.skipif(
        os.environ.get("CI") == "true" or os.environ.get("SKIP_VECTOR_TESTS") == "true",
        reason="Vector store tests require ChromaDB and are skipped in CI",
    ),
]


# Module-level shared client to avoid ChromaDB singleton conflicts.
# ChromaDB doesn't allow multiple ephemeral clients with different settings,
# so we create one client and reuse it across all tests in this module.
_shared_chroma_client = None


def get_shared_client():
    """Get or create a shared ChromaDB client for all tests.

    Uses ephemeral (in-memory) storage. The client persists for the duration
    of the test session. Each test uses a unique collection name for isolation.
    """
    global _shared_chroma_client
    if _shared_chroma_client is None:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        _shared_chroma_client = chromadb.Client(
            ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True,
            )
        )
    return _shared_chroma_client


@pytest.fixture(autouse=True)
def reset_vector_store_singleton():
    """Reset vector store singleton before and after each test."""
    import services.vector_store

    services.vector_store._vector_store = None
    yield
    services.vector_store._vector_store = None


class TestVectorStore:
    """Tests for VectorStore service."""

    @pytest.fixture
    def vector_store_env(self):
        """Set up environment for VectorStore tests with shared client."""
        collection_name = f"test_verses_{uuid.uuid4().hex[:8]}"
        shared_client = get_shared_client()

        with patch("services.vector_store.settings") as mock_settings:
            mock_settings.CHROMA_HOST = None  # Use local client
            mock_settings.CHROMA_PORT = 8000
            mock_settings.CHROMA_PERSIST_DIRECTORY = None
            mock_settings.CHROMA_COLLECTION_NAME = collection_name
            mock_settings.EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
            mock_settings.CHROMA_MAX_RETRIES = 3
            mock_settings.CHROMA_RETRY_MIN_WAIT = 1
            mock_settings.CHROMA_RETRY_MAX_WAIT = 5

            # Patch chromadb.Client to return shared client
            with patch(
                "services.vector_store.chromadb.Client", return_value=shared_client
            ):
                yield {
                    "client": shared_client,
                    "collection_name": collection_name,
                    "settings": mock_settings,
                }

        # Cleanup: delete the test collection if it exists
        try:
            shared_client.delete_collection(collection_name)
        except ValueError:
            # Collection doesn't exist (already deleted or never created)
            pass

    def test_vector_store_initialization(self, vector_store_env):
        """Test VectorStore initializes correctly."""
        from services.vector_store import VectorStore

        store = VectorStore()

        assert store.client is not None
        assert store.collection is not None
        assert store.embedding_function is not None

    def test_add_verse(self, vector_store_env):
        """Test adding a verse to the store."""
        from services.vector_store import VectorStore

        store = VectorStore()

        store.add_verse(
            canonical_id="BG_2_47",
            text="You have a right to perform your prescribed duties.",
            metadata={"chapter": 2, "verse": 47},
        )

        count = store.count()
        assert count == 1

    def test_add_verses_batch(self, vector_store_env):
        """Test adding multiple verses in batch."""
        from services.vector_store import VectorStore

        store = VectorStore()

        store.add_verses_batch(
            canonical_ids=["BG_2_47", "BG_2_48", "BG_2_49"],
            texts=[
                "You have a right to perform your prescribed duties.",
                "Perform your duty equipoised.",
                "Seek refuge in wisdom.",
            ],
            metadatas=[
                {"chapter": 2, "verse": 47},
                {"chapter": 2, "verse": 48},
                {"chapter": 2, "verse": 49},
            ],
        )

        count = store.count()
        assert count == 3

    def test_search_returns_results(self, vector_store_env):
        """Test search returns relevant results."""
        from services.vector_store import VectorStore

        store = VectorStore()

        # Add verses
        store.add_verses_batch(
            canonical_ids=["BG_2_47", "BG_3_35"],
            texts=[
                "You have a right to perform your prescribed duties.",
                "It is better to follow your own dharma imperfectly.",
            ],
            metadatas=[
                {"chapter": 2, "verse": 47},
                {"chapter": 3, "verse": 35},
            ],
        )

        # Search
        results = store.search("What are my duties?", top_k=2)

        assert "ids" in results
        assert "distances" in results
        assert "documents" in results
        assert len(results["ids"]) <= 2

    def test_get_by_id(self, vector_store_env):
        """Test getting verse by ID."""
        from services.vector_store import VectorStore

        store = VectorStore()

        store.add_verse(
            canonical_id="BG_2_47",
            text="You have a right to perform your prescribed duties.",
            metadata={"chapter": 2, "verse": 47},
        )

        result = store.get_by_id("BG_2_47")

        assert result is not None
        assert result["id"] == "BG_2_47"

    def test_get_by_id_not_found(self, vector_store_env):
        """Test getting non-existent verse returns None."""
        from services.vector_store import VectorStore

        store = VectorStore()

        result = store.get_by_id("NONEXISTENT")

        assert result is None

    def test_delete_verse(self, vector_store_env):
        """Test deleting a verse."""
        from services.vector_store import VectorStore

        store = VectorStore()

        store.add_verse(
            canonical_id="BG_2_47",
            text="Test verse",
            metadata={"chapter": 2, "verse": 47},
        )

        assert store.count() == 1

        store.delete_verse("BG_2_47")

        assert store.count() == 0

    def test_count(self, vector_store_env):
        """Test counting verses."""
        from services.vector_store import VectorStore

        store = VectorStore()

        assert store.count() == 0

        store.add_verse("BG_1_1", "Test", {"chapter": 1})

        assert store.count() == 1

    def test_reset(self, vector_store_env):
        """Test resetting the store."""
        from services.vector_store import VectorStore

        store = VectorStore()

        store.add_verses_batch(
            canonical_ids=["BG_1", "BG_2", "BG_3"],
            texts=["One", "Two", "Three"],
            metadatas=[{"index": 1}, {"index": 2}, {"index": 3}],
        )

        assert store.count() == 3

        store.reset()

        assert store.count() == 0

    def test_get_vector_store_singleton(self, vector_store_env):
        """Test get_vector_store returns singleton."""
        from services.vector_store import get_vector_store

        store1 = get_vector_store()
        store2 = get_vector_store()

        assert store1 is store2


# Circuit breaker tests are in test_vector_store_circuit_breaker.py
# (separate file to avoid module-level skip markers)
