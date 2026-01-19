"""Tests for SEO Admin API endpoints.

Tests the admin endpoints for SEO page generation:
- GET /api/v1/admin/seo/status
- POST /api/v1/admin/seo/generate
- POST /api/v1/admin/seo/generate/async

Note: These tests mock the SeoGeneratorService to avoid PostgreSQL
advisory lock requirements. Full integration tests would require
a PostgreSQL database.
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status

from config import settings
from services.seo.generator import GenerationInProgressError, SeoGenerationResult

pytestmark = pytest.mark.integration


def admin_headers():
    """Return headers with admin API key."""
    return {"X-API-Key": settings.API_KEY}


class TestSeoStatusEndpoint:
    """Tests for GET /api/v1/admin/seo/status."""

    def test_returns_401_without_api_key(self, client):
        """Should return 404 (hidden endpoint) without API key."""
        response = client.get("/api/v1/admin/seo/status")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_404_with_invalid_api_key(self, client):
        """Should return 404 with invalid API key."""
        response = client.get(
            "/api/v1/admin/seo/status",
            headers={"X-API-Key": "invalid_key"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("api.admin.seo.SeoGeneratorService")
    def test_returns_status_with_valid_key(self, mock_service_class, client):
        """Should return status with valid API key."""
        mock_service = MagicMock()
        mock_service.get_status.return_value = {
            "pages_by_type": {"verse": 701, "chapter": 18, "topic": 16},
            "total_pages": 735,
            "total_size_bytes": 15000000,
            "last_generated_at": "2025-01-18T12:00:00",
        }
        mock_service_class.return_value = mock_service

        response = client.get("/api/v1/admin/seo/status", headers=admin_headers())

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_pages"] == 735
        assert data["pages_by_type"]["verse"] == 701
        assert "last_generated_at" in data


class TestSeoGenerateEndpoint:
    """Tests for POST /api/v1/admin/seo/generate."""

    @patch("api.admin.seo.SeoGeneratorService")
    def test_triggers_generation_with_valid_key(self, mock_service_class, client):
        """Should trigger generation with valid API key."""
        mock_service = MagicMock()
        mock_service.generate_all.return_value = SeoGenerationResult(
            total_pages=750,
            generated=50,
            skipped=700,
            errors=0,
            duration_ms=5000,
        )
        mock_service_class.return_value = mock_service

        response = client.post("/api/v1/admin/seo/generate", headers=admin_headers())

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["total_pages"] == 750
        assert data["generated"] == 50
        assert data["skipped"] == 700

    @patch("api.admin.seo.SeoGeneratorService")
    def test_force_parameter_passed(self, mock_service_class, client):
        """Should pass force parameter to service."""
        mock_service = MagicMock()
        mock_service.generate_all.return_value = SeoGenerationResult(
            total_pages=750,
            generated=750,
            skipped=0,
            errors=0,
            duration_ms=30000,
        )
        mock_service_class.return_value = mock_service

        response = client.post(
            "/api/v1/admin/seo/generate?force=true",
            headers=admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        mock_service.generate_all.assert_called_once_with(force=True)

    @patch("api.admin.seo.SeoGeneratorService")
    def test_returns_409_when_generation_in_progress(
        self, mock_service_class, client
    ):
        """Should return 409 Conflict when another generation is running."""
        mock_service = MagicMock()
        mock_service.generate_all.side_effect = GenerationInProgressError(
            "Another SEO generation is already in progress"
        )
        mock_service_class.return_value = mock_service

        response = client.post("/api/v1/admin/seo/generate", headers=admin_headers())

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "already in progress" in response.json()["detail"]

    @patch("api.admin.seo.SeoGeneratorService")
    def test_response_includes_duration(self, mock_service_class, client):
        """Should include generation duration in response."""
        mock_service = MagicMock()
        mock_service.generate_all.return_value = SeoGenerationResult(
            total_pages=100,
            generated=10,
            skipped=90,
            errors=0,
            duration_ms=2500,
        )
        mock_service_class.return_value = mock_service

        response = client.post("/api/v1/admin/seo/generate", headers=admin_headers())

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["duration_ms"] == 2500


class TestSeoGenerateAsyncEndpoint:
    """Tests for POST /api/v1/admin/seo/generate/async."""

    def test_returns_queued_status(self, client):
        """Should return queued status immediately."""
        response = client.post(
            "/api/v1/admin/seo/generate/async",
            headers=admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "queued"
        assert "Check /seo/status" in data["message"]


class TestAdminApiKeySecurity:
    """Security tests for admin API key handling."""

    def test_timing_attack_resistance(self, client):
        """Response time should be similar for valid/invalid keys.

        Note: This is a basic check. True timing attack resistance
        requires statistical analysis over many requests.
        """
        import time

        # Time with valid key (will still 404 due to mock)
        start = time.time()
        client.get(
            "/api/v1/admin/seo/status",
            headers={"X-API-Key": settings.API_KEY},
        )
        valid_time = time.time() - start

        # Time with invalid key
        start = time.time()
        client.get(
            "/api/v1/admin/seo/status",
            headers={"X-API-Key": "x" * len(settings.API_KEY)},
        )
        invalid_time = time.time() - start

        # Times should be reasonably similar (within 100ms)
        # This is a weak test but catches obvious timing leaks
        assert abs(valid_time - invalid_time) < 0.1

    def test_empty_api_key_rejected(self, client):
        """Empty API key should be rejected."""
        response = client.get(
            "/api/v1/admin/seo/status",
            headers={"X-API-Key": ""},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_api_key_case_sensitive(self, client):
        """API key comparison should be case-sensitive."""
        # If the key has mixed case, swapping should fail
        wrong_case = settings.API_KEY.swapcase()
        if wrong_case != settings.API_KEY:  # Only test if key has letters
            response = client.get(
                "/api/v1/admin/seo/status",
                headers={"X-API-Key": wrong_case},
            )
            assert response.status_code == status.HTTP_404_NOT_FOUND
