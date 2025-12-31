"""Text-to-Speech API using Microsoft Edge TTS.

Provides on-the-fly TTS for any text content. Falls back gracefully
if the service is unavailable (frontend uses Web Speech API fallback).

Supported voices:
- en-IN-NeerjaNeural (Indian English female) - default for English
- hi-IN-SwaraNeural (Hindi female) - for Hindi content
"""

import logging
import re
import time
from io import BytesIO
from typing import Literal

import edge_tts
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.dependencies import limiter
from services.cache import tts_cache_get, tts_cache_key, tts_cache_set
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

    # Verse references: BG_2_47, BG 2.47, (BG 6.26) → "Bhagavad Geeta, chapter 2, verse 47"
    # Handles: underscore, space, period separators; optional parentheses
    text = re.sub(
        r"\(?BG[_\s.]?(\d+)[_\s.](\d+)\)?",
        r"Bhagavad Geeta, chapter \1, verse \2",
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


@router.post("")
@limiter.limit("30/minute")
async def generate_speech(request: Request, body: TTSRequest):
    """
    Generate speech audio from text using Microsoft Edge TTS.

    Returns MP3 audio stream. Use lang='en' for English content,
    lang='hi' for Hindi content.

    Rate limits: 30 requests/minute per IP.
    Responses are cached in Redis for 24 hours.

    Args:
        body: TTS request with text and optional voice settings

    Returns:
        StreamingResponse with audio/mpeg content

    Raises:
        HTTPException: If TTS generation fails
    """
    voice = VOICES.get(body.lang, VOICES["en"])

    # Clean markdown formatting from text
    clean_text = clean_text_for_speech(body.text)

    # Check Redis cache first
    cache_key = tts_cache_key(clean_text, body.lang, body.rate, body.pitch)
    cached_audio = tts_cache_get(cache_key)

    if cached_audio:
        tts_requests_total.labels(lang=body.lang, result="cache_hit").inc()
        return StreamingResponse(
            BytesIO(cached_audio),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=3600",
                "X-Cache": "HIT",
            },
        )

    # Cache miss - generate audio from Edge TTS
    start_time = time.time()

    try:
        # Create TTS communicator
        communicate = edge_tts.Communicate(
            text=clean_text,
            voice=voice,
            rate=body.rate,
            pitch=body.pitch,
        )

        # Collect all audio bytes for caching
        audio_chunks: list[bytes] = []
        first_chunk = True

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                if first_chunk:
                    duration = time.time() - start_time
                    tts_request_duration_seconds.labels(lang=body.lang).observe(
                        duration
                    )
                    first_chunk = False
                audio_chunks.append(chunk["data"])

        # Combine chunks and cache
        audio_bytes = b"".join(audio_chunks)
        tts_cache_set(cache_key, audio_bytes)

        tts_requests_total.labels(lang=body.lang, result="success").inc()

        return StreamingResponse(
            BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=3600",
                "X-Cache": "MISS",
            },
        )

    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        tts_requests_total.labels(lang=body.lang, result="error").inc()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Text-to-speech service temporarily unavailable",
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
