"""
GymBro — ElevenLabs TTS Service
Converts coaching text to audio bytes using ElevenLabs' TTS API.
"""
import httpx
from config import get_settings

settings = get_settings()

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"


async def text_to_speech(text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> bytes:
    """
    Convert text to speech using ElevenLabs TTS REST API.

    Args:
        text: Coaching feedback text
        voice_id: ElevenLabs voice ID (default: Rachel — clear, professional)

    Returns:
        Raw MP3 audio bytes to stream to the client
    """
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        }
    }

    url = f"{ELEVENLABS_TTS_URL}/{voice_id}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return response.content


async def get_coaching_audio(feedback: str) -> bytes:
    """Wrapper: generate coaching audio with fallback."""
    if not settings.elevenlabs_api_key:
        return b""  # graceful fallback — no audio
    try:
        return await text_to_speech(feedback)
    except Exception as e:
        print(f"[TTS] ElevenLabs error: {e}")
        return b""
