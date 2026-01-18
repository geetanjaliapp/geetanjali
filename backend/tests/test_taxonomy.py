"""Tests for taxonomy API endpoints.

Tests the principle, goal, and group taxonomy endpoints that serve
as the single source of truth for the frontend.
"""

import pytest
from fastapi import status

# Mark all tests in this module as integration tests (require client)
pytestmark = pytest.mark.integration


# =============================================================================
# Principles Endpoints
# =============================================================================


class TestPrinciplesEndpoint:
    """Tests for GET /api/v1/taxonomy/principles."""

    def test_list_principles_returns_16_principles(self, client_with_principles):
        """Verify all 16 principles are returned."""
        response = client_with_principles.get("/api/v1/taxonomy/principles")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["count"] == 16
        assert len(data["principles"]) == 16

    def test_list_principles_includes_groups(self, client_with_principles):
        """Verify 4 yoga groups are included."""
        response = client_with_principles.get("/api/v1/taxonomy/principles")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["groups"]) == 4

        # Verify group IDs
        group_ids = {g["id"] for g in data["groups"]}
        assert group_ids == {"karma", "jnana", "bhakti", "sadachara"}

    def test_principles_have_required_fields(self, client_with_principles):
        """Verify each principle has all required metadata fields."""
        response = client_with_principles.get("/api/v1/taxonomy/principles")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        required_fields = [
            "id",
            "label",
            "shortLabel",
            "sanskrit",
            "transliteration",
            "description",
            "leadershipContext",
            "keywords",
            "group",
            "chapterFocus",
        ]

        for principle in data["principles"]:
            for field in required_fields:
                assert (
                    field in principle
                ), f"Missing field '{field}' in principle {principle.get('id')}"

    def test_principles_grouped_correctly(self, client_with_principles):
        """Verify each principle belongs to a valid group."""
        response = client_with_principles.get("/api/v1/taxonomy/principles")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        valid_groups = {"karma", "jnana", "bhakti", "sadachara"}
        for principle in data["principles"]:
            assert (
                principle["group"] in valid_groups
            ), f"Principle {principle['id']} has invalid group {principle['group']}"

    def test_each_group_has_4_principles(self, client_with_principles):
        """Verify balanced 4x4 grouping."""
        response = client_with_principles.get("/api/v1/taxonomy/principles")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Count principles per group
        group_counts = {}
        for principle in data["principles"]:
            group = principle["group"]
            group_counts[group] = group_counts.get(group, 0) + 1

        for group, count in group_counts.items():
            assert count == 4, f"Group '{group}' has {count} principles, expected 4"


class TestPrincipleDetailEndpoint:
    """Tests for GET /api/v1/taxonomy/principles/{id}."""

    def test_get_dharma_principle(self, client_with_principles):
        """Test fetching a specific principle."""
        response = client_with_principles.get("/api/v1/taxonomy/principles/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == "dharma"
        assert data["label"] == "Righteous Duty"
        assert data["shortLabel"] == "Duty"
        assert data["group"] == "karma"
        assert "धर्म" in data["sanskrit"]

    def test_get_nonexistent_principle_returns_404(self, client_with_principles):
        """Test that invalid principle ID returns 404."""
        response = client_with_principles.get("/api/v1/taxonomy/principles/nonexistent")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_principle_has_keywords(self, client_with_principles):
        """Verify principles have keyword arrays."""
        response = client_with_principles.get("/api/v1/taxonomy/principles/viveka")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data["keywords"], list)
        assert len(data["keywords"]) > 0
        assert "discernment" in data["keywords"]

    def test_principle_has_chapter_focus(self, client_with_principles):
        """Verify principles have chapter focus arrays."""
        response = client_with_principles.get("/api/v1/taxonomy/principles/dharma")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data["chapterFocus"], list)
        assert len(data["chapterFocus"]) > 0
        # Dharma is prominent in chapters 2, 3, 18
        assert 2 in data["chapterFocus"]


# =============================================================================
# Goals Endpoints
# =============================================================================


class TestGoalsEndpoint:
    """Tests for GET /api/v1/taxonomy/goals."""

    def test_list_goals_returns_8_goals(self, client):
        """Verify all 8 goals are returned."""
        response = client.get("/api/v1/taxonomy/goals")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["count"] == 8
        assert len(data["goals"]) == 8

    def test_goals_have_required_fields(self, client):
        """Verify each goal has all required fields."""
        response = client.get("/api/v1/taxonomy/goals")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        required_fields = ["id", "label", "description", "icon", "principles"]

        for goal in data["goals"]:
            for field in required_fields:
                assert (
                    field in goal
                ), f"Missing field '{field}' in goal {goal.get('id')}"

    def test_goal_ids_are_correct(self, client):
        """Verify expected goal IDs are present."""
        response = client.get("/api/v1/taxonomy/goals")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        expected_ids = {
            "inner_peace",
            "spiritual_growth",
            "work_excellence",
            "decision_clarity",
            "personal_growth",
            "leadership",
            "resilience",
            "exploring",
        }
        actual_ids = {g["id"] for g in data["goals"]}
        assert actual_ids == expected_ids

    def test_goals_have_principle_mappings(self, client):
        """Verify goals have principle mappings (except exploring)."""
        response = client.get("/api/v1/taxonomy/goals")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        for goal in data["goals"]:
            if goal["id"] == "exploring":
                # Exploring has no specific principles (includes all)
                assert goal["principles"] == []
            else:
                # Other goals should have 4 principles
                assert (
                    len(goal["principles"]) == 4
                ), f"Goal '{goal['id']}' has {len(goal['principles'])} principles, expected 4"


class TestGoalDetailEndpoint:
    """Tests for GET /api/v1/taxonomy/goals/{id}."""

    def test_get_inner_peace_goal(self, client):
        """Test fetching a specific goal."""
        response = client.get("/api/v1/taxonomy/goals/inner_peace")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == "inner_peace"
        assert data["label"] == "Inner Peace"
        assert "calm" in data["description"].lower()
        assert len(data["principles"]) == 4

    def test_get_exploring_goal_has_no_principles(self, client):
        """Test that exploring goal has empty principles."""
        response = client.get("/api/v1/taxonomy/goals/exploring")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == "exploring"
        assert data["principles"] == []

    def test_get_nonexistent_goal_returns_404(self, client):
        """Test that invalid goal ID returns 404."""
        response = client.get("/api/v1/taxonomy/goals/nonexistent")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()


# =============================================================================
# Groups Endpoint
# =============================================================================


class TestGroupsEndpoint:
    """Tests for GET /api/v1/taxonomy/groups."""

    def test_list_groups_returns_4_groups(self, client_with_principles):
        """Verify all 4 yoga groups are returned."""
        response = client_with_principles.get("/api/v1/taxonomy/groups")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 4

    def test_groups_have_required_fields(self, client_with_principles):
        """Verify each group has all required fields."""
        response = client_with_principles.get("/api/v1/taxonomy/groups")

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

        for group in data:
            for field in required_fields:
                assert (
                    field in group
                ), f"Missing field '{field}' in group {group.get('id')}"

    def test_groups_are_yoga_paths(self, client_with_principles):
        """Verify groups represent the yoga paths."""
        response = client_with_principles.get("/api/v1/taxonomy/groups")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        group_ids = {g["id"] for g in data}
        assert group_ids == {"karma", "jnana", "bhakti", "sadachara"}

    def test_groups_have_4_principles_each(self, client_with_principles):
        """Verify each group has exactly 4 principles."""
        response = client_with_principles.get("/api/v1/taxonomy/groups")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        for group in data:
            assert (
                len(group["principles"]) == 4
            ), f"Group '{group['id']}' has {len(group['principles'])} principles"

    def test_karma_group_has_correct_principles(self, client_with_principles):
        """Verify Karma yoga group has correct principles."""
        response = client_with_principles.get("/api/v1/taxonomy/groups")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        karma = next(g for g in data if g["id"] == "karma")
        expected = {"dharma", "nishkama_karma", "svadharma", "seva"}
        assert set(karma["principles"]) == expected


# =============================================================================
# Cross-validation Tests
# =============================================================================


class TestTaxonomyConsistency:
    """Tests for consistency across taxonomy endpoints."""

    def test_group_principles_match_principle_groups(self, client_with_principles):
        """Verify principle.group matches what's in group.principles."""
        principles_resp = client_with_principles.get("/api/v1/taxonomy/principles")
        groups_resp = client_with_principles.get("/api/v1/taxonomy/groups")

        principles = principles_resp.json()["principles"]
        groups = groups_resp.json()

        # Build mapping from group ID to principle IDs
        group_to_principles = {g["id"]: set(g["principles"]) for g in groups}

        # Check each principle's group assignment
        for principle in principles:
            group_id = principle["group"]
            assert principle["id"] in group_to_principles[group_id], (
                f"Principle '{principle['id']}' claims group '{group_id}' "
                f"but group doesn't list it"
            )

    def test_goal_principles_are_valid(self, client_with_principles):
        """Verify all principle IDs in goals are valid principles."""
        principles_resp = client_with_principles.get("/api/v1/taxonomy/principles")
        goals_resp = client_with_principles.get("/api/v1/taxonomy/goals")

        valid_principle_ids = {p["id"] for p in principles_resp.json()["principles"]}
        goals = goals_resp.json()["goals"]

        for goal in goals:
            for principle_id in goal["principles"]:
                assert (
                    principle_id in valid_principle_ids
                ), f"Goal '{goal['id']}' references invalid principle '{principle_id}'"
