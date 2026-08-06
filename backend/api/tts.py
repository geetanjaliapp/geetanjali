"""Text-to-Speech API using Microsoft Edge TTS.

Provides on-the-fly TTS for any text content. Falls back gracefully
if the service is unavailable (frontend uses Web Speech API fallback).

Supported voices:
- en-IN-NeerjaNeural (Indian English female) - default for English
- hi-IN-SwaraNeural (Hindi female) - for Hindi content
"""

import asyncio
import logging
import re
import time
from io import BytesIO
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from api.dependencies import limiter
from services.tts import (
    AUDIO_SUFFIX,
    InvalidStoreKey,
    TTSEmptyResultError,
    TTSTimeoutError,
    get_provider,
    get_store,
    store_key,
)
from utils.metrics_events import tts_request_duration_seconds, tts_requests_total

logger = logging.getLogger(__name__)


def clean_text_for_speech(text: str) -> str:
    """
    Clean text for natural speech synthesis.

    Removes markdown formatting that TTS would read literally
    (e.g., "asterisk asterisk self-knowledge asterisk asterisk").

    Handles:
    - Bold, italic, strikethrough
    - Code (inline and fenced blocks)
    - Links, images
    - Headers, lists, blockquotes
    - Horizontal rules
    - HTML tags
    - Verse references (BG_2_47 format)

    Args:
        text: Raw text potentially containing markdown

    Returns:
        Cleaned text suitable for speech synthesis
    """
    # Fenced code blocks: ```code``` or ~~~code~~~
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"~~~[\s\S]*?~~~", "", text)

    # Bold: **text** or __text__
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)

    # Italic: *text* or _text_ (single, not inside words)
    text = re.sub(r"(?<!\w)\*([^*]+?)\*(?!\w)", r"\1", text)
    text = re.sub(r"(?<!\w)_([^_]+?)_(?!\w)", r"\1", text)

    # Strikethrough: ~~text~~
    text = re.sub(r"~~(.+?)~~", r"\1", text)

    # Inline code: `code`
    text = re.sub(r"`([^`]+?)`", r"\1", text)

    # Images: ![alt](url) → remove entirely (can't speak images)
    text = re.sub(r"!\[[^\]]*?\]\([^)]+?\)", "", text)

    # Links: [text](url) → just text
    text = re.sub(r"\[([^\]]+?)\]\([^)]+?\)", r"\1", text)

    # Reference-style links: [text][ref] → just text
    text = re.sub(r"\[([^\]]+?)\]\[[^\]]*?\]", r"\1", text)

    # Headers: # Header → Header
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)

    # Blockquotes: > text → text
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)

    # Horizontal rules: --- or *** or ___
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)

    # Bullet points: - item or * item or + item → item
    text = re.sub(r"^[\-\*\+]\s+", "", text, flags=re.MULTILINE)

    # Numbered lists: 1. item → item
    text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)

    # HTML tags: <tag> or </tag> or <tag attr="val">
    text = re.sub(r"<[^>]+>", "", text)

    # Verse references: BG_2_47, BG 2.47, (BG 6.26) → "Bhagavad Gita, chapter 2, verse 47"
    # Handles: underscore, space, period separators; optional parentheses
    text = re.sub(
        r"\(?BG[_\s.]?(\d+)[_\s.](\d+)\)?",
        r"Bhagavad Gita, chapter \1, verse \2",
        text,
    )

    # Multiple spaces/newlines → single space
    text = re.sub(r"\s+", " ", text)

    return text.strip()


router = APIRouter(prefix="/api/v1/tts")

# Supported voices - curated for Geetanjali context
VOICES = {
    "en": "en-IN-NeerjaNeural",  # Indian English female
    "hi": "hi-IN-SwaraNeural",  # Hindi female
}

# Rate and pitch adjustments for contemplative reading
DEFAULT_RATE = "-5%"  # Slightly slower for clarity
DEFAULT_PITCH = "+0Hz"  # Natural pitch

# Generation timeout lives with the provider (services/tts/edge.py) -- it is a property of the
# transport, not of this endpoint.


class TTSRequest(BaseModel):
    """Request body for TTS generation."""

    text: str = Field(..., min_length=1, max_length=5000, description="Text to speak")
    lang: Literal["en", "hi"] = Field(default="en", description="Language code")
    rate: str = Field(
        default=DEFAULT_RATE,
        pattern=r"^[+-]?\d{1,3}%$",
        description="Speech rate (e.g., '-10%', '+20%')",
    )
    pitch: str = Field(
        default=DEFAULT_PITCH,
        pattern=r"^[+-]?\d{1,3}Hz$",
        description="Voice pitch (e.g., '+5Hz', '-10Hz')",
    )


def _audio_url(key: str) -> str:
    """Same-origin URL for a stored clip."""
    return f"/api/v1/tts/audio/{key}{AUDIO_SUFFIX}"


@router.post("")
@limiter.limit("30/minute")
async def generate_speech(request: Request, body: TTSRequest):
    """
    Generate speech audio from text.

    Two response shapes, chosen by the Accept header:

    - `application/json` -> `{"url": "/api/v1/tts/<key>.mp3"}`. Preferred: the client plays a
      same-origin URL, so no `blob:` is involved (which is what CSP blocked), and the browser,
      the service worker and Range requests all work on it for free.
    - anything else -> the MP3 bytes, as before. Kept so a client running cached JS from before
      this change keeps working across the deploy.

    Audio is stored content-addressed on disk. The key is a hash of the text and voice settings,
    so a given clip is generated once and then reused indefinitely rather than regenerated.

    Rate limits: 30 requests/minute per IP.

    Args:
        body: TTS request with text and optional voice settings

    Returns:
        JSON `{"url": ...}` or a StreamingResponse of audio/mpeg.

    Raises:
        HTTPException: If TTS generation fails
    """
    voice = VOICES.get(body.lang, VOICES["en"])

    # Clean markdown formatting from text
    clean_text = clean_text_for_speech(body.text)

    wants_url = "application/json" in (request.headers.get("accept") or "")
    store = get_store()
    key = store_key(clean_text, body.lang, body.rate, body.pitch)

    existing = store.get(key)
    if existing is not None:
        tts_requests_total.labels(lang=body.lang, result="cache_hit").inc()
        if wants_url:
            return {"url": _audio_url(key)}
        return FileResponse(
            existing,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline", "X-Cache": "HIT"},
        )

    # Miss - generate
    start_time = time.time()

    try:
        audio_bytes = await get_provider().synthesize(
            text=clean_text,
            voice=voice,
            rate=body.rate,
            pitch=body.pitch,
        )

        tts_request_duration_seconds.labels(lang=body.lang).observe(
            time.time() - start_time
        )

        store.put(key, audio_bytes)

        tts_requests_total.labels(lang=body.lang, result="success").inc()

        if wants_url:
            return {"url": _audio_url(key)}

        return StreamingResponse(
            BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=3600",
                "X-Cache": "MISS",
            },
        )

    except TTSTimeoutError as e:
        logger.error(f"TTS generation timed out: {e}")
        tts_requests_total.labels(lang=body.lang, result="timeout").inc()
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Text-to-speech service timed out",
        )

    except TTSEmptyResultError:
        logger.warning("TTS returned no audio data")
        tts_requests_total.labels(lang=body.lang, result="empty").inc()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Text-to-speech service returned no audio",
        )

    except asyncio.CancelledError:
        # Client disconnected or request was cancelled - return 499 (nginx convention)
        logger.info("TTS request cancelled (client disconnected)")
        tts_requests_total.labels(lang=body.lang, result="cancelled").inc()
        raise HTTPException(
            status_code=499,
            detail="Request cancelled",
        )

    except HTTPException:
        # Re-raise HTTP exceptions (don't wrap them)
        raise

    except Exception as e:
        # Includes TTSError; provider-specific failures are already normalised by the seam.
        logger.error(f"TTS generation failed: {e}")
        tts_requests_total.labels(lang=body.lang, result="error").inc()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Text-to-speech service temporarily unavailable",
        )


@router.get("/audio/{filename}")
@limiter.limit("120/minute")
async def get_audio(request: Request, filename: str):
    """
    Serve a previously generated clip.

    Declared under `/audio/` rather than as a bare `/{filename}` so it cannot shadow `/voices` --
    FastAPI matches routes in declaration order and a catch-all here would swallow every sibling.

    Same-origin and a real file, which is the point: `<audio src>` on this URL needs no `blob:`
    exception in the CSP, the service worker's `isAudioFile()` already matches `.mp3` so offline
    caching comes for free, and FileResponse answers Range requests, so seeking works.

    Rate limit is higher than generation because these are cheap and a single narration session
    fetches many of them.

    Args:
        filename: `<hex key>.mp3`

    Returns:
        FileResponse with audio/mpeg content.

    Raises:
        HTTPException: 404 if the key is malformed or not stored.
    """
    if not filename.endswith(AUDIO_SUFFIX):
        raise HTTPException(status_code=404, detail="Not found")

    key = filename[: -len(AUDIO_SUFFIX)]

    try:
        path = get_store().get(key)
    except InvalidStoreKey:
        # Malformed key is indistinguishable from a miss to the caller on purpose -- it tells a
        # prober nothing about what the store holds.
        raise HTTPException(status_code=404, detail="Not found")

    if path is None:
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(
        path,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            # Content-addressed: this URL's bytes can never change.
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


@router.get("/voices")
@limiter.limit("60/minute")
async def get_voices(request: Request):
    """
    Get available TTS voices.

    Returns the curated list of voices optimized for Geetanjali content.

    Returns:
        Dict of language codes to voice names
    """
    return {
        "voices": VOICES,
        "default": "en",
        "note": "Use 'en' for English, 'hi' for Hindi content",
    }
