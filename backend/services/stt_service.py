"""
GymBro — Deepgram STT Service
Converts audio to text using Deepgram's Speech-to-Text API.
"""
import httpx
from config import get_settings

settings = get_settings()

DEEPGRAM_STT_URL = "https://api.deepgram.com/v1/listen"


async def speech_to_text(audio_bytes: bytes, language: str = "en") -> str:
    """
    Convert audio to text using Deepgram STT REST API.

    Args:
        audio_bytes: Raw audio bytes (WAV, MP3, etc.)
        language: Language code (default: en for English)

    Returns:
        Transcribed text from audio
    """
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
    }
    params = {
        "model": "nova-2",
        "language": language,
        "punctuate": "true",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            DEEPGRAM_STT_URL,
            headers=headers,
            params=params,
            content=audio_bytes,
        )
        response.raise_for_status()
        result = response.json()
        
        # Extract transcript from Deepgram response
        try:
            transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
            return transcript.strip()
        except (KeyError, IndexError):
            return ""


async def get_user_input_text(audio_bytes: bytes) -> str:
    """Wrapper: transcribe user audio with fallback."""
    if not settings.deepgram_api_key:
        return ""  # graceful fallback — no transcription
    try:
        return await speech_to_text(audio_bytes)
    except Exception as e:
        print(f"[STT] Deepgram error: {e}")
        return ""
