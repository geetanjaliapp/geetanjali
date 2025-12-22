"""Tests for API dependencies (access control)."""

import pytest
from fastapi import status
import uuid

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


@pytest.fixture
def session_case(client):
    """Create a case with session ID (anonymous user)."""
    session_id = str(uuid.uuid4())
    case_data = {
        "title": "Session Case",
        "description": "This case belongs to an anonymous session",
        "sensitivity": "low",
    }
    response = client.post(
        "/api/v1/cases", json=case_data, headers={"X-Session-ID": session_id}
    )
    return {"case": response.json(), "session_id": session_id}


def test_session_user_can_access_own_case(client, session_case):
    """Test that session user can access their case."""
    case = session_case["case"]
    session_id = session_case["session_id"]

    response = client.get(
        f"/api/v1/cases/{case['id']}", headers={"X-Session-ID": session_id}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["id"] == case["id"]


def test_different_session_cannot_access_case(client, session_case):
    """Test that a different session cannot access the case."""
    case = session_case["case"]

    # Try with different session ID
    response = client.get(
        f"/api/v1/cases/{case['id']}", headers={"X-Session-ID": str(uuid.uuid4())}
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_no_session_cannot_access_session_case(client, session_case):
    """Test that request without session cannot access session case."""
    case = session_case["case"]

    response = client.get(f"/api/v1/cases/{case['id']}")

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_case_not_found_returns_404(client):
    """Test that non-existent case returns 404."""
    session_id = str(uuid.uuid4())
    response = client.get(
        f"/api/v1/cases/{uuid.uuid4()}", headers={"X-Session-ID": session_id}
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_messages_access_follows_case_access(client, session_case):
    """Test that message access follows case access rules."""
    case_id = session_case["case"]["id"]
    session_id = session_case["session_id"]

    # Session owner can access messages
    response = client.get(
        f"/api/v1/cases/{case_id}/messages", headers={"X-Session-ID": session_id}
    )
    assert response.status_code == status.HTTP_200_OK

    # Different session cannot
    response = client.get(
        f"/api/v1/cases/{case_id}/messages", headers={"X-Session-ID": str(uuid.uuid4())}
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_outputs_access_for_session_case(client, session_case):
    """Test output access for session-based cases."""
    case_id = session_case["case"]["id"]
    session_id = session_case["session_id"]

    # Session owner can access outputs
    response = client.get(
        f"/api/v1/cases/{case_id}/outputs", headers={"X-Session-ID": session_id}
    )
    assert response.status_code == status.HTTP_200_OK

    # Note: Current implementation allows anyone to list outputs for session-based cases
    # (only user_id-based cases are protected)


def test_list_cases_filters_by_session(client):
    """Test that list cases filters by session ID."""
    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create case with session
    case_data = {"title": "Session Case", "description": "Test", "sensitivity": "low"}
    client.post("/api/v1/cases", json=case_data, headers=headers)

    # Create case with different session
    other_headers = {"X-Session-ID": str(uuid.uuid4())}
    client.post(
        "/api/v1/cases",
        json={"title": "Other Session", "description": "Test", "sensitivity": "low"},
        headers=other_headers,
    )

    # List cases for first session
    response = client.get("/api/v1/cases", headers=headers)

    cases = response.json()["cases"]
    assert len(cases) >= 1
    assert all(c["title"] != "Other Session" for c in cases)


def test_list_cases_no_auth_returns_empty(client):
    """Test that list cases without auth or session returns empty."""
    response = client.get("/api/v1/cases")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["cases"] == []
