"""Tests for the content-addressed TTS audio store.

Two properties carry real risk and are pinned hardest: a key derived from caller-influenced data
must never escape the store directory, and an unbounded corpus (consultation guidance) must not be
able to fill the disk.
"""

import os

import pytest

from services.tts.store import (
    AUDIO_SUFFIX,
    InvalidStoreKey,
    TTSAudioStore,
    store_key,
)

KEY_A = "a" * 64
KEY_B = "b" * 64


@pytest.fixture
def store(tmp_path):
    s = TTSAudioStore(root=tmp_path / "tts-audio", max_bytes=1000)
    s.ensure_root()
    return s


@pytest.mark.unit
class TestKeyValidation:
    """A hash in a filename is a traversal sink the moment anything upstream changes."""

    @pytest.mark.parametrize(
        "bad_key",
        [
            "../../etc/passwd",
            "..%2f..%2fetc%2fpasswd",
            "/etc/passwd",
            "a" * 64 + "/../x",
            "ABCDEF" * 10,  # uppercase is not our digest format
            "not-hex-at-all",
            "",
            "a" * 200,  # beyond the accepted digest length
            "a/b",
            ".",
            "..",
        ],
    )
    def test_rejects_anything_that_is_not_a_hex_digest(self, store, bad_key):
        with pytest.raises(InvalidStoreKey):
            store.path_for(bad_key)

    def test_accepts_a_hex_digest(self, store):
        assert store.path_for(KEY_A).name == f"{KEY_A}{AUDIO_SUFFIX}"

    def test_resolved_path_stays_inside_the_store(self, store):
        resolved = store.path_for(KEY_A).resolve()
        assert str(resolved).startswith(str(store.root.resolve()))

    def test_get_raises_rather_than_reporting_a_miss_for_a_bad_key(self, store):
        # A malformed key is a caller bug; collapsing it into "not found" hides it.
        with pytest.raises(InvalidStoreKey):
            store.get("../../etc/passwd")


@pytest.mark.unit
class TestRoundTrip:
    def test_put_then_get(self, store):
        store.put(KEY_A, b"audio-bytes")
        path = store.get(KEY_A)

        assert path is not None
        assert path.read_bytes() == b"audio-bytes"

    def test_get_returns_none_for_a_miss(self, store):
        assert store.get(KEY_B) is None

    def test_put_is_atomic(self, store):
        """No .tmp file should survive a completed write."""
        store.put(KEY_A, b"x" * 100)
        leftovers = list(store.root.glob("*.tmp"))
        assert leftovers == []

    def test_put_overwrites_cleanly(self, store):
        store.put(KEY_A, b"first")
        store.put(KEY_A, b"second-longer")
        assert store.get(KEY_A).read_bytes() == b"second-longer"


@pytest.mark.unit
class TestEviction:
    """Verse narration is bounded; consultation guidance is not."""

    def test_stays_under_the_cap(self, store):
        for i in range(20):
            store.put(f"{i:064x}", b"z" * 100)  # 2000 bytes attempted, cap is 1000

        assert store.total_bytes() <= store.max_bytes

    def test_evicts_least_recently_accessed_first(self, tmp_path):
        s = TTSAudioStore(root=tmp_path / "audio", max_bytes=250)
        s.ensure_root()

        old, mid, new = f"{1:064x}", f"{2:064x}", f"{3:064x}"
        for key, atime in ((old, 1_000), (mid, 2_000), (new, 3_000)):
            path = s.put(key, b"y" * 100)
            os.utime(path, (atime, atime))

        s.evict_to_fit()

        assert s.get(new) is not None, "most recent should survive"
        assert s.path_for(old).is_file() is False, "least recent should be evicted"

    def test_reading_an_entry_protects_it_from_the_next_eviction(self, tmp_path):
        s = TTSAudioStore(root=tmp_path / "audio", max_bytes=250)
        s.ensure_root()

        first, second, third = f"{1:064x}", f"{2:064x}", f"{3:064x}"
        for key, atime in ((first, 1_000), (second, 2_000)):
            path = s.put(key, b"y" * 100)
            os.utime(path, (atime, atime))

        # Touch the oldest so it is no longer the eviction candidate.
        s.get(first)
        s.put(third, b"y" * 100)

        assert s.get(first) is not None
        assert s.path_for(second).is_file() is False

    def test_no_eviction_when_under_the_cap(self, store):
        store.put(KEY_A, b"small")
        assert store.evict_to_fit() == 0
        assert store.get(KEY_A) is not None


@pytest.mark.unit
class TestStoreKey:
    """The key is the whole caching contract: same text in, same clip out."""

    def test_is_deterministic(self):
        a = store_key("Hello", "en", "-5%", "+0Hz")
        b = store_key("Hello", "en", "-5%", "+0Hz")
        assert a == b

    def test_is_filename_safe(self):
        # The Redis key embeds rate verbatim ("-5%"), which a path cannot carry.
        key = store_key("Hello", "en", "-5%", "+0Hz")
        assert key.isalnum() and key.islower()

    @pytest.mark.parametrize(
        "args",
        [
            ("Different text", "en", "-5%", "+0Hz"),
            ("Hello", "hi", "-5%", "+0Hz"),
            ("Hello", "en", "+10%", "+0Hz"),
            ("Hello", "en", "-5%", "+5Hz"),
        ],
    )
    def test_every_input_participates(self, args):
        assert store_key(*args) != store_key("Hello", "en", "-5%", "+0Hz")

    def test_field_boundaries_are_unambiguous(self):
        # Without a separator these two would collide.
        assert store_key("a", "en", "-5%", "+0Hz") != store_key(
            "", "aen", "-5%", "+0Hz"
        )
