"""
GymBro — ElevenLabs TTS Service
Converts coaching text to audio bytes using ElevenLabs' TTS API.
Uses eleven_flash_v2_5 for ultra-low latency (~75ms) real-time coaching.
"""
import httpx
from config import get_settings

settings = get_settings()

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"

# Model: eleven_flash_v2_5 — ultra-fast (~75ms), 32 languages, ideal for real-time
# Alternatives if needed:
#   eleven_turbo_v2_5   — higher quality, ~250-300ms latency
#   eleven_multilingual_v2 — best quality, higher latency, 29 languages
#   eleven_flash_v2     — English-only, fastest
TTS_MODEL = "eleven_flash_v2_5"

# Voice: Rachel — clear, professional coaching voice
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


async def text_to_speech(text: str, voice_id: str = DEFAULT_VOICE_ID) -> bytes:
    """
    Convert text to speech using ElevenLabs TTS REST API.

    Args:
        text: Coaching feedback text
        voice_id: ElevenLabs voice ID

    Returns:
        Raw MP3 audio bytes to stream to the client
    """
    if not settings.elevenlabs_api_key:
        print("[TTS] ERROR: ELEVENLABS_API_KEY not set in .env")
        return b""
    
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": TTS_MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        }
    }

    url = f"{ELEVENLABS_TTS_URL}/{voice_id}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            audio_bytes = response.content
            print(f"[TTS] ✓ Generated {len(audio_bytes)} bytes ({TTS_MODEL})")
            return audio_bytes
    except httpx.HTTPStatusError as e:
        print(f"[TTS] ✗ HTTP {e.response.status_code}: {e.response.text}")
        return b""
    except Exception as e:
        print(f"[TTS] ✗ {type(e).__name__}: {e}")
        return b""


async def get_coaching_audio(feedback: str) -> bytes:
    """Wrapper: generate coaching audio with fallback."""
    if not settings.elevenlabs_api_key:
        return b""  # graceful fallback — no audio
    try:
        return await text_to_speech(feedback)
    except Exception as e:
        print(f"[TTS] Wrapper error: {e}")
        return b""

