"""Tests for output/analysis endpoints."""

import uuid

import pytest
from fastapi import status

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


@pytest.fixture
def case_for_analysis(client):
    """Create a case for analysis testing with session."""
    session_id = str(uuid.uuid4())
    case_data = {
        "title": "Ethical Dilemma Test",
        "description": "Should we prioritize speed or quality?",
        "role": "Project Manager",
        "stakeholders": ["team", "client"],
        "constraints": ["budget", "deadline"],
        "horizon": "short",
        "sensitivity": "medium",
    }
    response = client.post(
        "/api/v1/cases", json=case_data, headers={"X-Session-ID": session_id}
    )
    # Skip if rate limited
    if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        pytest.skip("Rate limited during fixture setup")
    # Ensure case creation succeeded before returning
    assert (
        response.status_code == status.HTTP_201_CREATED
    ), f"Case creation failed: {response.status_code} - {response.text}"
    return {"case": response.json(), "session_id": session_id}


@pytest.fixture
def mock_rag_result():
    """Sample RAG pipeline result."""
    return {
        "executive_summary": "Consider both speed and quality based on stakeholder needs.",
        "options": [
            {
                "title": "Prioritize Speed",
                "pros": ["Meet deadline"],
                "cons": ["Technical debt"],
                "verses": ["BG_2_47"],
            }
        ],
        "recommended_action": {"option": 1, "steps": ["Act now"]},
        "reflection_prompts": ["What defines success?"],
        "sources": [{"canonical_id": "BG_2_47", "paraphrase": "Focus on duty."}],
        "confidence": 0.85,
        "scholar_flag": False,
        "suggested_title": "Speed vs Quality",
    }


def test_get_output_not_found(client):
    """Test getting a non-existent output."""
    response = client.get("/api/v1/outputs/nonexistent-id")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_list_outputs_for_nonexistent_case(client):
    """Test listing outputs for non-existent case."""
    response = client.get("/api/v1/cases/nonexistent-id/outputs")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_list_outputs_empty(client, case_for_analysis):
    """Test listing outputs for case with no outputs."""
    case_id = case_for_analysis["case"]["id"]
    session_id = case_for_analysis["session_id"]

    response = client.get(
        f"/api/v1/cases/{case_id}/outputs", headers={"X-Session-ID": session_id}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_analyze_async_returns_202(client, case_for_analysis):
    """Test async analysis endpoint returns 202."""
    case_id = case_for_analysis["case"]["id"]
    session_id = case_for_analysis["session_id"]

    response = client.post(
        f"/api/v1/cases/{case_id}/analyze/async", headers={"X-Session-ID": session_id}
    )

    # May be rate limited
    if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        pytest.skip("Rate limited")

    assert response.status_code == status.HTTP_202_ACCEPTED
    case = response.json()
    assert case["id"] == case_id
    assert case["status"] == "pending"


def test_outputs_accessible_for_session_case(client, case_for_analysis):
    """Test that session-based cases have publicly accessible outputs."""
    case_id = case_for_analysis["case"]["id"]
    session_id = case_for_analysis["session_id"]

    # Session owner can access
    response = client.get(
        f"/api/v1/cases/{case_id}/outputs", headers={"X-Session-ID": session_id}
    )
    assert response.status_code == status.HTTP_200_OK


# =============================================================================
# Feedback Tests
# =============================================================================


@pytest.fixture
def output_with_session(client, db_session):
    """Create a case with an output for feedback testing."""
    from datetime import datetime

    from models import Case, Output

    session_id = str(uuid.uuid4())

    # Create case directly in DB
    case = Case(
        id=str(uuid.uuid4()),
        title="Test Case",
        description="Test description",
        status="completed",
        session_id=session_id,
        created_at=datetime.utcnow(),
    )
    db_session.add(case)

    # Create output directly in DB (result_json stores the full response)
    output = Output(
        id=str(uuid.uuid4()),
        case_id=case.id,
        result_json={
            "executive_summary": "Test summary",
            "options": [],
            "recommended_action": {},
            "reflection_prompts": [],
            "sources": [],
        },
        executive_summary="Test summary",
        confidence=0.8,
        scholar_flag=False,
        created_at=datetime.utcnow(),
    )
    db_session.add(output)
    db_session.commit()

    return {"output_id": output.id, "case_id": case.id, "session_id": session_id}


def test_submit_feedback_creates_new(client, output_with_session):
    """Test submitting new feedback returns 201."""
    output_id = output_with_session["output_id"]
    session_id = output_with_session["session_id"]

    response = client.post(
        f"/api/v1/outputs/{output_id}/feedback",
        json={"rating": True},
        headers={"X-Session-ID": session_id},
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["rating"] is True
    assert data["output_id"] == output_id


def test_submit_feedback_updates_existing(client, output_with_session):
    """Test updating existing feedback returns 200."""
    output_id = output_with_session["output_id"]
    session_id = output_with_session["session_id"]

    # Create feedback first
    response1 = client.post(
        f"/api/v1/outputs/{output_id}/feedback",
        json={"rating": True},
        headers={"X-Session-ID": session_id},
    )
    assert response1.status_code == status.HTTP_201_CREATED

    # Update feedback (change to thumbs down with comment)
    response2 = client.post(
        f"/api/v1/outputs/{output_id}/feedback",
        json={"rating": False, "comment": "Could be better"},
        headers={"X-Session-ID": session_id},
    )

    assert response2.status_code == status.HTTP_200_OK
    data = response2.json()
    assert data["rating"] is False
    assert data["comment"] == "Could be better"


def test_submit_feedback_not_found(client):
    """Test feedback on non-existent output returns 404."""
    session_id = str(uuid.uuid4())

    response = client.post(
        "/api/v1/outputs/nonexistent-id/feedback",
        json={"rating": True},
        headers={"X-Session-ID": session_id},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_delete_feedback(client, output_with_session):
    """Test deleting feedback works."""
    output_id = output_with_session["output_id"]
    session_id = output_with_session["session_id"]

    # Create feedback first
    response1 = client.post(
        f"/api/v1/outputs/{output_id}/feedback",
        json={"rating": True},
        headers={"X-Session-ID": session_id},
    )
    assert response1.status_code == status.HTTP_201_CREATED

    # Delete feedback
    response2 = client.delete(
        f"/api/v1/outputs/{output_id}/feedback",
        headers={"X-Session-ID": session_id},
    )

    assert response2.status_code == status.HTTP_204_NO_CONTENT


def test_delete_feedback_not_found(client, output_with_session):
    """Test deleting non-existent feedback returns 404."""
    output_id = output_with_session["output_id"]
    session_id = output_with_session["session_id"]

    # Try to delete without creating feedback first
    response = client.delete(
        f"/api/v1/outputs/{output_id}/feedback",
        headers={"X-Session-ID": session_id},
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
