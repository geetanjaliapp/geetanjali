"""Sentry events must not carry credentials, whatever their header case or location."""

import json
import logging
import re
import secrets
import uuid
import weakref
from unittest.mock import patch

import pytest
import sentry_sdk
from fastapi import FastAPI
from fastapi.testclient import TestClient
from redis import Redis
from rq import Queue
from rq.worker.base import logger as rq_worker_logger
from sentry_sdk.integrations.rq import _make_event_processor
from sentry_sdk.transport import Transport

from api.follow_up import run_follow_up_background
from services import tasks
from utils import sentry as sentry_module
from utils.sentry import _filter_event, _scrub_url

# Bound at import: conftest patches tasks.enqueue_task for every test.
real_enqueue_task = tasks.enqueue_task

pytestmark = pytest.mark.unit

SECRET = str(uuid.uuid4())
TOKEN = secrets.token_urlsafe(32)
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


def _events(envelopes):
    """Error and message events, parsed (an envelope is one JSON document per line)."""
    sentry_sdk.flush()
    docs = [json.loads(line) for env in envelopes for line in env.splitlines() if line]
    return [d for d in docs if "platform" in d and d.get("type") != "transaction"]


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


@pytest.mark.parametrize("redis_down", [False, True])
def test_daily_limit_redis_traffic_carries_no_session_id(sent, monkeypatch, redis_down):
    import asyncio

    import redis
    from starlette.requests import Request

    from api import dependencies
    from services import cache as cache_module

    store = {}

    def fake_redis(self, *args, **options):
        command = str(args[0]).upper()
        if command == "GET" and redis_down:
            raise redis.ConnectionError("timeout")
        if command == "INCRBY":
            store[args[1]] = store.get(args[1], 0) + 1
            return store[args[1]]
        return store.get(args[1]) if command == "GET" else True

    monkeypatch.setattr(redis.Redis, "_execute_command", fake_redis)
    monkeypatch.setattr(cache_module.settings, "REDIS_ENABLED", True)
    monkeypatch.setattr(cache_module.settings, "REDIS_URL", "redis://test:6379/0")
    monkeypatch.setattr(cache_module, "_redis_client", None)
    monkeypatch.setattr(cache_module, "_redis_available", None)
    monkeypatch.setattr(dependencies, "cache", cache_module.CacheService())
    monkeypatch.setattr(dependencies.settings, "DAILY_CONSULT_LIMIT_ENABLED", True)
    scope = {"type": "http", "client": ("203.0.113.9", 1), "headers": []}

    with sentry_sdk.start_transaction(name="/api/v1/cases/{case_id}/analyze/async"):
        asyncio.run(dependencies.check_daily_limit(Request(scope), None, SECRET))
        dependencies.increment_daily_consult_count(Request(scope), SECRET)
    sentry_sdk.capture_message("after the daily-limit path")

    payload = _send(sent)
    assert "consult:daily:session:" in payload
    assert SECRET not in payload


def _queued_job():
    queue = Queue("default", connection=Redis(host="127.0.0.1", port=1))
    with (
        patch.object(tasks, "get_queue", return_value=queue),
        patch.object(Queue, "enqueue_job", side_effect=lambda job, **_: job) as push,
    ):
        assert real_enqueue_task(
            run_follow_up_background, "case-1", "msg-1", DILEMMA, "corr-1"
        )
    return push.call_args.args[0]


def test_queued_job_description_carries_no_job_arguments():
    # The worker logs job.description at INFO on dequeue and on success.
    job = _queued_job()

    assert DILEMMA not in job.description
    assert job.args[2] == DILEMMA


def test_worker_event_carries_no_job_arguments(sent):
    job = _queued_job()

    with sentry_sdk.new_scope() as scope:
        scope.add_event_processor(_make_event_processor(weakref.ref(job)))
        sentry_sdk.capture_message("follow-up failed")

    payload = _send(sent)
    assert '"rq-job"' in payload
    assert DILEMMA not in payload


def test_failed_job_log_does_not_reach_sentry(sent):
    # Worker.handle_exception logs the job args as record extras; RqIntegration ignores its logger
    rq_worker_logger.error("job failed", extra={"arguments": (DILEMMA,)})
    sentry_sdk.capture_message("marker")

    assert DILEMMA not in _send(sent)


def test_access_log_lines_do_not_reach_sentry(sent, caplog):
    caplog.set_level(logging.INFO, logger="uvicorn.access")
    logging.getLogger("uvicorn.access").info("POST /api/v1/cases 200")
    logging.getLogger("test.sentry").info("kept")
    sentry_sdk.capture_message("marker")

    (event,) = _events(sent)
    crumbs = [c.get("category") for c in event["breadcrumbs"]["values"]]
    assert "test.sentry" in crumbs and "uvicorn.access" not in crumbs


def test_log_line_breadcrumb_tokens_are_filtered(sent):
    logging.getLogger("api.middleware.csrf").warning(
        "CSRF validation failed for POST /api/v1/auth/verify-email/%s: token mismatch", TOKEN
    )
    sentry_sdk.capture_message("marker")

    (event,) = _events(sent)
    messages = [c.get("message") for c in event["breadcrumbs"]["values"]]
    assert (
        "CSRF validation failed for POST /api/v1/auth/verify-email/[Filtered]: token mismatch"
        in messages
    )


def test_capture_context_is_filtered(sent):
    url = f"https://geetanjaliapp.com/api/v1/newsletter/unsubscribe/{TOKEN}?token={TOKEN}"
    sentry_module.capture_exception(RuntimeError("boom"), path=url)

    (event,) = _events(sent)
    assert event["extra"]["path"].count("[Filtered]") == 2
    assert TOKEN not in json.dumps(event)


def test_server_error_on_a_token_route_leaks_no_token(sent):
    from db.connection import get_db
    from main import app

    def db_down():
        raise RuntimeError("db down")

    routes = [
        (method, path.replace("{token}", TOKEN) + f"?token={TOKEN}")
        for path, ops in app.openapi()["paths"].items()
        if "{token}" in path
        for method in ops
    ]
    client = TestClient(app, raise_server_exceptions=False)  # no lifespan: no startup sync
    app.dependency_overrides[get_db] = db_down
    try:
        for method, url in routes:
            assert client.request(method, url, json={}).status_code == 500, url
    finally:
        app.dependency_overrides.pop(get_db)

    events = _events(sent)
    errors = [e for e in events if "db down" in json.dumps(e.get("exception"))]
    assert len(errors) >= len(routes)
    assert TOKEN not in json.dumps(events)


@pytest.mark.parametrize(
    "api, page",
    [
        ("/api/v1/auth/verify-email/{}", "/verify-email/{}"),
        ("/api/v1/newsletter/verify/{}", "/n/verify/{}"),
        ("/api/v1/newsletter/unsubscribe/{}", "/n/unsubscribe/{}"),
        ("/api/v1/newsletter/preferences/{}", "/n/preferences/{}"),
        ("/api/v1/auth/reset-password", "/reset-password?token={}"),
    ],
)
def test_url_tokens_are_filtered(api, page):
    site = "https://geetanjaliapp.com"
    event = {
        "request": {
            "url": site + api.format(SECRET),
            "query_string": f"token={SECRET}",
            "headers": {"Referer": site + page.format(SECRET)},
        }
    }

    filtered = _filter_event(event, {})

    assert SECRET not in str(filtered)
    assert filtered["request"]["url"] == site + api.format("[Filtered]")
    assert filtered["request"]["headers"]["Referer"] == site + page.format("[Filtered]")


# Path parameters that carry no secret. A new name fails the test below until it is
# classified here or, if it is a secret, filtered in _scrub_url.
NON_SECRET_PATH_PARAMS = {
    "canonical_id",
    "case_id",
    "chapter_number",
    "experiment_name",
    "filename",
    "goal_id",
    "output_id",
    "principle_id",
    "slug",
    "verse_number",
}


def test_every_token_route_is_filtered():
    from main import app

    routes = [
        (name, path)
        for path in app.openapi()["paths"]
        for name in re.findall(r"\{(\w+)\}", path)
    ]
    assert {name for name, _ in routes} - NON_SECRET_PATH_PARAMS == {"token"}
    for name, path in routes:
        if name == "token":
            assert SECRET not in _scrub_url(path.replace("{token}", SECRET)), path


def test_url_without_a_token_survives():
    url = "https://geetanjaliapp.com/api/v1/cases/public/abc123"
    event = {"request": {"url": url}}

    assert _filter_event(event, {})["request"]["url"] == url
