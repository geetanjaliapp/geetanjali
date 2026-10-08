"""Shared links expire; consultations the homepage features must not.

From 2026-03-22 every featured consultation on Home was past PUBLIC_CASE_EXPIRY_DAYS, so
/cases/featured kept listing cases that /cases/public/{slug} answered with 410.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from fastapi import status

from config import settings
from models import Case, FeaturedCase
from models.case import CaseStatus

pytestmark = pytest.mark.integration

PAST_EXPIRY = timedelta(days=settings.PUBLIC_CASE_EXPIRY_DAYS + 10)


def _public_case(db_session, slug: str, shared_ago: timedelta) -> Case:
    case = Case(
        id=str(uuid.uuid4()),
        title="Shared Case",
        description="Test description",
        status=CaseStatus.COMPLETED.value,
        is_public=True,
        public_slug=slug,
        shared_at=datetime.utcnow() - shared_ago,
    )
    db_session.add(case)
    db_session.commit()
    return case


def _feature(db_session, case: Case, active: bool = True) -> None:
    db_session.add(
        FeaturedCase(
            case_id=case.id, category="career", display_order=0, is_active=active
        )
    )
    db_session.commit()


def test_recent_share_is_readable(client, db_session):
    _public_case(db_session, "recentshr1", timedelta(days=1))
    assert (
        client.get("/api/v1/cases/public/recentshr1").status_code == status.HTTP_200_OK
    )


def test_old_share_expires(client, db_session):
    _public_case(db_session, "oldshare01", PAST_EXPIRY)
    assert (
        client.get("/api/v1/cases/public/oldshare01").status_code
        == status.HTTP_410_GONE
    )


def test_old_featured_case_stays_readable(client, db_session):
    case = _public_case(db_session, "featured01", PAST_EXPIRY)
    _feature(db_session, case)
    for path in ("", "/messages", "/outputs"):
        response = client.get(f"/api/v1/cases/public/featured01{path}")
        assert response.status_code == status.HTTP_200_OK, path


def test_retired_featured_case_expires_like_any_share(client, db_session):
    case = _public_case(db_session, "retired001", PAST_EXPIRY)
    _feature(db_session, case, active=False)
    assert (
        client.get("/api/v1/cases/public/retired001").status_code
        == status.HTTP_410_GONE
    )


def test_every_featured_case_opens(client, db_session):
    case = _public_case(db_session, "homecard01", PAST_EXPIRY)
    _feature(db_session, case)

    featured = client.get("/api/v1/cases/featured").json()["cases"]
    assert featured, "fixture case should be listed"
    for item in featured:
        response = client.get(f"/api/v1/cases/public/{item['slug']}")
        assert response.status_code == status.HTTP_200_OK, item["slug"]
