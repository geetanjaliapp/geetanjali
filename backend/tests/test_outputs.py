"""Tests for output/analysis endpoints."""

import pytest
from fastapi import status
import uuid


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
    assert response.status_code == status.HTTP_201_CREATED, (
        f"Case creation failed: {response.status_code} - {response.text}"
    )
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


def test_analyze_case_not_found(client):
    """Test analyzing a non-existent case."""
    response = client.post("/api/v1/cases/nonexistent-id/analyze")
    assert response.status_code == status.HTTP_404_NOT_FOUND


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
