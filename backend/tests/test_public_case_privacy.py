"""A shared consultation must not reveal who owns it.

The anonymous session id is the only credential an anonymous owner has. Any public response
that carries it hands every case of that session to whoever opens the link.
"""

import uuid
from datetime import datetime

import pytest

from models import Case, FeaturedCase, Message, Output, User
from models.case import CaseStatus
from models.message import MessageRole
from services.cache import public_case_key

pytestmark = pytest.mark.integration

PUBLIC_CASE_KEYS = {"title", "description"}


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    from api.dependencies import limiter

    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()


def _case(db_session, *, session_id=None, user_id=None, slug=None, title="Case"):
    case = Case(
        id=str(uuid.uuid4()),
        title=title,
        description="synthetic dilemma",
        status=CaseStatus.COMPLETED.value,
        session_id=session_id,
        user_id=user_id,
        is_public=slug is not None,
        public_slug=slug,
        share_mode="full" if slug else None,
        shared_at=datetime.utcnow() if slug else None,
    )
    db_session.add(case)
    db_session.commit()
    return case


def _with_content(db_session, case):
    output = Output(
        id=str(uuid.uuid4()),
        case_id=case.id,
        result_json={
            "executive_summary": "summary",
            "options": [],
            "recommended_action": None,
            "reflection_prompts": [],
            "sources": [],
        },
        executive_summary="summary",
        confidence=0.8,
        scholar_flag=False,
        created_at=datetime.utcnow(),
    )
    db_session.add(output)
    db_session.add(
        Message(
            case_id=case.id,
            role=MessageRole.USER,
            content="question",
            created_at=datetime.utcnow(),
        )
    )
    db_session.commit()


def test_public_case_returns_only_allowlisted_keys(client, db_session):
    _case(db_session, session_id=str(uuid.uuid4()), slug="allowlist01")

    response = client.get("/api/v1/cases/public/allowlist01")

    assert response.status_code == 200
    assert set(response.json()) == PUBLIC_CASE_KEYS


def test_stale_cache_entry_is_served_without_owner_fields(
    client, mock_cache, monkeypatch
):
    monkeypatch.setattr("api.cases.cache", mock_cache)
    mock_cache.set(
        public_case_key("stalecache1"),
        {
            "id": str(uuid.uuid4()),
            "title": "cached",
            "description": "cached",
            "status": "completed",
            "share_mode": "full",
            "public_slug": "stalecache1",
            "created_at": "2026-11-01T00:00:00",
            "updated_at": "2026-11-01T00:00:00",
            "is_public": True,
            "session_id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
        },
        60,
    )

    response = client.get("/api/v1/cases/public/stalecache1")

    assert response.headers["X-Cache"] == "HIT"
    assert set(response.json()) == PUBLIC_CASE_KEYS


def test_share_link_gives_no_access_to_the_owners_other_cases(client, db_session):
    victim = str(uuid.uuid4())
    _case(db_session, session_id=victim, slug="chainlink01", title="shared")
    private = _case(db_session, session_id=victim, title="PRIVATE - never shared")

    public = client.get("/api/v1/cases/public/chainlink01").json()
    stolen = public.get("session_id") or str(uuid.uuid4())

    assert victim not in str(public)
    for headers in ({}, {"X-Session-ID": stolen}):
        assert (
            client.get(f"/api/v1/cases/{private.id}", headers=headers).status_code
            == 403
        )
    listed = client.get("/api/v1/cases", headers={"X-Session-ID": stolen})
    assert private.id not in listed.text

    signup = client.post(
        "/api/v1/auth/signup",
        headers={"X-Session-ID": stolen},
        json={"email": "a1@example.com", "name": "A", "password": "SecurePass123!"},
    )
    client.post(
        "/api/v1/auth/signup",
        json={"email": "a2@example.com", "name": "B", "password": "SecurePass123!"},
    )
    login = client.post(
        "/api/v1/auth/login",
        headers={"X-Session-ID": stolen},
        json={"email": "a2@example.com", "password": "SecurePass123!"},
    )
    for auth in (signup, login):
        token = auth.json()["access_token"]
        mine = client.get("/api/v1/cases", headers={"Authorization": f"Bearer {token}"})
        assert private.id not in mine.text

    owner = client.get(f"/api/v1/cases/{private.id}", headers={"X-Session-ID": victim})
    assert owner.status_code == 200


def test_no_public_endpoint_reveals_owner_identifiers(client, db_session):
    sentinel_session = str(uuid.uuid4())
    sentinel_user = str(uuid.uuid4())
    db_session.add(User(id=sentinel_user, email="owner@example.com", name="Owner"))
    db_session.commit()
    shared = _case(
        db_session,
        session_id=sentinel_session,
        user_id=sentinel_user,
        slug="sentinel01",
    )
    _with_content(db_session, shared)

    stray_session = str(uuid.uuid4())
    featured = _case(db_session, session_id=stray_session, slug="sentinel02")
    _with_content(db_session, featured)
    db_session.add(
        FeaturedCase(
            case_id=featured.id, category="career", display_order=0, is_active=True
        )
    )
    db_session.commit()

    responses = [
        client.get(f"/api/v1/cases/public/{slug}{path}")
        for slug in ("sentinel01", "sentinel02")
        for path in ("", "/messages", "/outputs")
    ]
    responses += [
        client.post("/api/v1/cases/public/sentinel01/view"),
        client.get("/api/v1/cases/featured"),
    ]

    for response in responses:
        assert response.status_code == 200, response.request.url
        raw = response.text + str(response.headers)
        for sentinel in (sentinel_session, sentinel_user, stray_session):
            assert sentinel not in raw, response.request.url
