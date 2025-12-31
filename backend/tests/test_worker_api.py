"""Tests for worker API endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from worker_api import app

# Mark all tests in this module as unit tests (no external services needed)
pytestmark = pytest.mark.unit


@pytest.fixture
def worker_client():
    """Create a test client for worker API."""
    with TestClient(app) as client:
        yield client


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_endpoint(self, worker_client):
        """Test root endpoint returns service info."""
        response = worker_client.get("/")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Geetanjali"
        assert data["service"] == "worker"
        assert data["status"] == "running"
        assert "environment" in data
        # docs is available in non-production
        assert "docs" in data


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_check(self, worker_client):
        """Test basic health check endpoint."""
        response = worker_client.get("/health")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "worker"
        assert "environment" in data
        assert "timestamp" in data

    def test_liveness_check(self, worker_client):
        """Test liveness probe endpoint."""
        response = worker_client.get("/health/live")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "alive"
        assert data["service"] == "worker"
        assert "environment" in data
        assert "timestamp" in data

    @patch("worker_api.get_redis_client")
    def test_readiness_check_redis_connected(self, mock_redis, worker_client):
        """Test readiness probe with Redis connected."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        mock_redis.return_value = mock_client

        response = worker_client.get("/health/ready")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "ready"
        assert data["service"] == "worker"
        assert data["checks"]["redis"]["healthy"] is True
        assert "timestamp" in data

    @patch("worker_api.get_redis_client")
    def test_readiness_check_redis_unavailable(self, mock_redis, worker_client):
        """Test readiness probe with Redis unavailable."""
        mock_redis.return_value = None

        response = worker_client.get("/health/ready")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["checks"]["redis"]["healthy"] is False

    @patch("worker_api.get_redis_client")
    def test_readiness_check_redis_error(self, mock_redis, worker_client):
        """Test readiness probe with Redis connection error."""
        mock_client = MagicMock()
        mock_client.ping.side_effect = Exception("Connection refused")
        mock_redis.return_value = mock_client

        response = worker_client.get("/health/ready")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["checks"]["redis"]["healthy"] is False
        assert "error" in data["checks"]["redis"]


class TestStatusEndpoints:
    """Tests for status endpoints."""

    @patch("worker_api.get_redis_client")
    def test_worker_status(self, mock_redis, worker_client):
        """Test worker status endpoint."""
        mock_client = MagicMock()
        mock_client.keys.return_value = []
        mock_client.llen.return_value = 0
        mock_client.zcard.return_value = 0
        mock_redis.return_value = mock_client

        response = worker_client.get("/status")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["worker_count"] == 0
        assert isinstance(data["workers"], list)
        assert "queue" in data
        assert "timestamp" in data

    @patch("worker_api.get_redis_client")
    def test_queue_status(self, mock_redis, worker_client):
        """Test queue status endpoint."""
        mock_client = MagicMock()
        mock_client.llen.return_value = 5
        mock_client.zcard.side_effect = [2, 10]  # failed, finished
        mock_redis.return_value = mock_client

        response = worker_client.get("/queue")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["pending_jobs"] == 5
        assert data["failed_jobs"] == 2
        assert data["finished_jobs"] == 10
        assert "timestamp" in data

    @patch("worker_api.get_redis_client")
    def test_queue_status_redis_unavailable(self, mock_redis, worker_client):
        """Test queue status when Redis unavailable."""
        mock_redis.return_value = None

        response = worker_client.get("/queue")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["pending_jobs"] == 0
        assert data["failed_jobs"] == 0
        assert data["finished_jobs"] == 0


class TestAdminEndpoints:
    """Tests for admin endpoints (require API key)."""

    def test_pause_status_no_auth(self, worker_client):
        """Test pause status without API key returns 422 (missing required header)."""
        response = worker_client.get("/admin/pause-status")
        # FastAPI returns 422 for missing required headers
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_request_pause_no_auth(self, worker_client):
        """Test request pause without API key returns 422."""
        response = worker_client.post("/admin/request-pause")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_clear_pause_no_auth(self, worker_client):
        """Test clear pause without API key returns 422."""
        response = worker_client.post("/admin/clear-pause")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_pause_status_invalid_key(self, worker_client):
        """Test pause status with invalid API key returns 401."""
        response = worker_client.get(
            "/admin/pause-status",
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @patch("worker_api.get_redis_client")
    @patch("api.dependencies.settings")
    def test_pause_status_with_auth(self, mock_settings, mock_redis, worker_client):
        """Test pause status with valid API key."""
        mock_settings.API_KEY = "test-admin-key"
        mock_client = MagicMock()
        mock_client.get.return_value = None  # Not paused
        mock_redis.return_value = mock_client

        response = worker_client.get(
            "/admin/pause-status",
            headers={"X-API-Key": "test-admin-key"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["action"] == "pause-status"
        assert data["message"] == "running"

    @patch("worker_api.get_redis_client")
    @patch("api.dependencies.settings")
    def test_request_pause_with_auth(self, mock_settings, mock_redis, worker_client):
        """Test request pause with valid API key."""
        mock_settings.API_KEY = "test-admin-key"
        mock_client = MagicMock()
        mock_redis.return_value = mock_client

        response = worker_client.post(
            "/admin/request-pause",
            headers={"X-API-Key": "test-admin-key"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["action"] == "request-pause"
        assert data["success"] is True
        mock_client.set.assert_called_once()

    @patch("worker_api.get_redis_client")
    @patch("api.dependencies.settings")
    def test_clear_pause_with_auth(self, mock_settings, mock_redis, worker_client):
        """Test clear pause with valid API key."""
        mock_settings.API_KEY = "test-admin-key"
        mock_client = MagicMock()
        mock_redis.return_value = mock_client

        response = worker_client.post(
            "/admin/clear-pause",
            headers={"X-API-Key": "test-admin-key"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["action"] == "clear-pause"
        assert data["success"] is True
        mock_client.delete.assert_called_once()

    @patch("worker_api.get_redis_client")
    @patch("api.dependencies.settings")
    def test_admin_endpoint_redis_unavailable(
        self, mock_settings, mock_redis, worker_client
    ):
        """Test admin endpoint when Redis unavailable returns 503."""
        mock_settings.API_KEY = "test-admin-key"
        mock_redis.return_value = None

        response = worker_client.get(
            "/admin/pause-status",
            headers={"X-API-Key": "test-admin-key"},
        )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


class TestMetricsEndpoint:
    """Tests for Prometheus metrics endpoint."""

    def test_metrics_endpoint_exists(self, worker_client):
        """Test that /metrics endpoint is exposed."""
        response = worker_client.get("/metrics")

        assert response.status_code == status.HTTP_200_OK
        # Prometheus metrics are text/plain format
        assert "text/plain" in response.headers.get("content-type", "")
