"""Tests for case endpoints."""

from fastapi import status


def test_create_case(client):
    """Test creating a new case."""
    case_data = {
        "title": "Restructuring vs Phased Approach",
        "description": "We must cut costs; option A is quick layoffs; option B is phased realignment.",
        "role": "Senior Manager",
        "stakeholders": ["team", "senior leadership", "customers"],
        "constraints": ["headcount budget: -25%", "quarterly earnings pressure"],
        "horizon": "12 months",
        "sensitivity": "high",
    }

    response = client.post("/api/v1/cases", json=case_data)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == case_data["title"]
    assert data["sensitivity"] == "high"
    assert "id" in data
    assert "created_at" in data


def test_get_case(client):
    """Test getting a case by ID."""
    # First create a case
    case_data = {
        "title": "Test Case",
        "description": "Test description",
        "sensitivity": "low",
    }
    create_response = client.post("/api/v1/cases", json=case_data)
    case_id = create_response.json()["id"]

    # Then retrieve it
    response = client.get(f"/api/v1/cases/{case_id}")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == case_id
    assert data["title"] == "Test Case"


def test_get_case_not_found(client):
    """Test getting a non-existent case."""
    response = client.get("/api/v1/cases/nonexistent-id")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_list_cases(client):
    """Test listing cases for a session user."""
    import uuid

    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create a couple of cases with session
    for i in range(2):
        case_data = {
            "title": f"Test Case {i}",
            "description": f"Description {i}",
            "sensitivity": "low",
        }
        client.post("/api/v1/cases", json=case_data, headers=headers)

    # List cases for session
    response = client.get("/api/v1/cases", headers=headers)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) >= 2


def test_create_case_validation(client):
    """Test case creation with invalid data."""
    # Missing required field
    invalid_case = {"description": "Only description, no title"}

    response = client.post("/api/v1/cases", json=invalid_case)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
