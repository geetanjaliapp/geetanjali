"""The anonymous session id is a credential: the server sets it, and no response carries it."""

import uuid

import pytest

from main import app
from models import Case

pytestmark = pytest.mark.integration

# Owner-only routes may return the caller's own user_id.
USER_ID_ROUTES = {
    "POST /api/v1/cases",
    "GET /api/v1/cases/{case_id}",
    "POST /api/v1/cases/{case_id}/retry",
    "POST /api/v1/cases/{case_id}/share",
    "POST /api/v1/cases/{case_id}/analyze/async",
    "POST /api/v1/outputs/{output_id}/feedback",
}

CASE_BODY = {"title": "A dilemma", "description": "Should I take the new job offer?"}


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    from api.dependencies import limiter

    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()


def _response_fields(node, schemas, seen):
    """Property names reachable from an OpenAPI node, following $refs."""
    found = set()
    if isinstance(node, dict):
        ref = node.get("$ref")
        if ref:
            name = ref.rsplit("/", 1)[-1]
            if name not in seen:
                seen.add(name)
                found |= _response_fields(schemas[name], schemas, seen)
            return found
        found |= set(node.get("properties", {}))
        for value in node.values():
            found |= _response_fields(value, schemas, seen)
    elif isinstance(node, list):
        for value in node:
            found |= _response_fields(value, schemas, seen)
    return found


def _routes_exposing(field):
    spec = app.openapi()
    schemas = spec["components"]["schemas"]
    exposing = set()
    for path, operations in spec["paths"].items():
        for method, operation in operations.items():
            success = {
                code: body
                for code, body in operation.get("responses", {}).items()
                if code.startswith("2")
            }
            if field in _response_fields(success, schemas, set()):
                exposing.add(f"{method.upper()} {path}")
    return exposing


def test_no_response_model_carries_session_id():
    assert _routes_exposing("session_id") == set()


def test_user_id_only_on_owner_routes():
    assert _routes_exposing("user_id") <= USER_ID_ROUTES


def _stored_session(db_session, case_id):
    db_session.expire_all()
    return db_session.get(Case, case_id).session_id


def test_create_ignores_session_id_in_body(client, db_session):
    header = str(uuid.uuid4())
    body = {**CASE_BODY, "session_id": str(uuid.uuid4())}

    with_header = client.post(
        "/api/v1/cases", json=body, headers={"X-Session-ID": header}
    )
    without_header = client.post("/api/v1/cases", json=body)

    assert with_header.status_code == 201
    assert "session_id" not in with_header.json()
    assert _stored_session(db_session, with_header.json()["id"]) == header
    assert _stored_session(db_session, without_header.json()["id"]) is None
    listed = client.get("/api/v1/cases", headers={"X-Session-ID": header})
    assert listed.status_code == 200
    assert all("session_id" not in case for case in listed.json())


def test_logged_in_create_stores_no_session_id(client, db_session):
    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": "u@example.com", "name": "U", "password": "SecurePass123!"},
    )
    token = signup.json()["access_token"]

    created = client.post(
        "/api/v1/cases",
        json=CASE_BODY,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Session-ID": str(uuid.uuid4()),
        },
    )

    assert created.status_code == 201
    assert _stored_session(db_session, created.json()["id"]) is None
