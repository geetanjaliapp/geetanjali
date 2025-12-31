"""Tests for admin API.

Critical paths:
- Status endpoint (public, shows database health)
- Admin endpoints require API key authentication
- Sync endpoints (dhyanam, audio-metadata) work correctly
"""

from unittest.mock import patch

import pytest

from models import DhyanamVerse, Verse


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

    def test_sync_dhyanam_with_invalid_api_key(self, client):
        """POST /sync-dhyanam rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/sync-dhyanam",
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code in [401, 403]

    def test_sync_audio_metadata_with_invalid_api_key(self, client):
        """POST /sync-audio-metadata rejects invalid API key."""
        response = client.post(
            "/api/v1/admin/sync-audio-metadata",
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code in [401, 403]


class TestSyncDhyanam:
    """Test sync-dhyanam endpoint behavior.

    These tests verify the code-first + DB sync pattern works correctly.
    """

    @pytest.fixture
    def admin_headers(self):
        """Headers with valid admin API key."""
        return {"X-API-Key": "dev-api-key-12345"}

    def test_sync_dhyanam_creates_verses(self, client, db_session, admin_headers):
        """Sync creates all 9 dhyanam verses from source."""
        # Verify empty before sync
        count_before = db_session.query(DhyanamVerse).count()
        assert count_before == 0

        # Run sync
        response = client.post("/api/v1/admin/sync-dhyanam", headers=admin_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["synced"] == 9
        assert data["created"] == 9
        assert data["updated"] == 0

        # Verify all 9 exist in DB
        count_after = db_session.query(DhyanamVerse).count()
        assert count_after == 9

    def test_sync_dhyanam_is_idempotent(self, client, db_session, admin_headers):
        """Running sync twice doesn't create duplicates."""
        # First sync
        response1 = client.post("/api/v1/admin/sync-dhyanam", headers=admin_headers)
        assert response1.status_code == 200
        assert response1.json()["created"] == 9

        # Second sync should update, not create
        response2 = client.post("/api/v1/admin/sync-dhyanam", headers=admin_headers)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["synced"] == 9
        assert data2["created"] == 0
        assert data2["updated"] == 9

        # Still only 9 verses
        count = db_session.query(DhyanamVerse).count()
        assert count == 9

    def test_sync_dhyanam_data_integrity(self, client, db_session, admin_headers):
        """Synced data matches source file."""
        from data.geeta_dhyanam import get_geeta_dhyanam

        # Sync
        client.post("/api/v1/admin/sync-dhyanam", headers=admin_headers)

        # Get source data
        source = get_geeta_dhyanam()

        # Verify each verse matches source
        for source_verse in source:
            db_verse = (
                db_session.query(DhyanamVerse)
                .filter(DhyanamVerse.verse_number == source_verse["verse_number"])
                .first()
            )
            assert db_verse is not None
            assert db_verse.sanskrit == source_verse["sanskrit"]
            assert db_verse.theme == source_verse["theme"]
            assert db_verse.audio_url == source_verse["audio_url"]

    def test_synced_dhyanam_served_by_api(self, client, db_session, admin_headers):
        """After sync, API serves verses from DB."""
        # Sync first
        client.post("/api/v1/admin/sync-dhyanam", headers=admin_headers)

        # API should return verses
        response = client.get("/api/v1/dhyanam")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 9

        # Verify structure
        verse1 = data[0]
        assert verse1["verse_number"] == 1
        assert "sanskrit" in verse1
        assert "english" in verse1
        assert "audio_url" in verse1
