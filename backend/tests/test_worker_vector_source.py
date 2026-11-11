"""Worker refuses to start when no vector search source is configured."""

import logging
from unittest.mock import MagicMock

import pytest

from config import settings

pytestmark = pytest.mark.unit

KEY = "test-internal-key"


@pytest.fixture
def worker(monkeypatch):
    # The local VectorStore loads the embedding model; the guard must never build it.
    monkeypatch.setattr(
        "services.vector_store.VectorStore",
        MagicMock(side_effect=AssertionError("guard built VectorStore")),
    )
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "USE_REMOTE_VECTOR_SEARCH", True)
    monkeypatch.setattr(
        settings, "VECTOR_SEARCH_URL", "http://backend:8000/internal/search"
    )
    monkeypatch.setattr(settings, "INTERNAL_API_KEY", KEY)
    monkeypatch.setattr(settings, "CHROMA_HOST", None)
    monkeypatch.setattr("services.remote_vector_search._remote_vector_search", None)

    import worker

    return worker


def test_remote_configured_ok(worker):
    assert worker.vector_source_error() is None


def test_remote_missing_key_refuses(worker, monkeypatch):
    monkeypatch.setattr(settings, "INTERNAL_API_KEY", None)
    assert "INTERNAL_API_KEY" in worker.vector_source_error()


def test_remote_missing_url_refuses(worker, monkeypatch):
    monkeypatch.setattr(settings, "VECTOR_SEARCH_URL", "")
    assert "VECTOR_SEARCH_URL" in worker.vector_source_error()


def test_local_without_host_refuses(worker, monkeypatch):
    monkeypatch.setattr(settings, "USE_REMOTE_VECTOR_SEARCH", False)
    assert "CHROMA_HOST" in worker.vector_source_error()


def test_local_with_host_in_dev_ok(worker, monkeypatch):
    monkeypatch.setattr(settings, "USE_REMOTE_VECTOR_SEARCH", False)
    monkeypatch.setattr(settings, "CHROMA_HOST", "chromadb")
    assert worker.vector_source_error() is None


def test_local_with_host_in_production_ok(worker, monkeypatch):
    monkeypatch.setattr(settings, "USE_REMOTE_VECTOR_SEARCH", False)
    monkeypatch.setattr(settings, "CHROMA_HOST", "chromadb")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    assert worker.vector_source_error() is None


def test_run_worker_refusal_exits_1_without_api_server(worker, monkeypatch, caplog):
    monkeypatch.setattr(settings, "REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setattr(settings, "RQ_ENABLED", True)
    monkeypatch.setattr(settings, "VECTOR_SEARCH_URL", "")
    start_api_server = MagicMock()
    monkeypatch.setattr(worker, "start_api_server", start_api_server)

    with caplog.at_level(logging.ERROR), pytest.raises(SystemExit) as exc:
        worker.run_worker()

    assert exc.value.code == 1
    start_api_server.assert_not_called()
    assert "Worker has no vector source" in caplog.text
