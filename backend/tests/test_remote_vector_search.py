"""Tests for remote vector search client (v1.37.0).

Tests for RemoteVectorSearch client used by worker to delegate
vector search to backend.
"""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from utils.circuit_breaker import CircuitBreakerOpen


@pytest.mark.unit
class TestRemoteVectorSearchInit:
    """Tests for RemoteVectorSearch initialization."""

    def test_init_requires_url_and_key(self):
        """Should require both URL and API key."""
        with patch("services.remote_vector_search.settings") as mock_settings:
            mock_settings.VECTOR_SEARCH_URL = ""
            mock_settings.INTERNAL_API_KEY = "key"

            from services.remote_vector_search import RemoteVectorSearch

            with pytest.raises(ValueError) as exc_info:
                RemoteVectorSearch()

            assert "VECTOR_SEARCH_URL" in str(exc_info.value)

    def test_init_requires_api_key(self):
        """Should require API key."""
        with patch("services.remote_vector_search.settings") as mock_settings:
            mock_settings.VECTOR_SEARCH_URL = "http://backend:8000/internal/search"
            mock_settings.INTERNAL_API_KEY = None

            from services.remote_vector_search import RemoteVectorSearch

            with pytest.raises(ValueError) as exc_info:
                RemoteVectorSearch()

            assert "INTERNAL_API_KEY" in str(exc_info.value)


@pytest.mark.unit
class TestRemoteVectorSearchSearch:
    """Tests for RemoteVectorSearch.search() method."""

    def test_search_returns_correct_format(self):
        """Remote search returns VectorStore-compatible format."""
        with patch("services.remote_vector_search.settings") as mock_settings:
            mock_settings.VECTOR_SEARCH_URL = "http://backend:8000/internal/search"
            mock_settings.INTERNAL_API_KEY = "test-key"
            mock_settings.CHROMA_RETRY_MAX_WAIT = 5
            mock_settings.CHROMA_MAX_RETRIES = 3
            mock_settings.CHROMA_RETRY_MIN_WAIT = 1

            with patch("httpx.Client") as mock_client_class:
                mock_response = MagicMock()
                mock_response.json.return_value = {
                    "ids": ["BG_2_47"],
                    "documents": ["Test doc"],
                    "distances": [0.3],
                    "metadatas": [{"chapter": 2}],
                }
                mock_response.raise_for_status = MagicMock()

                mock_client = MagicMock()
                mock_client.post.return_value = mock_response
                mock_client_class.return_value = mock_client

                from services.remote_vector_search import RemoteVectorSearch

                remote = RemoteVectorSearch()
                result = remote.search("dharma", top_k=3)

                assert result["ids"] == ["BG_2_47"]
                assert result["documents"] == ["Test doc"]
                assert result["distances"] == [0.3]
                assert result["metadatas"] == [{"chapter": 2}]

                mock_client.post.assert_called_once()
                call_args = mock_client.post.call_args
                assert call_args[0][0] == "http://backend:8000/internal/search"
                assert call_args[1]["json"] == {"query": "dharma", "top_k": 3}

    def test_search_raises_circuit_breaker_on_http_error(self):
        """Should raise CircuitBreakerOpen on HTTP errors for RAGPipeline compatibility."""
        with patch("services.remote_vector_search.settings") as mock_settings:
            mock_settings.VECTOR_SEARCH_URL = "http://backend:8000/internal/search"
            mock_settings.INTERNAL_API_KEY = "test-key"
            mock_settings.CHROMA_RETRY_MAX_WAIT = 5
            mock_settings.CHROMA_MAX_RETRIES = 1  # Single attempt for faster test
            mock_settings.CHROMA_RETRY_MIN_WAIT = 0

            with patch("httpx.Client") as mock_client_class:
                mock_response = MagicMock()
                mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                    "500 Internal Server Error",
                    request=MagicMock(),
                    response=MagicMock(),
                )

                mock_client = MagicMock()
                mock_client.post.return_value = mock_response
                mock_client_class.return_value = mock_client

                from services.remote_vector_search import RemoteVectorSearch

                remote = RemoteVectorSearch()

                with pytest.raises(CircuitBreakerOpen) as exc_info:
                    remote.search("dharma")

                assert exc_info.value.name == "remote_vector_search"

    def test_search_raises_circuit_breaker_on_connect_error(self):
        """Should raise CircuitBreakerOpen on connection errors."""
        with patch("services.remote_vector_search.settings") as mock_settings:
            mock_settings.VECTOR_SEARCH_URL = "http://backend:8000/internal/search"
            mock_settings.INTERNAL_API_KEY = "test-key"
            mock_settings.CHROMA_RETRY_MAX_WAIT = 5
            mock_settings.CHROMA_MAX_RETRIES = 1
            mock_settings.CHROMA_RETRY_MIN_WAIT = 0

            with patch("httpx.Client") as mock_client_class:
                mock_client = MagicMock()
                mock_client.post.side_effect = httpx.ConnectError("Connection refused")
                mock_client_class.return_value = mock_client

                from services.remote_vector_search import RemoteVectorSearch

                remote = RemoteVectorSearch()

                with pytest.raises(CircuitBreakerOpen):
                    remote.search("dharma")


@pytest.mark.unit
class TestRemoteVectorSearchCleanup:
    """Tests for RemoteVectorSearch cleanup."""

    def test_cleanup_closes_client(self):
        """Should close HTTP client on cleanup."""
        with patch("services.remote_vector_search.settings") as mock_settings:
            mock_settings.VECTOR_SEARCH_URL = "http://backend:8000/internal/search"
            mock_settings.INTERNAL_API_KEY = "test-key"
            mock_settings.CHROMA_RETRY_MAX_WAIT = 5

            with patch("httpx.Client") as mock_client_class:
                mock_client = MagicMock()
                mock_client_class.return_value = mock_client

                from services.remote_vector_search import RemoteVectorSearch

                remote = RemoteVectorSearch()
                # Access client to initialize it
                _ = remote.client

                remote.cleanup()

                mock_client.close.assert_called_once()
                assert remote._client is None


@pytest.mark.unit
class TestVectorStoreRemoteMode:
    """Tests for get_vector_store() returning remote client when configured."""

    def test_returns_remote_when_configured(self):
        """Should return RemoteVectorSearch when USE_REMOTE_VECTOR_SEARCH=true."""
        with patch("services.vector_store.settings") as mock_settings:
            mock_settings.USE_REMOTE_VECTOR_SEARCH = True

            # Patch at the source module where get_remote_vector_search is defined
            with patch(
                "services.remote_vector_search.get_remote_vector_search"
            ) as mock_get_remote:
                mock_remote = MagicMock()
                mock_get_remote.return_value = mock_remote

                # Clear cached instance
                import services.vector_store

                services.vector_store._vector_store = None

                from services.vector_store import get_vector_store

                result = get_vector_store()

                assert result == mock_remote
                mock_get_remote.assert_called_once()
