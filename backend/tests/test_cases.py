"""Tests for case endpoints."""

import pytest
from fastapi import status

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


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
    import uuid

    # Use session ID for anonymous access
    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # First create a case with session ID
    case_data = {
        "title": "Test Case",
        "description": "I need guidance on whether to accept a promotion that requires relocating away from my family.",
        "sensitivity": "low",
    }
    create_response = client.post("/api/v1/cases", json=case_data, headers=headers)
    assert (
        create_response.status_code == status.HTTP_201_CREATED
    ), f"Case creation failed: {create_response.json()}"
    case_id = create_response.json()["id"]

    # Then retrieve it with same session ID
    response = client.get(f"/api/v1/cases/{case_id}", headers=headers)

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

    # Create a couple of cases with session - use realistic descriptions to pass content filter
    descriptions = [
        "Should I take a job that pays more but requires more travel away from family?",
        "Is it ethical to accept a gift from a vendor when company policy is unclear?",
    ]
    for i in range(2):
        case_data = {
            "title": f"Test Case {i}",
            "description": descriptions[i],
            "sensitivity": "low",
        }
        client.post("/api/v1/cases", json=case_data, headers=headers)

    # List cases for session
    response = client.get("/api/v1/cases", headers=headers)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    # New response format returns {cases, counts}
    assert "cases" in data
    assert "counts" in data
    assert len(data["cases"]) >= 2


def test_list_cases_with_counts(client, db_session):
    """Test that list_cases returns proper filter counts."""
    import uuid

    from models.case import Case, CaseStatus

    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create cases with different statuses directly in DB
    cases = [
        Case(
            id=str(uuid.uuid4()),
            title="Completed Case",
            description="Test description",
            session_id=session_id,
            status=CaseStatus.COMPLETED.value,
        ),
        Case(
            id=str(uuid.uuid4()),
            title="Processing Case",
            description="Test description",
            session_id=session_id,
            status=CaseStatus.PROCESSING.value,
        ),
        Case(
            id=str(uuid.uuid4()),
            title="Failed Case",
            description="Test description",
            session_id=session_id,
            status=CaseStatus.FAILED.value,
        ),
        Case(
            id=str(uuid.uuid4()),
            title="Shared Case",
            description="Test description",
            session_id=session_id,
            status=CaseStatus.COMPLETED.value,
            is_public=True,
            public_slug="testslug1",
        ),
    ]

    for case in cases:
        db_session.add(case)
    db_session.commit()

    # List all cases
    response = client.get("/api/v1/cases", headers=headers)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Verify counts
    counts = data["counts"]
    assert counts["all"] == 4
    assert counts["completed"] == 2  # completed + shared (which is also completed)
    assert counts["in_progress"] == 1  # processing
    assert counts["failed"] == 1
    assert counts["shared"] == 1


def test_list_cases_status_filter_completed(client, db_session):
    """Test filtering cases by completed status."""
    import uuid

    from models.case import Case, CaseStatus

    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create cases with different statuses
    completed_case = Case(
        id=str(uuid.uuid4()),
        title="Completed Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.COMPLETED.value,
    )
    processing_case = Case(
        id=str(uuid.uuid4()),
        title="Processing Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.PROCESSING.value,
    )

    db_session.add(completed_case)
    db_session.add(processing_case)
    db_session.commit()

    # Filter by completed
    response = client.get(
        "/api/v1/cases", params={"status_filter": "completed"}, headers=headers
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Should only return completed case
    assert len(data["cases"]) == 1
    assert data["cases"][0]["title"] == "Completed Case"


def test_list_cases_status_filter_in_progress(client, db_session):
    """Test filtering cases by in-progress status."""
    import uuid

    from models.case import Case, CaseStatus

    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create cases with different statuses
    completed_case = Case(
        id=str(uuid.uuid4()),
        title="Completed Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.COMPLETED.value,
    )
    pending_case = Case(
        id=str(uuid.uuid4()),
        title="Pending Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.PENDING.value,
    )
    processing_case = Case(
        id=str(uuid.uuid4()),
        title="Processing Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.PROCESSING.value,
    )

    db_session.add(completed_case)
    db_session.add(pending_case)
    db_session.add(processing_case)
    db_session.commit()

    # Filter by in-progress
    response = client.get(
        "/api/v1/cases", params={"status_filter": "in-progress"}, headers=headers
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Should return pending and processing cases
    assert len(data["cases"]) == 2
    titles = {case["title"] for case in data["cases"]}
    assert titles == {"Pending Case", "Processing Case"}


def test_list_cases_status_filter_shared(client, db_session):
    """Test filtering cases by shared (public) status."""
    import uuid

    from models.case import Case, CaseStatus

    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create public and private cases
    private_case = Case(
        id=str(uuid.uuid4()),
        title="Private Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.COMPLETED.value,
        is_public=False,
    )
    public_case = Case(
        id=str(uuid.uuid4()),
        title="Public Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.COMPLETED.value,
        is_public=True,
        public_slug="testslug2",
    )

    db_session.add(private_case)
    db_session.add(public_case)
    db_session.commit()

    # Filter by shared
    response = client.get(
        "/api/v1/cases", params={"status_filter": "shared"}, headers=headers
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Should only return shared case
    assert len(data["cases"]) == 1
    assert data["cases"][0]["title"] == "Public Case"


def test_list_cases_excludes_deleted(client, db_session):
    """Test that soft-deleted cases are excluded from results and counts."""
    import uuid

    from models.case import Case, CaseStatus

    session_id = str(uuid.uuid4())
    headers = {"X-Session-ID": session_id}

    # Create normal and deleted cases
    active_case = Case(
        id=str(uuid.uuid4()),
        title="Active Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.COMPLETED.value,
        is_deleted=False,
    )
    deleted_case = Case(
        id=str(uuid.uuid4()),
        title="Deleted Case",
        description="Test",
        session_id=session_id,
        status=CaseStatus.COMPLETED.value,
        is_deleted=True,
    )

    db_session.add(active_case)
    db_session.add(deleted_case)
    db_session.commit()

    # List all cases
    response = client.get("/api/v1/cases", headers=headers)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Should only return active case
    assert len(data["cases"]) == 1
    assert data["cases"][0]["title"] == "Active Case"
    assert data["counts"]["all"] == 1


def test_create_case_validation(client):
    """Test case creation with invalid data."""
    # Missing required field
    invalid_case = {"description": "Only description, no title"}

    response = client.post("/api/v1/cases", json=invalid_case)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_get_featured_cases(client):
    """Test getting featured cases for homepage."""
    response = client.get("/api/v1/cases/featured")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Verify response structure
    assert "cases" in data
    assert "categories" in data
    assert "cached_at" in data
    assert isinstance(data["cases"], list)
    assert isinstance(data["categories"], list)

    # If there are cases, verify structure
    if data["cases"]:
        case = data["cases"][0]
        assert "category" in case
        assert "dilemma_preview" in case
        assert "recommended_steps" in case
        assert "verse_references" in case
        assert "has_followups" in case
