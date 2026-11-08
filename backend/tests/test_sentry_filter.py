"""Sentry events must not carry credentials, whatever their header case or location."""

import pytest

from utils.sentry import _filter_event

pytestmark = pytest.mark.unit

SECRET = "3f2b8c1e-5d4a-4b6f-9e7d-2a1c0b9e8f7d"


def _event(**overrides):
    event = {
        "request": {
            "headers": {
                "x-session-id": SECRET,
                "X-Session-ID": SECRET,
                "authorization": f"Bearer {SECRET}",
                "cookie": f"refresh={SECRET}",
                "User-Agent": "Mozilla/5.0",
                "content-type": "application/json",
            },
            "data": {"session_id": SECRET, "title": "ok"},
        },
        "extra": {"session_id": SECRET, "tracking_key": SECRET, "count": 3},
        "breadcrumbs": {
            "values": [
                {"category": "log", "data": {"tracking_key": SECRET, "limit": 20}},
                {"category": "http", "data": {"X-Session-ID": SECRET}},
            ]
        },
    }
    event.update(overrides)
    return event


def test_no_credential_survives_anywhere_in_the_event():
    filtered = _filter_event(_event(), {})

    assert SECRET not in str(filtered)


def test_allowlisted_headers_and_ordinary_fields_survive():
    filtered = _filter_event(_event(), {})

    headers = filtered["request"]["headers"]
    assert headers["User-Agent"] == "Mozilla/5.0"
    assert headers["content-type"] == "application/json"
    assert filtered["extra"]["count"] == 3
    assert filtered["breadcrumbs"]["values"][0]["data"]["limit"] == 20
    assert filtered["request"]["data"]["title"] == "ok"


def test_headers_in_an_unexpected_shape_are_dropped():
    event = _event()
    event["request"]["headers"] = [["X-Session-Id", SECRET], ["Accept", "*/*"]]

    assert SECRET not in str(_filter_event(event, {}))
