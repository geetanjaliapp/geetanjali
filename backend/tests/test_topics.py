"""Tests for Topics API endpoints.

Tests the user-facing Topics feature endpoints:
- GET /api/v1/topics - List all principles grouped by yoga path
- GET /api/v1/topics/{id} - Get detailed principle with associated verses

Note: The Topics API uses PostgreSQL JSONB queries for verse counting.
These tests mock the verse-related functions to work with SQLite test DB.
"""

from unittest.mock import patch

import pytest
from fastapi import status

# Mark all tests in this module as integration tests (require client)
pytestmark = pytest.mark.integration


# Mock verse counts by principle ID
MOCK_VERSE_COUNTS = {
    "dharma": 5,
    "nishkama_karma": 3,
    "svadharma": 4,
    "seva": 2,
    "viveka": 6,
    "atman": 4,
    "maya": 3,
    "jnana": 5,
    "bhakti": 8,
    "shraddha": 4,
    "ishvara_pranidhana": 3,
    "prapatti": 5,
    "satya": 4,
    "ahimsa": 3,
    "tapas": 2,
    "sthitaprajna": 7,
}


# Mock functions to avoid JSONB compilation errors in SQLite
@pytest.fixture(autouse=True)
def mock_jsonb_queries():
    """Mock JSONB-dependent functions for SQLite compatibility."""
    with (
        patch(
            "api.topics._get_verse_counts_by_principle",
            return_value=MOCK_VERSE_COUNTS,
        ),
        patch(
            "api.topics._get_verses_for_principle",
            return_value=[],
        ),
        patch(
            "api.topics._get_verse_count_for_principle",
            side_effect=lambda db, pid: MOCK_VERSE_COUNTS.get(pid, 0),
        ),
    ):
        yield


# =============================================================================
# Topics List Endpoint
# =============================================================================


class TestTopicsListEndpoint:
    """Tests for GET /api/v1/topics."""

    def test_list_topics_returns_4_groups(self, client_with_principles):
        """Verify all 4 yoga path groups are returned."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["groups"]) == 4

    def test_list_topics_returns_16_total_principles(self, client_with_principles):
        """Verify total_principles count is 16."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_principles"] == 16

    def test_list_topics_includes_total_verses(self, client_with_principles):
        """Verify total_verses field is included (0 in test DB)."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_verses" in data
        assert isinstance(data["total_verses"], int)

    def test_groups_are_yoga_paths(self, client_with_principles):
        """Verify groups represent the 4 yoga paths."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        group_ids = {g["id"] for g in data["groups"]}
        assert group_ids == {"karma", "jnana", "bhakti", "sadachara"}

    def test_groups_have_required_fields(self, client_with_principles):
        """Verify each group has all required fields."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        required_fields = [
            "id",
            "label",
            "sanskrit",
            "transliteration",
            "description",
            "principles",
        ]

        for group in data["groups"]:
            for field in required_fields:
                assert field in group, f"Missing field '{field}' in group {group.get('id')}"

    def test_each_group_has_4_principles(self, client_with_principles):
        """Verify balanced 4x4 grouping."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        for group in data["groups"]:
            assert (
                len(group["principles"]) == 4
            ), f"Group '{group['id']}' has {len(group['principles'])} principles"

    def test_principles_have_required_fields(self, client_with_principles):
        """Verify each principle in the list has required summary fields."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        required_fields = [
            "id",
            "label",
            "short_label",
            "sanskrit",
            "transliteration",
            "description",
            "verse_count",
        ]

        for group in data["groups"]:
            for principle in group["principles"]:
                for field in required_fields:
                    assert field in principle, (
                        f"Missing field '{field}' in principle {principle.get('id')}"
                    )

    def test_karma_group_has_correct_principles(self, client_with_principles):
        """Verify Karma yoga group has the correct principles."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        karma = next(g for g in data["groups"] if g["id"] == "karma")
        karma_principle_ids = {p["id"] for p in karma["principles"]}
        expected = {"dharma", "nishkama_karma", "svadharma", "seva"}
        assert karma_principle_ids == expected


# =============================================================================
# Topic Detail Endpoint
# =============================================================================


class TestTopicDetailEndpoint:
    """Tests for GET /api/v1/topics/{principle_id}."""

    def test_get_dharma_topic(self, client_with_principles):
        """Test fetching dharma topic detail."""
        response = client_with_principles.get("/api/v1/topics/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == "dharma"
        assert data["label"] == "Righteous Duty"
        assert data["short_label"] == "Duty"
        assert "धर्म" in data["sanskrit"]

    def test_topic_includes_group_info(self, client_with_principles):
        """Verify topic detail includes group information."""
        response = client_with_principles.get("/api/v1/topics/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "group" in data
        assert data["group"]["id"] == "karma"
        assert data["group"]["label"] == "Action"
        assert data["group"]["transliteration"] == "Karma Yoga"

    def test_topic_has_required_core_fields(self, client_with_principles):
        """Verify topic detail has all required core fields."""
        response = client_with_principles.get("/api/v1/topics/viveka")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        required_fields = [
            "id",
            "label",
            "short_label",
            "sanskrit",
            "transliteration",
            "description",
            "leadership_context",
            "group",
            "verse_count",
            "verses",
        ]

        for field in required_fields:
            assert field in data, f"Missing required field '{field}'"

    def test_topic_has_extended_content_fields(self, client_with_principles):
        """Verify topic detail has extended content fields (may be null)."""
        response = client_with_principles.get("/api/v1/topics/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        extended_fields = [
            "extended_description",
            "practical_application",
            "common_misconceptions",
            "faq",
            "related_principles",
            "chapter_focus",
            "keywords",
        ]

        for field in extended_fields:
            assert field in data, f"Missing extended field '{field}'"

    def test_topic_has_keywords(self, client_with_principles):
        """Verify topic has keywords array."""
        response = client_with_principles.get("/api/v1/topics/viveka")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data["keywords"], list)
        assert len(data["keywords"]) > 0
        assert "discernment" in data["keywords"]

    def test_topic_has_chapter_focus(self, client_with_principles):
        """Verify topic has chapter focus array."""
        response = client_with_principles.get("/api/v1/topics/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data["chapter_focus"], list)
        assert len(data["chapter_focus"]) > 0

    def test_get_nonexistent_topic_returns_404(self, client_with_principles):
        """Test that invalid topic ID returns 404."""
        response = client_with_principles.get("/api/v1/topics/nonexistent")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_include_verses_false_omits_verses(self, client_with_principles):
        """Test include_verses=false returns empty verses array."""
        response = client_with_principles.get(
            "/api/v1/topics/dharma?include_verses=false"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # With no verses in test DB and include_verses=false, verses should be empty
        assert data["verses"] == []
        # But verse_count should still be present
        assert "verse_count" in data

    def test_verse_limit_parameter(self, client_with_principles):
        """Test verse_limit parameter is accepted."""
        response = client_with_principles.get("/api/v1/topics/dharma?verse_limit=10")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "verses" in data

    def test_verse_limit_validation(self, client_with_principles):
        """Test verse_limit validates min/max bounds."""
        # Below minimum
        response = client_with_principles.get("/api/v1/topics/dharma?verse_limit=0")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Above maximum
        response = client_with_principles.get("/api/v1/topics/dharma?verse_limit=200")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# Response Schema Validation
# =============================================================================


class TestTopicsResponseSchemas:
    """Tests for response schema validation."""

    def test_topics_list_response_shape(self, client_with_principles):
        """Verify list response matches TopicsListResponse schema."""
        response = client_with_principles.get("/api/v1/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Top-level structure
        assert set(data.keys()) == {"groups", "total_principles", "total_verses"}
        assert isinstance(data["groups"], list)
        assert isinstance(data["total_principles"], int)
        assert isinstance(data["total_verses"], int)

    def test_topic_detail_response_shape(self, client_with_principles):
        """Verify detail response matches TopicDetailResponse schema."""
        response = client_with_principles.get("/api/v1/topics/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Core fields should all be present
        expected_keys = {
            "id",
            "label",
            "short_label",
            "sanskrit",
            "transliteration",
            "description",
            "leadership_context",
            "group",
            "extended_description",
            "practical_application",
            "common_misconceptions",
            "faq",
            "related_principles",
            "chapter_focus",
            "keywords",
            "verse_count",
            "verses",
        }
        assert set(data.keys()) == expected_keys

    def test_group_summary_in_detail_response(self, client_with_principles):
        """Verify group in detail response has correct shape."""
        response = client_with_principles.get("/api/v1/topics/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        group = data["group"]
        assert set(group.keys()) == {"id", "label", "transliteration"}
        assert isinstance(group["id"], str)
        assert isinstance(group["label"], str)
        assert isinstance(group["transliteration"], str)
