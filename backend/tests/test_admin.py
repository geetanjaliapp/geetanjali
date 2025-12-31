"""Tests for admin API.

Critical paths:
- Status endpoint (public, shows database health)
- Admin endpoints require API key authentication
"""

from models import Verse


class TestAdminStatus:
    """Test admin status endpoint (public)."""

    def test_status_empty_database(self, client, db_session):
        """Status shows empty when no verses exist."""
        response = client.get("/api/v1/admin/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "empty"
        assert data["verse_count"] == 0
        assert data["ingestion_running"] is False

    def test_status_incomplete_database(self, client, db_session):
        """Status shows incomplete when < 100 verses."""
        # Create a few test verses
        for i in range(10):
            verse = Verse(
                canonical_id=f"BG_1_{i+1}",
                chapter=1,
                verse=i + 1,
            )
            db_session.add(verse)
        db_session.commit()

        response = client.get("/api/v1/admin/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "incomplete"
        assert data["verse_count"] == 10
        assert "Only 10 verses" in data["message"]

    def test_status_ready_database(self, client, db_session):
        """Status shows ready when >= 100 verses."""
        # Create 100+ test verses
        for i in range(120):
            verse = Verse(
                canonical_id=f"BG_{i//50 + 1}_{i % 50 + 1}",
                chapter=i // 50 + 1,
                verse=i % 50 + 1,
            )
            db_session.add(verse)
        db_session.commit()

        response = client.get("/api/v1/admin/status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["verse_count"] == 120


class TestAdminAuthentication:
    """Test admin endpoints require authentication."""

    def test_ingest_with_invalid_api_key(self, client):
        """POST /ingest rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/ingest",
            json={"force_refresh": False},
            headers={"X-API-Key": "invalid-key"},
        )

        # Should return 401 or 403 with invalid API key
        assert response.status_code in [401, 403]

    def test_sync_featured_with_invalid_api_key(self, client):
        """POST /sync-featured rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/sync-featured",
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code in [401, 403]

    def test_sync_metadata_with_invalid_api_key(self, client):
        """POST /sync-metadata rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/sync-metadata",
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code in [401, 403]

    def test_enrich_with_invalid_api_key(self, client):
        """POST /enrich rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/enrich",
            json={"limit": 10},
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code in [401, 403]

    def test_alert_with_invalid_api_key(self, client):
        """POST /alert rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/alert",
            json={"subject": "Test", "message": "Test message"},
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code in [401, 403]
