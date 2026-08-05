"""TTS provider interface.

Geetanjali stays on edge-tts for now (see todos/sketch/v1.40.0-refresh-and-detect.md, Fork 1-b),
but edge-tts reaches Microsoft's voices through an undocumented endpoint that breaks periodically
and which Microsoft does not sanction for commercial use. That is a decision to revisit with data
from `client_degradation_total`, not a permanent position.

This seam is what keeps that decision cheap: swapping to Azure Speech should be a new module and a
config value, not a rewrite. Nothing outside `services/tts/edge.py` may import `edge_tts`.
"""

from typing import Protocol


class TTSError(Exception):
    """Base for provider failures. Callers map these to HTTP status codes."""


class TTSTimeoutError(TTSError):
    """Provider did not deliver audio within the allotted time."""


class TTSEmptyResultError(TTSError):
    """Provider completed but returned no audio."""


class TTSProvider(Protocol):
    """Synthesises speech audio.

    Implementations own their transport and error handling, and must translate provider-specific
    failures into the TTSError hierarchy above so callers stay provider-agnostic.
    """

    name: str

    async def synthesize(
        self,
        text: str,
        voice: str,
        rate: str,
        pitch: str,
    ) -> bytes:
        """Return MP3 audio for `text`.

        Args:
            text: Cleaned, speakable text. Markdown must already be stripped.
            voice: Provider-specific voice identifier.
            rate: Relative speech rate, e.g. "-5%".
            pitch: Relative pitch, e.g. "+0Hz".

        Returns:
            MP3 bytes.

        Raises:
            TTSTimeoutError: Generation exceeded the provider's deadline.
            TTSEmptyResultError: Generation succeeded but produced no audio.
            TTSError: Any other provider failure.
        """
        ...
