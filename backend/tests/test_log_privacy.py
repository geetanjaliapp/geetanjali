"""Logs never carry the anonymous session id (a credential) or a consultation title."""

import logging
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

SESSION = str(uuid.uuid4())
TITLE = "Sentinel title 7f3a"


def _leaks(caplog, *secrets):
    """Records whose message or extra fields contain any secret."""
    return [
        record
        for record in caplog.records
        for secret in secrets
        if secret in record.getMessage() or secret in str(record.__dict__)
    ]


@pytest.mark.integration
def test_case_create_logs_no_session_id_or_title(client, caplog):
    caplog.set_level(logging.DEBUG)

    response = client.post(
        "/api/v1/cases",
        json={"title": TITLE, "description": "Should I take the new job offer?"},
        headers={"X-Session-ID": SESSION},
    )

    assert response.status_code == 201
    assert _leaks(caplog, SESSION, TITLE) == []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_daily_limit_log_has_no_session_id(caplog, monkeypatch):
    from api import dependencies

    monkeypatch.setattr(dependencies.settings, "DAILY_CONSULT_LIMIT_ENABLED", True)
    monkeypatch.setattr(
        dependencies.cache, "get", lambda key: dependencies.settings.DAILY_CONSULT_LIMIT
    )
    request = SimpleNamespace(client=SimpleNamespace(host="203.0.113.9"))
    caplog.set_level(logging.DEBUG)

    with pytest.raises(HTTPException) as raised:
        await dependencies.check_daily_limit(request, db=None, session_id=SESSION)

    assert raised.value.status_code == 429
    assert any("Daily consultation limit" in r.getMessage() for r in caplog.records)
    assert _leaks(caplog, SESSION) == []


@pytest.mark.unit
def test_pipeline_start_logs_no_title(caplog, monkeypatch):
    from services.rag import pipeline

    class Stop(Exception):
        pass

    def stop(_text):
        raise Stop

    monkeypatch.setattr(pipeline, "normalize_input", stop)
    caplog.set_level(logging.DEBUG)

    with pytest.raises(Stop):
        pipeline.RAGPipeline.__new__(pipeline.RAGPipeline).run(
            {"title": TITLE, "description": "d"}
        )

    assert any("RAG pipeline" in r.getMessage() for r in caplog.records)
    assert _leaks(caplog, TITLE) == []
