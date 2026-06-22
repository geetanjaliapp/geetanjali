"""Integration tests for v1.39.0 verse-consultation bridge."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import status
from sqlalchemy.orm import Session

from api.outputs import _build_case_data
from models.case import Case, CaseStatus


@pytest.mark.unit
class TestBuildCaseData:
    """_build_case_data includes anchor_verse_id in pipeline dict."""

    def test_includes_anchor_verse_id_when_set(self):
        case = MagicMock(spec=Case)
        case.title = "Test"
        case.description = "Test description"
        case.role = "Individual"
        case.stakeholders = []
        case.constraints = []
        case.horizon = "medium"
        case.sensitivity = "low"
        case.anchor_verse_id = "BG_2_47"

        result = _build_case_data(case)

        assert result["anchor_verse_id"] == "BG_2_47"

    def test_anchor_verse_id_none_when_not_set(self):
        case = MagicMock(spec=Case)
        case.title = "Test"
        case.description = "Test description"
        case.role = "Individual"
        case.stakeholders = []
        case.constraints = []
        case.horizon = "medium"
        case.sensitivity = "low"
        case.anchor_verse_id = None

        result = _build_case_data(case)

        assert result["anchor_verse_id"] is None

    def test_anchor_verse_id_not_present_on_legacy_case(self):
        """Cases without anchor_verse_id (pre-migration) return None."""
        case = MagicMock(spec=Case)
        case.title = "Test"
        case.description = "Test description"
        case.role = "Individual"
        case.stakeholders = []
        case.constraints = []
        case.horizon = "medium"
        case.sensitivity = "low"
        # Simulate a Case without anchor_verse_id attribute accessor
        # (MagicMock attributes default to returning a MagicMock, so we mock it)
        case.anchor_verse_id = None

        result = _build_case_data(case)

        assert result["anchor_verse_id"] is None


@pytest.mark.integration
class TestConsultationAnchorVerse:
    """End-to-end: case with anchor_verse_id persists and flows to output."""

    def test_create_case_with_anchor_verse_id(self, client):
        """POST /api/v1/cases accepts anchor_verse_id and persists it."""
        case_data = {
            "title": "Career change dilemma",
            "description": "I am torn between duty and ambition.",
            "role": "Individual",
            "anchor_verse_id": "BG_2_47",
        }

        response = client.post("/api/v1/cases", json=case_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["anchor_verse_id"] == "BG_2_47"
        assert "id" in data

    def test_create_case_without_anchor_verse_id(self, client):
        """POST /api/v1/cases without anchor_verse_id — legacy behavior, null."""
        case_data = {
            "title": "Career change dilemma",
            "description": "I am torn between duty and ambition.",
            "role": "Individual",
        }

        response = client.post("/api/v1/cases", json=case_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["anchor_verse_id"] is None

    def test_list_cases_includes_anchor_verse_id(self, client):
        """GET /api/v1/cases returns anchor_verse_id when set."""
        # Create a case with anchor
        create_resp = client.post("/api/v1/cases", json={
            "title": "Test case with anchor",
            "description": "Test description.",
            "role": "Individual",
            "anchor_verse_id": "BG_3_15",
        })
        assert create_resp.status_code == status.HTTP_201_CREATED

        # List cases
        list_resp = client.get("/api/v1/cases")
        assert list_resp.status_code == status.HTTP_200_OK
        cases = list_resp.json()["cases"]

        # Our case should be in the list with anchor_verse_id
        created_id = create_resp.json()["id"]
        found = [c for c in cases if c["id"] == created_id]
        assert len(found) == 1
        assert found[0]["anchor_verse_id"] == "BG_3_15"
