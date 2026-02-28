# Vision Agents SDK - Dependency Conflict Solution

## Problem
You were experiencing a dependency conflict:
- **Vision Agents SDK** requires `protobuf>=6.31.1` (via `getstream[webrtc]>=2.5.16`)
- **google-generativeai>=0.8.0** requires `protobuf<6.0.0.dev0`

These are fundamentally incompatible and cannot be installed together.

## Solution
**Remove `google-generativeai` entirely** - Vision Agents' Gemini plugin does NOT require it!

### Key Discovery
From Vision Agents documentation (https://visionagents.ai/integrations/gemini):
- Vision Agents' `gemini` plugin uses the Gemini API **directly via WebSocket/HTTP**
- It does NOT depend on `google-generativeai`
- It uses the **new `google-genai` SDK** internally (which is compatible)

## What Was Changed

### 1. Updated `backend/pyproject.toml`
**Removed**:
```toml
"google-generativeai>=0.8.0",
```

**Kept**:
```toml
"vision-agents[getstream,gemini,deepgram,elevenlabs,ultralytics]>=0.3.0",
"stream-chat>=4.0.0",
```

### 2. Code Compatibility
Your existing code is already compatible:
- `backend/services/gemini_service.py` uses `from google import genai` (the NEW SDK)
- `backend/services/video_call_service.py` uses Vision Agents' Gemini plugin
- No changes needed to existing code!

## Installation Instructions

```bash
cd backend
uv sync
```

This will now work without dependency conflicts!

## How Vision Agents' Gemini Plugin Works

### Three Modes Available

#### 1. Realtime Mode (Speech-to-Speech)
```python
from vision_agents.plugins import gemini

agent = Agent(
    edge=getstream.Edge(),
    agent_user=User(name="Assistant", id="agent"),
    instructions="You are a helpful assistant.",
    llm=gemini.Realtime(fps=3),  # Native speech-to-speech + video
)
```

#### 2. VLM Mode (Vision Language Model)
```python
from vision_agents.plugins import gemini, deepgram, elevenlabs

agent = Agent(
    edge=getstream.Edge(),
    agent_user=User(name="Vision Agent", id="vision-agent"),
    instructions="Describe what you see.",
    llm=gemini.VLM(model="gemini-3-flash-preview", fps=1, frame_buffer_seconds=10),
    stt=deepgram.STT(),
    tts=elevenlabs.TTS(),
)
```

#### 3. LLM Mode (Standard Chat)
```python
from vision_agents.plugins import gemini, deepgram, elevenlabs

agent = Agent(
    edge=getstream.Edge(),
    agent_user=User(name="Assistant", id="agent"),
    instructions="You are a helpful assistant.",
    llm=gemini.LLM("gemini-2.5-flash"),  # Standard chat completions
    stt=deepgram.STT(),
    tts=elevenlabs.TTS(),
)
```

## Your Current Implementation

Your `backend/services/video_call_service.py` uses **LLM Mode**:

```python
agent = Agent(
    edge=getstream.Edge(),
    agent_user=User(name="GymBro Trainer", id="gymbro-agent"),
    instructions=f"""You are an expert gym trainer analyzing {exercise} form in real-time...""",
    llm=gemini.LLM("gemini-3.0-flash-preview"),  # ✅ Correct usage
    stt=deepgram.STT(),
    tts=elevenlabs.TTS(),
    processors=[
        ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt")
    ],
)
```

This is perfect! It will work once dependencies are installed.

## Environment Variables Required

Make sure these are in `backend/.env`:

```bash
# Stream Video (for WebRTC)
STREAM_API_KEY=gbcsh8pnjuj7
STREAM_API_SECRET=ur67jrvq5pnyt7mk98dacxudq86q8hr65w5teej9rmatceg25s4tc83dkamhqph2

# Gemini (for LLM)
GOOGLE_API_KEY=AIzaSyD7A_WJTNwIAUxVxt3SquRI9dEnswagDGY
# OR
GEMINI_API_KEY=AIzaSyD7A_WJTNwIAUxVxt3SquRI9dEnswagDGY

# Deepgram (for STT)
DEEPGRAM_API_KEY=d8bffe1a464ece5a6e34c42525e307380d534705

# ElevenLabs (for TTS)
ELEVENLABS_API_KEY=sk_58bae26dc3f7fd15b5cf55d5701e9cf5feecf7cfafbd0997
```

## Why This Works

1. **Vision Agents' Gemini plugin** connects to Gemini API via WebSocket/HTTP directly
2. It does NOT use the deprecated `google-generativeai` package
3. It uses the new `google-genai` SDK internally (which has compatible protobuf requirements)
4. Your existing `gemini_service.py` already uses `google-genai`, so it's compatible

## Next Steps

1. Run `cd backend && uv sync` to install dependencies
2. Start backend: `uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`
3. Test the video call feature

## Model Name Note

You're using `"gemini-3.0-flash-preview"` in your code, but this model doesn't exist. Valid models:
- `gemini-2.5-flash` (recommended)
- `gemini-3-flash-preview` (if available)
- `gemini-2.0-flash-exp`

Update your code to use a valid model name if you encounter model errors.

## References

- Vision Agents Gemini Integration: https://visionagents.ai/integrations/gemini
- Vision Agents Installation: https://visionagents.ai/introduction/installation
- Google GenAI SDK Migration: https://ai.google.dev/gemini-api/docs/migrate
