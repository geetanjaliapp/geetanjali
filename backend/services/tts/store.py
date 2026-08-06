"""Content-addressed store for generated TTS audio.

Why this exists at all: `services/cache.py` keys TTS audio on `sha256(cleaned_text)`, so the same
text always yields byte-identical audio -- but it stored that under a 24h Redis TTL. A content hash
cannot go stale, so every narration was being regenerated daily, forever, and
`useStudyAutoMode.ts:123,133` build narration from pure functions of verse data, meaning that text is
identical across every user. The corpus was being paid for once per user per day instead of once.

This replaces the Redis audio cache rather than sitting behind it. Holding megabytes of MP3 in
Redis was costing memory on a 1.9GB box to answer from RAM what the page cache already answers from
disk. Audio now lives on disk and is served same-origin, so it needs no `blob:` URL -- which is what
CSP blocked in the first place.

Eviction is least-recently-used by access time. Verse narration is a bounded corpus, but consultation
guidance is unbounded: without a cap, every unique case would persist forever and eventually fill the
disk.
"""

import hashlib
import logging
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


def store_key(text: str, lang: str, rate: str, pitch: str) -> str:
    """Content key for generated audio.

    Same inputs as `tts_cache_key`, but hashed whole so the result is filename-safe --
    the Redis key embeds `rate` verbatim ("-5%"), which a path cannot carry.
    """
    payload = f"{lang}|{rate}|{pitch}|{text}"
    return hashlib.sha256(payload.encode()).hexdigest()


# Store keys are hex digests. Anything else is rejected before it can reach a filesystem path --
# the key is derived server-side today, but a filename built from caller-influenced data is a
# traversal sink the moment that stops being true.
_HEX_KEY = re.compile(r"^[0-9a-f]{16,128}$")

AUDIO_SUFFIX = ".mp3"


class InvalidStoreKey(ValueError):
    """Key was not a plain hex digest."""


@dataclass(frozen=True)
class StoredAudio:
    """A file in the store."""

    key: str
    path: Path
    size: int


class TTSAudioStore:
    """Filesystem store for generated audio, capped by total size."""

    def __init__(self, root: Path | str, max_bytes: int) -> None:
        self.root = Path(root)
        self.max_bytes = max_bytes

    def ensure_root(self) -> None:
        """Create the store directory. Safe to call repeatedly."""
        self.root.mkdir(parents=True, exist_ok=True)

    def path_for(self, key: str) -> Path:
        """Resolve a key to its path.

        Raises:
            InvalidStoreKey: key is not a bare hex digest.
        """
        if not _HEX_KEY.match(key):
            raise InvalidStoreKey(f"not a hex digest: {key[:32]!r}")
        return self.root / f"{key}{AUDIO_SUFFIX}"

    def get(self, key: str) -> Path | None:
        """Return the path if present, marking it as recently used.

        Returns None for a miss. Raises InvalidStoreKey for a malformed key, because that is a
        caller bug rather than a cache miss and should not be silently indistinguishable from one.
        """
        path = self.path_for(key)
        if not path.is_file():
            return None
        self._touch(path)
        return path

    def put(self, key: str, audio: bytes) -> Path:
        """Write audio for `key` and enforce the size cap.

        The write is atomic: a partially written file would otherwise be served as valid audio on
        the next request, and being content-addressed it would never be corrected.
        """
        path = self.path_for(key)
        self.ensure_root()

        tmp = path.with_suffix(f"{AUDIO_SUFFIX}.tmp")
        tmp.write_bytes(audio)
        tmp.replace(path)

        self.evict_to_fit()
        return path

    def entries(self) -> list[StoredAudio]:
        """All stored files, oldest access first."""
        if not self.root.is_dir():
            return []

        found: list[tuple[float, StoredAudio]] = []
        for path in self.root.glob(f"*{AUDIO_SUFFIX}"):
            try:
                stat = path.stat()
            except OSError:  # pragma: no cover - file vanished mid-scan
                continue
            found.append((stat.st_atime, StoredAudio(path.stem, path, stat.st_size)))

        found.sort(key=lambda pair: pair[0])
        return [entry for _, entry in found]

    def total_bytes(self) -> int:
        return sum(entry.size for entry in self.entries())

    def evict_to_fit(self) -> int:
        """Delete least-recently-accessed files until the store fits under the cap.

        Returns:
            Number of files removed.
        """
        entries = self.entries()
        total = sum(entry.size for entry in entries)
        if total <= self.max_bytes:
            return 0

        removed = 0
        for entry in entries:  # oldest access first
            if total <= self.max_bytes:
                break
            try:
                entry.path.unlink()
            except OSError as exc:  # pragma: no cover - concurrent delete
                logger.warning("TTS store eviction failed for %s: %s", entry.key, exc)
                continue
            total -= entry.size
            removed += 1

        if removed:
            logger.info(
                "TTS store evicted %d file(s), now %d bytes of %d",
                removed,
                total,
                self.max_bytes,
            )
        return removed

    def clear(self) -> None:
        """Remove the whole store. Test and maintenance helper."""
        if self.root.is_dir():
            shutil.rmtree(self.root)

    @staticmethod
    def _touch(path: Path) -> None:
        """Mark a file as recently used so eviction sees it as live."""
        try:
            path.touch()
        except OSError as exc:  # pragma: no cover - read-only fs
            logger.debug("Could not update access time for %s: %s", path, exc)
