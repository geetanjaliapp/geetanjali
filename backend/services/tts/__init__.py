"""TTS generation, behind a provider seam.

Callers use `get_provider()` and the TTSError hierarchy; they never import a concrete provider.
"""

from config import settings
from services.tts.edge import EdgeTTSProvider
from services.tts.provider import (
    TTSEmptyResultError,
    TTSError,
    TTSProvider,
    TTSTimeoutError,
)
from services.tts.store import (
    AUDIO_SUFFIX,
    InvalidStoreKey,
    TTSAudioStore,
    store_key,
)

__all__ = [
    "AUDIO_SUFFIX",
    "EdgeTTSProvider",
    "InvalidStoreKey",
    "TTSAudioStore",
    "TTSEmptyResultError",
    "TTSError",
    "TTSProvider",
    "TTSTimeoutError",
    "get_provider",
    "get_store",
    "store_key",
]

_provider: TTSProvider | None = None
_store: TTSAudioStore | None = None


def get_store() -> TTSAudioStore:
    """Return the configured audio store."""
    global _store
    if _store is None:
        _store = TTSAudioStore(
            root=settings.TTS_AUDIO_PATH,
            max_bytes=settings.TTS_AUDIO_MAX_BYTES,
        )
    return _store


def get_provider() -> TTSProvider:
    """Return the configured TTS provider.

    Single implementation today. When a second one lands this reads a config value; the point of
    the indirection is that no caller changes when it does.
    """
    global _provider
    if _provider is None:
        _provider = EdgeTTSProvider()
    return _provider
