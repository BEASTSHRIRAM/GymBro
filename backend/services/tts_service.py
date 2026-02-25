"""
GymBro — Deepgram TTS Service
Converts coaching text to audio bytes using Deepgram's TTS API.
"""
import httpx
from config import get_settings

settings = get_settings()

DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"


async def text_to_speech(text: str, voice: str = "aura-asteria-en") -> bytes:
    """
    Convert text to speech using Deepgram TTS REST API.

    Args:
        text: Coaching feedback text
        voice: Deepgram voice model (default: aura-asteria-en — female, clear)

    Returns:
        Raw MP3 audio bytes to stream to the client
    """
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "application/json",
    }
    params = {
        "model": voice,
        "encoding": "mp3",
    }
    payload = {"text": text}

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            DEEPGRAM_TTS_URL,
            headers=headers,
            params=params,
            json=payload,
        )
        response.raise_for_status()
        return response.content


async def get_coaching_audio(feedback: str) -> bytes:
    """Wrapper: generate coaching audio with fallback."""
    if not settings.deepgram_api_key:
        return b""  # graceful fallback — no audio
    try:
        return await text_to_speech(feedback)
    except Exception as e:
        print(f"[TTS] Deepgram error: {e}")
        return b""
