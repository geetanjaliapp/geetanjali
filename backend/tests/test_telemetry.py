"""Tests for client-side degradation telemetry.

The endpoint exists because the previous degradation signal (umami.track) was blocked by the same
CSP header that caused the degradation. These tests pin the two properties that make the replacement
worth having: it cannot be used to blow up label cardinality, and it never fails the caller.
"""

import pytest
from prometheus_client import REGISTRY

from api.telemetry import DEGRADATION_PATHS, OTHER_PATH

ENDPOINT = "/api/v1/telemetry/degraded"


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test.

    The endpoint is capped at 30/minute per IP and every test here shares one client address, so
    without this the suite's pass/fail depends on test ordering.
    """
    from api.dependencies import limiter

    if hasattr(limiter, "_storage") and limiter._storage:
        limiter._storage.reset()
    yield


def _counter_value(path: str) -> float:
    """Read the current value of client_degradation_total for a label."""
    value = REGISTRY.get_sample_value(
        "geetanjali_client_degradation_total", {"path": path}
    )
    return value or 0.0


@pytest.mark.unit
class TestDegradationReporting:
    """Recording behaviour."""

    def test_known_path_increments_its_counter(self, client):
        before = _counter_value("tts_fallback")

        response = client.post(ENDPOINT, json={"path": "tts_fallback"})

        assert response.status_code == 204
        assert _counter_value("tts_fallback") == before + 1

    def test_detail_is_accepted_but_never_becomes_a_label(self, client):
        before = _counter_value("tts_fallback")

        response = client.post(
            ENDPOINT,
            json={"path": "tts_fallback", "detail": "Audio playback failed"},
        )

        assert response.status_code == 204
        assert _counter_value("tts_fallback") == before + 1
        # The detail string must not appear as its own series.
        assert (
            REGISTRY.get_sample_value(
                "geetanjali_client_degradation_total",
                {"path": "Audio playback failed"},
            )
            is None
        )

    def test_every_declared_path_is_accepted(self, client):
        for path in DEGRADATION_PATHS:
            response = client.post(ENDPOINT, json={"path": path})
            assert response.status_code == 204, f"{path} was rejected"

    def test_detail_is_optional(self, client):
        assert (
            client.post(ENDPOINT, json={"path": "offline_fallback"}).status_code == 204
        )


@pytest.mark.unit
class TestCardinalityGuard:
    """An unauthenticated write endpoint must not let clients mint Prometheus label values."""

    def test_unknown_path_is_bucketed_not_recorded_verbatim(self, client):
        before = _counter_value(OTHER_PATH)

        response = client.post(ENDPOINT, json={"path": "totally_made_up_path"})

        assert response.status_code == 204
        assert _counter_value(OTHER_PATH) == before + 1
        assert (
            REGISTRY.get_sample_value(
                "geetanjali_client_degradation_total", {"path": "totally_made_up_path"}
            )
            is None
        )

    def test_many_distinct_unknown_paths_create_one_series(self, client):
        before = _counter_value(OTHER_PATH)

        for i in range(25):
            client.post(ENDPOINT, json={"path": f"attacker_path_{i}"})

        assert _counter_value(OTHER_PATH) == before + 25

    def test_oversized_path_is_rejected_before_reaching_the_metric(self, client):
        response = client.post(ENDPOINT, json={"path": "x" * 5000})
        assert response.status_code == 422

    def test_oversized_detail_is_rejected(self, client):
        response = client.post(
            ENDPOINT, json={"path": "tts_fallback", "detail": "y" * 5000}
        )
        assert response.status_code == 422

    def test_traffic_is_rate_limited_per_ip(self, client):
        """No auth means the only backstop against flooding is the per-IP limit."""
        codes = [
            client.post(ENDPOINT, json={"path": "tts_fallback"}).status_code
            for _ in range(35)
        ]
        assert 429 in codes, "endpoint accepted unbounded requests from one client"


@pytest.mark.unit
class TestContract:
    """Shape the frontend depends on."""

    def test_empty_path_is_rejected(self, client):
        assert client.post(ENDPOINT, json={"path": ""}).status_code == 422

    def test_missing_path_is_rejected(self, client):
        assert client.post(ENDPOINT, json={}).status_code == 422

    def test_response_has_no_body(self, client):
        response = client.post(ENDPOINT, json={"path": "tts_fallback"})
        assert response.status_code == 204
        assert response.content == b""

    def test_requires_no_authentication(self, client):
        # Anonymous visitors hit degraded paths too, and are least likely to report by hand.
        response = client.post(ENDPOINT, json={"path": "tts_unavailable"})
        assert response.status_code == 204
