"""Tests for user preferences API.

Critical tests for Phase 4 cross-device sync feature:
- GET: Lazy creation of preferences
- PUT: Favorites validation (canonical ID pattern, max limit)
- POST /merge: Union merge for favorites, timestamp for reading/goals
- Security: Extra fields rejected
"""

import pytest
from fastapi import status

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test."""
    from api.dependencies import limiter

    # Clear the in-memory storage to reset rate limits
    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()
    yield


def create_authenticated_user(client, email="test@example.com"):
    """Helper to create and authenticate a user, returns auth headers with CSRF token."""
    signup_data = {
        "email": email,
        "name": "Test User",
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == status.HTTP_201_CREATED
    token = response.json()["access_token"]

    # Get CSRF token from cookies set during signup
    csrf_token = response.cookies.get("csrf_token")

    headers = {"Authorization": f"Bearer {token}"}
    if csrf_token:
        headers["X-CSRF-Token"] = csrf_token

    return headers


class TestGetPreferences:
    """Tests for GET /api/v1/users/me/preferences."""

    def test_get_creates_preferences_if_not_exist(self, client):
        """First GET should lazily create preferences record."""
        headers = create_authenticated_user(client)

        response = client.get("/api/v1/users/me/preferences", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Check default values
        assert data["favorites"]["items"] == []
        assert data["reading"]["chapter"] is None
        assert data["reading"]["verse"] is None
        assert data["reading"]["font_size"] == "medium"
        assert data["learning_goals"]["goal_ids"] == []

    def test_get_returns_existing_preferences(self, client):
        """Subsequent GET should return existing preferences."""
        headers = create_authenticated_user(client)

        # First GET creates
        client.get("/api/v1/users/me/preferences", headers=headers)

        # Update some data
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": ["BG_1_1"]}},
        )

        # Second GET returns updated data
        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["favorites"]["items"] == ["BG_1_1"]

    def test_get_unauthenticated_returns_401(self, client):
        """GET without auth should return 401."""
        response = client.get("/api/v1/users/me/preferences")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestUpdatePreferences:
    """Tests for PUT /api/v1/users/me/preferences."""

    def test_update_favorites_success(self, client):
        """Should update favorites with valid canonical IDs."""
        headers = create_authenticated_user(client)

        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": ["BG_1_1", "BG_2_47", "BG_18_66"]}},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert set(data["favorites"]["items"]) == {"BG_1_1", "BG_2_47", "BG_18_66"}

    def test_update_favorites_invalid_format_rejected(self, client):
        """Should reject favorites with invalid canonical ID format."""
        headers = create_authenticated_user(client)

        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": ["invalid_id"]}},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        # Check it's a validation error
        assert data.get("error") == "ValidationError"
        assert len(data.get("details", [])) > 0

    def test_update_favorites_max_limit_enforced(self, client):
        """Should reject favorites exceeding max limit."""
        headers = create_authenticated_user(client)

        # Create 501 items (max is 500)
        too_many = [f"BG_{i % 18 + 1}_{i % 70 + 1}" for i in range(501)]

        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": too_many}},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        # Check it's a validation error about max limit
        assert data.get("error") == "ValidationError"
        assert len(data.get("details", [])) > 0

    def test_update_reading_success(self, client):
        """Should update reading position."""
        headers = create_authenticated_user(client)

        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"reading": {"chapter": 2, "verse": 47, "font_size": "large"}},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["reading"]["chapter"] == 2
        assert data["reading"]["verse"] == 47
        assert data["reading"]["font_size"] == "large"

    def test_update_learning_goals_success(self, client):
        """Should update learning goals."""
        headers = create_authenticated_user(client)

        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"learning_goals": {"goal_ids": ["peace", "purpose"]}},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert set(data["learning_goals"]["goal_ids"]) == {"peace", "purpose"}

    def test_update_partial_preserves_other_fields(self, client):
        """Updating one field should not affect others."""
        headers = create_authenticated_user(client)

        # Set favorites
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": ["BG_1_1"]}},
        )

        # Update reading only
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"reading": {"chapter": 5, "verse": 10}},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Favorites should be preserved
        assert data["favorites"]["items"] == ["BG_1_1"]
        # Reading should be updated
        assert data["reading"]["chapter"] == 5

    def test_update_extra_fields_rejected(self, client):
        """Should reject requests with unexpected fields (security)."""
        headers = create_authenticated_user(client)

        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": ["BG_1_1"], "malicious_field": "value"}},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestMergePreferences:
    """Tests for POST /api/v1/users/me/preferences/merge."""

    def test_merge_favorites_union(self, client):
        """Merge should union local and server favorites."""
        headers = create_authenticated_user(client)

        # Set server favorites
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"favorites": {"items": ["BG_1_1", "BG_2_2"]}},
        )

        # Merge with local favorites
        response = client.post(
            "/api/v1/users/me/preferences/merge",
            headers=headers,
            json={"favorites": {"items": ["BG_2_2", "BG_3_3"]}},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Union: BG_1_1 (server), BG_2_2 (both), BG_3_3 (local)
        assert set(data["favorites"]["items"]) == {"BG_1_1", "BG_2_2", "BG_3_3"}

    def test_merge_reading_newer_wins(self, client):
        """Merge should use most recent reading position."""
        headers = create_authenticated_user(client)

        # Set server reading with older timestamp
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"reading": {"chapter": 1, "verse": 1}},
        )

        # Merge with local reading (newer timestamp wins)
        response = client.post(
            "/api/v1/users/me/preferences/merge",
            headers=headers,
            json={
                "reading": {
                    "chapter": 5,
                    "verse": 10,
                    "updated_at": "2099-01-01T00:00:00Z",  # Future = newer
                }
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["reading"]["chapter"] == 5
        assert data["reading"]["verse"] == 10

    def test_merge_reading_server_wins_if_newer(self, client):
        """Merge should keep server reading if it's newer."""
        headers = create_authenticated_user(client)

        # Set server reading (will be newer than local)
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"reading": {"chapter": 10, "verse": 20}},
        )

        # Merge with local reading (older timestamp)
        response = client.post(
            "/api/v1/users/me/preferences/merge",
            headers=headers,
            json={
                "reading": {
                    "chapter": 1,
                    "verse": 1,
                    "updated_at": "2000-01-01T00:00:00Z",  # Past = older
                }
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Server values should win
        assert data["reading"]["chapter"] == 10
        assert data["reading"]["verse"] == 20

    def test_merge_goals_newer_wins(self, client):
        """Merge should use most recent goal selection."""
        headers = create_authenticated_user(client)

        # Set server goals
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"learning_goals": {"goal_ids": ["peace"]}},
        )

        # Merge with local goals (newer)
        response = client.post(
            "/api/v1/users/me/preferences/merge",
            headers=headers,
            json={
                "learning_goals": {
                    "goal_ids": ["purpose", "clarity"],
                    "updated_at": "2099-01-01T00:00:00Z",
                }
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert set(data["learning_goals"]["goal_ids"]) == {"purpose", "clarity"}

    def test_merge_unauthenticated_returns_401(self, client):
        """Merge without auth should return 401."""
        response = client.post(
            "/api/v1/users/me/preferences/merge",
            json={"favorites": {"items": ["BG_1_1"]}},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
