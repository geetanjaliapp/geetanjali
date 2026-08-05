"""Tests for the TTS provider seam.

Geetanjali stays on edge-tts this round, which is only a safe choice if leaving is cheap. These
tests pin that: provider failures are normalised into a stable error hierarchy, and no module
outside the seam knows which provider is in use.
"""

import asyncio
import re
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from services.tts import (
    EdgeTTSProvider,
    TTSEmptyResultError,
    TTSError,
    TTSTimeoutError,
    get_provider,
)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SEAM = BACKEND_ROOT / "services" / "tts" / "edge.py"


def _fake_stream(chunks):
    """Build an async generator standing in for edge_tts.Communicate.stream()."""

    async def stream():
        for chunk in chunks:
            yield chunk

    return stream


@pytest.mark.unit
class TestProviderIsolation:
    """The constraint that makes Fork 1-b reversible."""

    def test_edge_tts_is_imported_only_inside_the_seam(self):
        offenders = []
        for path in BACKEND_ROOT.rglob("*.py"):
            parts = path.parts
            if any(p in {"venv", ".venv-test", "htmlcov", "alembic"} for p in parts):
                continue
            if path == SEAM:
                continue
            source = path.read_text(encoding="utf-8", errors="ignore")
            if re.search(r"^\s*(import edge_tts|from edge_tts)", source, re.MULTILINE):
                offenders.append(str(path.relative_to(BACKEND_ROOT)))

        assert offenders == [], (
            "edge_tts imported outside services/tts/edge.py: "
            f"{offenders}. Swapping providers must stay a one-module change."
        )

    def test_api_layer_does_not_name_a_provider(self):
        source = (BACKEND_ROOT / "api" / "tts.py").read_text()
        assert "edge_tts" not in source.replace("# ", "")

    def test_get_provider_returns_a_synthesizer(self):
        provider = get_provider()
        assert hasattr(provider, "synthesize")
        assert isinstance(provider.name, str) and provider.name


@pytest.mark.unit
class TestErrorNormalisation:
    """Callers branch on TTSError subclasses, never on transport exceptions."""

    @pytest.mark.asyncio
    async def test_returns_joined_audio_chunks(self):
        chunks = [
            {"type": "audio", "data": b"abc"},
            {"type": "WordBoundary"},
            {"type": "audio", "data": b"def"},
        ]
        with patch("services.tts.edge.edge_tts.Communicate") as communicate:
            communicate.return_value.stream = _fake_stream(chunks)
            audio = await EdgeTTSProvider().synthesize(
                "hi", "en-IN-NeerjaNeural", "-5%", "+0Hz"
            )

        assert audio == b"abcdef"

    @pytest.mark.asyncio
    async def test_empty_audio_raises_empty_result(self):
        with patch("services.tts.edge.edge_tts.Communicate") as communicate:
            communicate.return_value.stream = _fake_stream([{"type": "WordBoundary"}])

            with pytest.raises(TTSEmptyResultError):
                await EdgeTTSProvider().synthesize("hi", "v", "-5%", "+0Hz")

    @pytest.mark.asyncio
    async def test_timeout_raises_tts_timeout_not_asyncio_timeout(self):
        async def hang():
            await asyncio.sleep(5)
            yield {"type": "audio", "data": b"x"}

        with patch("services.tts.edge.edge_tts.Communicate") as communicate:
            communicate.return_value.stream = lambda: hang()

            with pytest.raises(TTSTimeoutError):
                await EdgeTTSProvider(timeout_seconds=0.05).synthesize(
                    "hi", "v", "-5%", "+0Hz"
                )

    @pytest.mark.asyncio
    async def test_transport_failure_is_wrapped_in_tts_error(self):
        with patch("services.tts.edge.edge_tts.Communicate") as communicate:
            communicate.side_effect = ConnectionError("websocket 403")

            with pytest.raises(TTSError) as exc:
                await EdgeTTSProvider().synthesize("hi", "v", "-5%", "+0Hz")

        # 403s from the undocumented endpoint are the known edge-tts failure mode.
        assert "403" in str(exc.value)

    @pytest.mark.asyncio
    async def test_cancellation_propagates_rather_than_becoming_an_error(self):
        # A disconnected client is not a provider failure and must stay distinguishable.
        async def cancelled():
            raise asyncio.CancelledError()
            yield  # pragma: no cover

        with patch("services.tts.edge.edge_tts.Communicate") as communicate:
            communicate.return_value.stream = lambda: cancelled()

            with pytest.raises(asyncio.CancelledError):
                await EdgeTTSProvider().synthesize("hi", "v", "-5%", "+0Hz")


@pytest.mark.unit
class TestApiUsesTheSeam:
    """The endpoint delegates generation rather than owning it."""

    def test_endpoint_maps_provider_errors_to_status_codes(self, client):
        with patch("api.tts.get_provider") as get:
            get.return_value.synthesize = AsyncMock(side_effect=TTSTimeoutError("slow"))
            response = client.post("/api/v1/tts", json={"text": "hello", "lang": "en"})
        assert response.status_code == 504

        with patch("api.tts.get_provider") as get:
            get.return_value.synthesize = AsyncMock(side_effect=TTSEmptyResultError())
            response = client.post(
                "/api/v1/tts", json={"text": "hello there", "lang": "en"}
            )
        assert response.status_code == 503
