"""Client-side degradation telemetry.

The app degrades gracefully in many places -- TTS falls back to the Web Speech API, the service
worker serves cached content, lazy chunks retry. Each of those keeps the app working, which is why
none of them produced any signal when the CSP in d8c34a5 broke six things at once for four months.

Reports land here rather than in third-party analytics on purpose: Umami was blocked by the same
header that caused the degradation it was supposed to report. A same-origin endpoint cannot be
disabled by a policy that leaves the app itself functioning.

Fire-and-forget: returns 204 and never fails the caller.
"""

import logging

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from api.dependencies import limiter
from utils.metrics_events import client_degradation_total

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/telemetry")

# Closed set. A browser running older or newer code than the server is normal, so unknown values
# are bucketed rather than rejected -- but they must never become Prometheus labels, or any client
# could exhaust server memory by reporting unique paths.
DEGRADATION_PATHS = frozenset(
    {
        "tts_fallback",  # Edge TTS failed, Web Speech API used instead
        "tts_unavailable",  # both TTS paths failed, no audio at all
        "audio_preload_failed",  # service worker could not preload a recitation
        "offline_fallback",  # service worker served the offline response
        "share_image_failed",  # ShareModal could not render its card
        "chunk_load_retry",  # lazyWithRetry recovered a failed chunk import
    }
)

OTHER_PATH = "other"


class DegradationReport(BaseModel):
    """A single degradation event observed in the browser."""

    path: str = Field(..., min_length=1, max_length=64)
    detail: str | None = Field(
        default=None,
        max_length=200,
        description="Free-form context for logs. Never used as a metric label.",
    )


@router.post("/degraded", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def report_degradation(request: Request, body: DegradationReport) -> Response:
    """Record a client-side degradation event.

    Unauthenticated by design: anonymous visitors hit these paths too, and they are precisely the
    users least likely to report a problem by hand.

    Returns:
        204 No Content. Callers should not wait on or branch over this response.
    """
    known = body.path in DEGRADATION_PATHS
    path = body.path if known else OTHER_PATH

    if not known:
        # Version skew between client and server. Worth fixing, so do not swallow it.
        logger.warning("Unknown client degradation path: %r", body.path)

    client_degradation_total.labels(path=path).inc()

    # Metric for alerting, log for diagnosis -- keeps `detail` out of label cardinality.
    #
    # `detail` is unauthenticated caller input, so it is logged with %r rather than %s: a raw
    # newline would otherwise forge a log entry, in the one place we go to diagnose incidents.
    logger.info(
        "Client degradation: path=%s detail=%r",
        path,
        body.detail or "-",
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
