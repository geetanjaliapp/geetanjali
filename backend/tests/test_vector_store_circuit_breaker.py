"""Tests for VectorStore circuit breaker functionality.

These are unit tests that don't require ChromaDB infrastructure.
"""

import time
import pytest
from unittest.mock import patch, MagicMock

# Mark all tests in this module as unit tests (fast, no infrastructure needed)
pytestmark = pytest.mark.unit


class TestVectorStoreCircuitBreaker:
    """Tests for VectorStoreCircuitBreaker class."""

    def test_circuit_breaker_initial_state(self):
        """Test circuit breaker starts in closed state."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker()
        assert cb.state == "closed"
        assert cb.failure_count == 0

    def test_circuit_breaker_opens_after_failures(self):
        """Test circuit breaker opens after threshold failures."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker(failure_threshold=3, recovery_timeout=60)

        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"
        assert cb.allow_request()

        cb.record_failure()  # Third failure should open circuit
        assert cb.state == "open"
        assert not cb.allow_request()

    def test_circuit_breaker_resets_on_success(self):
        """Test circuit breaker resets to closed on success."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker(failure_threshold=3)

        # Accumulate some failures
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2

        # Success resets
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == "closed"

    def test_circuit_breaker_half_open_after_timeout(self):
        """Test circuit breaker transitions to half_open after recovery timeout."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"
        assert not cb.allow_request()

        # Wait for recovery
        time.sleep(0.15)

        # Should transition to half_open
        assert cb.allow_request()
        assert cb.state == "half_open"

    def test_circuit_breaker_half_open_success_closes(self):
        """Test successful request in half_open state closes circuit."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for recovery
        time.sleep(0.15)
        cb.allow_request()  # Transition to half_open

        # Success should close circuit
        cb.record_success()
        assert cb.state == "closed"
        assert cb.failure_count == 0

    def test_circuit_breaker_half_open_failure_reopens(self):
        """Test failed request in half_open state reopens circuit."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        # Wait for recovery
        time.sleep(0.15)
        cb.allow_request()  # Transition to half_open

        # Failure should reopen circuit
        cb.record_failure()
        assert cb.state == "open"

    def test_circuit_breaker_name(self):
        """Test circuit breaker has correct name."""
        from services.vector_store import VectorStoreCircuitBreaker

        cb = VectorStoreCircuitBreaker()
        assert cb.name == "chromadb"


class TestVectorStoreCircuitBreakerIntegration:
    """Tests for circuit breaker integration with VectorStore."""

    @pytest.fixture(autouse=True)
    def reset_vector_store_singleton(self):
        """Reset vector store singleton before and after each test."""
        import services.vector_store

        services.vector_store._vector_store = None
        yield
        services.vector_store._vector_store = None

    def test_search_raises_circuit_breaker_open_when_open(self):
        """Test search raises CircuitBreakerOpen when circuit is open."""
        from services.vector_store import VectorStore
        from utils.circuit_breaker import CircuitBreakerOpen

        with patch("services.vector_store.settings") as mock_settings:
            mock_settings.CHROMA_HOST = None
            mock_settings.CHROMA_PORT = 8000
            mock_settings.CHROMA_PERSIST_DIRECTORY = "./test_chroma"
            mock_settings.CHROMA_COLLECTION_NAME = "test"
            mock_settings.EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
            mock_settings.CHROMA_MAX_RETRIES = 1
            mock_settings.CHROMA_RETRY_MIN_WAIT = 0.1
            mock_settings.CHROMA_RETRY_MAX_WAIT = 0.5

            with patch("services.vector_store.chromadb.Client"):
                with patch(
                    "services.vector_store.embedding_functions.SentenceTransformerEmbeddingFunction"
                ):
                    store = VectorStore()

            # Open the circuit manually
            store._circuit_breaker.record_failure()
            store._circuit_breaker.record_failure()
            store._circuit_breaker.record_failure()
            assert store._circuit_breaker.state == "open"

            # Should raise CircuitBreakerOpen
            with pytest.raises(CircuitBreakerOpen):
                store.search("test query")

    def test_search_records_success(self):
        """Test successful search records success on circuit breaker."""
        from services.vector_store import VectorStore

        with patch("services.vector_store.settings") as mock_settings:
            mock_settings.CHROMA_HOST = None
            mock_settings.CHROMA_PORT = 8000
            mock_settings.CHROMA_PERSIST_DIRECTORY = "./test_chroma"
            mock_settings.CHROMA_COLLECTION_NAME = "test"
            mock_settings.EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
            mock_settings.CHROMA_MAX_RETRIES = 1
            mock_settings.CHROMA_RETRY_MIN_WAIT = 0.1
            mock_settings.CHROMA_RETRY_MAX_WAIT = 0.5

            mock_collection = MagicMock()
            mock_collection.query.return_value = {
                "ids": [["BG_2_47"]],
                "distances": [[0.1]],
                "documents": [["Test document"]],
                "metadatas": [[{"chapter": 2}]],
            }

            with patch("services.vector_store.chromadb.Client") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.get_or_create_collection.return_value = mock_collection
                mock_client_cls.return_value = mock_client

                with patch(
                    "services.vector_store.embedding_functions.SentenceTransformerEmbeddingFunction"
                ):
                    store = VectorStore()

            # Add a failure first
            store._circuit_breaker.record_failure()
            assert store._circuit_breaker.failure_count == 1

            # Successful search should reset failure count
            result = store.search("test query")
            assert store._circuit_breaker.failure_count == 0
            assert result["ids"] == ["BG_2_47"]

    def test_search_records_failure_after_retries(self):
        """Test failed search records failure on circuit breaker after retries."""
        from services.vector_store import VectorStore

        with patch("services.vector_store.settings") as mock_settings:
            mock_settings.CHROMA_HOST = None
            mock_settings.CHROMA_PORT = 8000
            mock_settings.CHROMA_PERSIST_DIRECTORY = "./test_chroma"
            mock_settings.CHROMA_COLLECTION_NAME = "test"
            mock_settings.EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
            mock_settings.CHROMA_MAX_RETRIES = 2
            mock_settings.CHROMA_RETRY_MIN_WAIT = 0.01
            mock_settings.CHROMA_RETRY_MAX_WAIT = 0.02

            mock_collection = MagicMock()
            mock_collection.query.side_effect = ConnectionError("ChromaDB unavailable")

            with patch("services.vector_store.chromadb.Client") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.get_or_create_collection.return_value = mock_collection
                mock_client_cls.return_value = mock_client

                with patch(
                    "services.vector_store.embedding_functions.SentenceTransformerEmbeddingFunction"
                ):
                    store = VectorStore()

            assert store._circuit_breaker.failure_count == 0

            # Failed search should record failure after retries exhaust
            with pytest.raises(ConnectionError):
                store.search("test query")

            # Failure recorded after retries
            assert store._circuit_breaker.failure_count == 1

    def test_vector_store_has_circuit_breaker_property(self):
        """Test VectorStore exposes circuit breaker via property."""
        from services.vector_store import VectorStore, VectorStoreCircuitBreaker

        with patch("services.vector_store.settings") as mock_settings:
            mock_settings.CHROMA_HOST = None
            mock_settings.CHROMA_PORT = 8000
            mock_settings.CHROMA_PERSIST_DIRECTORY = "./test_chroma"
            mock_settings.CHROMA_COLLECTION_NAME = "test"
            mock_settings.EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

            with patch("services.vector_store.chromadb.Client"):
                with patch(
                    "services.vector_store.embedding_functions.SentenceTransformerEmbeddingFunction"
                ):
                    store = VectorStore()

            assert hasattr(store, "circuit_breaker")
            assert isinstance(store.circuit_breaker, VectorStoreCircuitBreaker)
