"""Microsoft Edge TTS provider.

The only module permitted to import `edge_tts`. See provider.py for why that matters.
"""

import asyncio
import logging

import edge_tts

from services.tts.provider import TTSEmptyResultError, TTSError, TTSTimeoutError

logger = logging.getLogger(__name__)

# Edge TTS occasionally hangs rather than failing, so generation is always bounded.
TTS_TIMEOUT_SECONDS = 30


class EdgeTTSProvider:
    """Synthesises via the Microsoft Edge read-aloud endpoint."""

    name = "edge"

    def __init__(self, timeout_seconds: int = TTS_TIMEOUT_SECONDS) -> None:
        self._timeout = timeout_seconds

    async def synthesize(
        self,
        text: str,
        voice: str,
        rate: str,
        pitch: str,
    ) -> bytes:
        """Return MP3 audio for `text`. See TTSProvider.synthesize."""
        chunks: list[bytes] = []

        try:
            # Construction is inside the try: Communicate validates its arguments eagerly and
            # raises, and those failures must be normalised like any other transport error.
            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate=rate,
                pitch=pitch,
            )

            async def collect() -> None:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        chunks.append(chunk["data"])

            await asyncio.wait_for(collect(), timeout=self._timeout)
        except asyncio.TimeoutError as exc:
            raise TTSTimeoutError(f"Edge TTS timed out after {self._timeout}s") from exc
        except asyncio.CancelledError:
            # Client disconnected. Propagate so the caller can distinguish it from a failure.
            raise
        except Exception as exc:
            raise TTSError(f"Edge TTS generation failed: {exc}") from exc

        if not chunks:
            raise TTSEmptyResultError("Edge TTS returned no audio data")

        return b"".join(chunks)
