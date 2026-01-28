"""Tests for internal API endpoints (v1.37.0).

Tests for /internal/search endpoint used by worker to delegate
vector search to backend.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from api.internal import VectorSearchRequest, verify_internal_api_key


@pytest.mark.unit
class TestInternalAPIAuth:
    """Tests for internal API authentication."""

    def test_verify_key_rejects_missing_config(self):
        """Should reject when INTERNAL_API_KEY is not configured."""
        with patch("api.internal.settings") as mock_settings:
            mock_settings.INTERNAL_API_KEY = None

            with pytest.raises(HTTPException) as exc_info:
                verify_internal_api_key("any-key")

            assert exc_info.value.status_code == 503
            assert "not configured" in exc_info.value.detail

    def test_verify_key_rejects_invalid_key(self):
        """Should reject invalid API key."""
        with patch("api.internal.settings") as mock_settings:
            mock_settings.INTERNAL_API_KEY = "correct-key"

            with pytest.raises(HTTPException) as exc_info:
                verify_internal_api_key("wrong-key")

            assert exc_info.value.status_code == 401
            assert "Invalid" in exc_info.value.detail

    def test_verify_key_accepts_valid_key(self):
        """Should accept valid API key."""
        with patch("api.internal.settings") as mock_settings:
            mock_settings.INTERNAL_API_KEY = "correct-key"

            result = verify_internal_api_key("correct-key")

            assert result is True


@pytest.mark.unit
class TestVectorSearchRequest:
    """Tests for VectorSearchRequest model."""

    def test_request_with_defaults(self):
        """Should use default top_k when not specified."""
        request = VectorSearchRequest(query="test query")
        assert request.query == "test query"
        assert request.top_k == 5

    def test_request_with_custom_top_k(self):
        """Should accept custom top_k."""
        request = VectorSearchRequest(query="test query", top_k=10)
        assert request.top_k == 10


@pytest.mark.unit
class TestInternalVectorSearchEndpoint:
    """Tests for /internal/search endpoint."""

    @patch("api.internal.get_vector_store")
    @patch("api.internal.settings")
    def test_search_returns_results(self, mock_settings, mock_get_vector_store):
        """Should return vector search results."""
        mock_settings.INTERNAL_API_KEY = "test-key"

        mock_vector_store = MagicMock()
        mock_vector_store.search.return_value = {
            "ids": ["BG_2_47", "BG_3_19"],
            "documents": ["doc1", "doc2"],
            "distances": [0.1, 0.2],
            "metadatas": [{"chapter": 2}, {"chapter": 3}],
        }
        mock_get_vector_store.return_value = mock_vector_store

        # Import here to use patched settings
        import asyncio

        from api.internal import internal_vector_search

        request = VectorSearchRequest(query="dharma", top_k=3)
        response = asyncio.get_event_loop().run_until_complete(
            internal_vector_search(request, _auth=True)
        )

        assert response.ids == ["BG_2_47", "BG_3_19"]
        assert response.documents == ["doc1", "doc2"]
        assert response.distances == [0.1, 0.2]
        assert response.metadatas == [{"chapter": 2}, {"chapter": 3}]
        mock_vector_store.search.assert_called_once_with("dharma", top_k=3)

    @patch("api.internal.get_vector_store")
    @patch("api.internal.settings")
    def test_search_handles_error(self, mock_settings, mock_get_vector_store):
        """Should return 500 on vector store error."""
        mock_settings.INTERNAL_API_KEY = "test-key"

        mock_vector_store = MagicMock()
        mock_vector_store.search.side_effect = Exception("Connection failed")
        mock_get_vector_store.return_value = mock_vector_store

        import asyncio

        from api.internal import internal_vector_search

        request = VectorSearchRequest(query="dharma")
        with pytest.raises(HTTPException) as exc_info:
            asyncio.get_event_loop().run_until_complete(
                internal_vector_search(request, _auth=True)
            )

        assert exc_info.value.status_code == 500
        assert "Connection failed" in exc_info.value.detail
