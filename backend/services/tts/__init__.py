"""TTS generation, behind a provider seam.

Callers use `get_provider()` and the TTSError hierarchy; they never import a concrete provider.
"""

from services.tts.edge import EdgeTTSProvider
from services.tts.provider import (
    TTSEmptyResultError,
    TTSError,
    TTSProvider,
    TTSTimeoutError,
)

__all__ = [
    "EdgeTTSProvider",
    "TTSEmptyResultError",
    "TTSError",
    "TTSProvider",
    "TTSTimeoutError",
    "get_provider",
]

_provider: TTSProvider | None = None


def get_provider() -> TTSProvider:
    """Return the configured TTS provider.

    Single implementation today. When a second one lands this reads a config value; the point of
    the indirection is that no caller changes when it does.
    """
    global _provider
    if _provider is None:
        _provider = EdgeTTSProvider()
    return _provider
