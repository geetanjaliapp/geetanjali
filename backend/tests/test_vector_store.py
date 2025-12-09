"""Tests for vector store service."""

import pytest
import uuid
from unittest.mock import patch


class TestVectorStore:
    """Tests for VectorStore service."""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for tests with unique collection name."""
        # Use unique collection name per test to avoid state isolation issues
        collection_name = f"test_verses_{uuid.uuid4().hex[:8]}"
        with patch("services.vector_store.settings") as mock:
            mock.CHROMA_HOST = None  # Use local client
            mock.CHROMA_PORT = 8000
            mock.CHROMA_PERSIST_DIRECTORY = ":memory:"
            mock.CHROMA_COLLECTION_NAME = collection_name
            mock.EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
            mock.CHROMA_MAX_RETRIES = 3
            mock.CHROMA_RETRY_MIN_WAIT = 1
            mock.CHROMA_RETRY_MAX_WAIT = 5
            yield mock

    def test_vector_store_initialization(self, mock_settings):
        """Test VectorStore initializes correctly."""
        from services.vector_store import VectorStore

        store = VectorStore()

        assert store.client is not None
        assert store.collection is not None
        assert store.embedding_function is not None

    def test_add_verse(self, mock_settings):
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

    def test_add_verses_batch(self, mock_settings):
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

    def test_search_returns_results(self, mock_settings):
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

    def test_get_by_id(self, mock_settings):
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

    def test_get_by_id_not_found(self, mock_settings):
        """Test getting non-existent verse returns None."""
        from services.vector_store import VectorStore

        store = VectorStore()

        result = store.get_by_id("NONEXISTENT")

        assert result is None

    def test_delete_verse(self, mock_settings):
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

    def test_count(self, mock_settings):
        """Test counting verses."""
        from services.vector_store import VectorStore

        store = VectorStore()

        assert store.count() == 0

        store.add_verse("BG_1_1", "Test", {"chapter": 1})

        assert store.count() == 1

    def test_reset(self, mock_settings):
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

    def test_get_vector_store_singleton(self, mock_settings):
        """Test get_vector_store returns singleton."""
        # Reset singleton
        import services.vector_store

        services.vector_store._vector_store = None

        from services.vector_store import get_vector_store

        store1 = get_vector_store()
        store2 = get_vector_store()

        assert store1 is store2
