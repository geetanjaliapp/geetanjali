"""Sentry events must not carry credentials, whatever their header case or location."""

import logging
import uuid

import pytest
import sentry_sdk
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sentry_sdk.transport import Transport

from utils import sentry as sentry_module
from utils.sentry import _filter_event

pytestmark = pytest.mark.unit

SECRET = str(uuid.uuid4())
DILEMMA = "Sentinel dilemma 9c41"


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


class _Capture(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.envelopes = []

    def capture_envelope(self, envelope):
        self.envelopes.append(envelope.serialize().decode("utf-8", "replace"))


@pytest.fixture
def sent(monkeypatch):
    """Envelopes from a client built by the real init_sentry, with every request traced."""
    transport = _Capture()
    real_init = sentry_sdk.init
    monkeypatch.setattr(sentry_module, "_sentry_initialized", False)
    monkeypatch.setattr(
        sentry_module.settings, "SENTRY_DSN", "https://k@o0.ingest.sentry.io/0"
    )
    monkeypatch.setattr(sentry_module.settings, "SENTRY_TRACES_SAMPLE_RATE", 1.0)
    monkeypatch.setattr(
        sentry_sdk, "init", lambda **kw: real_init(transport=transport, **kw)
    )
    assert sentry_module.init_sentry("test")
    yield transport.envelopes
    real_init()


def _send(envelopes):
    sentry_sdk.flush()
    assert envelopes, "nothing reached the transport"
    return "".join(envelopes)


def test_exception_event_carries_no_frame_locals(sent):
    def handler(session_id, title):
        raise RuntimeError("boom")

    try:
        handler(SECRET, DILEMMA)
    except RuntimeError:
        sentry_sdk.capture_exception()

    payload = _send(sent)
    assert SECRET not in payload and DILEMMA not in payload


def test_error_log_event_carries_no_frame_locals(sent):
    def handler(session_id, title):
        logging.getLogger("test.sentry").error("consultation failed")

    handler(SECRET, DILEMMA)

    payload = _send(sent)
    assert SECRET not in payload and DILEMMA not in payload


def test_sampled_transaction_carries_no_session_header_or_body(sent):
    app = FastAPI()

    @app.post("/api/v1/cases")
    async def create(body: dict):
        return {"ok": True}

    with TestClient(app) as client:
        client.post(
            "/api/v1/cases",
            json={"title": DILEMMA, "description": DILEMMA},
            headers={"X-Session-ID": SECRET},
        )

    payload = _send(sent)
    assert '"type":"transaction"' in payload
    assert SECRET not in payload and DILEMMA not in payload
