# WebRTC Video Call Fixes

## Issues Fixed

### 1. Backend: Incorrect Stream SDK Usage
**Problem**: Trying to manually create calls using `getstream` REST API SDK instead of letting Vision Agents handle it.

**Error**:
```
cannot import name 'StreamVideo' from 'getstream'
cannot import name 'CallRequest' from 'getstream.models.call_request'
```

**Fix**: Updated `backend/services/video_call_service.py` to use Vision Agents' built-in `agent.create_call()` method, which handles Stream SDK integration internally.

```python
# OLD (incorrect)
from getstream import Stream
from getstream.models import CallRequest
stream_client = Stream(...)
call = stream_client.video.call(call_type, call_id)

# NEW (correct)
call = await agent.create_call(call_type, call_id)
async with agent.join(call):
    await agent.simple_response("Hey! I'm your AI gym trainer...")
    await agent.finish()
```

### 2. Frontend: Missing Stream Video SDK
**Problem**: Frontend had no way to actually join the WebRTC call - it was just triggering the backend.

**Fix**: 
- Added `@stream-io/video-react-native-sdk` to `frontend/package.json`
- Completely rewrote `VideoCallFormCheckerScreen.tsx` to:
  - Initialize `StreamVideoClient` with user token
  - Join the call using `client.call(call_type, call_id).join()`
  - Render video using `<CallContent call={call} />`
  - Properly cleanup on unmount

### 3. Backend: Missing Token Generation
**Problem**: Frontend needs a user token to authenticate with Stream Video SDK.

**Fix**: Updated `backend/routers/video_call.py` to:
- Add `stream-chat` dependency to `pyproject.toml`
- Generate user token using `StreamChat.create_token(user_id)`
- Return `user_token` in `StartCallResponse`

## What Was Changed

### Backend Files
1. `backend/services/video_call_service.py`
   - Removed manual Stream SDK imports
   - Simplified `_join_call()` to use `agent.create_call()`
   
2. `backend/routers/video_call.py`
   - Added token generation using `stream-chat`
   - Added `user_token` to response model

3. `backend/pyproject.toml`
   - Added `stream-chat>=4.0.0` dependency

### Frontend Files
1. `frontend/package.json`
   - Added `@stream-io/video-react-native-sdk: ^1.3.0`

2. `frontend/src/screens/VideoCallFormCheckerScreen.tsx`
   - Complete rewrite with Stream Video SDK integration
   - Added `StreamVideoClient` initialization
   - Added `CallContent` component for video rendering
   - Added proper call lifecycle management

## Next Steps

### 1. Install Dependencies

**Backend**:
```bash
cd backend
uv sync
```

**Frontend**:
```bash
cd frontend
npm install
```

### 2. Test the Implementation

1. Start backend:
```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. Start frontend:
```bash
cd frontend
npm start
```

3. In the app:
   - Navigate to "Video Call Trainer"
   - Select an exercise
   - Click "Start Video Call"
   - You should see:
     - Backend logs: `[VideoCall] Agent joining call...`
     - Frontend: Video call UI with your camera feed
     - AI trainer should join and speak: "Hey! I'm your AI gym trainer..."

### 3. Expected Behavior

**When call starts**:
- Backend creates Vision Agents agent with Gemini LLM, Deepgram STT, ElevenLabs TTS
- Backend joins the call in background
- Frontend receives `call_id` and `user_token`
- Frontend initializes Stream Video client
- Frontend joins the same call
- AI agent sends greeting via TTS (you should hear it!)

**During call**:
- Your video is streamed to the agent
- Agent analyzes your form using YOLO pose detection
- Agent provides voice coaching via ElevenLabs TTS
- You can speak to the agent (Deepgram STT)

**When call ends**:
- Frontend leaves call and disconnects client
- Backend receives end request
- Backend calculates stats (duration, reps, form score)
- Stats saved to MongoDB
- XP awarded to user

## Troubleshooting

### If you still see import errors:
```bash
cd backend
uv sync --reinstall
```

### If frontend can't connect:
- Check that `STREAM_API_KEY` in frontend matches backend `.env`
- Check that backend is running on `http://10.137.183.164:8000`
- Check network connectivity

### If agent doesn't speak:
- Verify `ELEVENLABS_API_KEY` in `backend/.env`
- Check backend logs for TTS errors
- Ensure audio permissions are granted on device

### If video doesn't work:
- Ensure camera permissions are granted
- Check that `expo-camera` is installed
- Verify Stream Video SDK is properly installed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  VideoCallFormCheckerScreen.tsx                        │ │
│  │  - StreamVideoClient (user auth)                       │ │
│  │  - Call.join() (WebRTC connection)                     │ │
│  │  - CallContent (video rendering)                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP + WebRTC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  video_call.py (REST API)                              │ │
│  │  - POST /video-call/start → Generate token            │ │
│  │  - POST /video-call/end/{call_id} → Save stats        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  video_call_service.py (Vision Agents)                 │ │
│  │  - Agent(edge=getstream.Edge(), llm=gemini.LLM(...))  │ │
│  │  - agent.create_call() → Stream SDK                    │ │
│  │  - agent.join(call) → WebRTC connection               │ │
│  │  - agent.simple_response() → TTS output               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebRTC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stream Global Edge Network                │
│  - Low-latency WebRTC transport                             │
│  - Audio/video routing                                       │
│  - Call management                                           │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Vision Agents Agent
- Orchestrates LLM, STT, TTS, and video processors
- Handles WebRTC connection via Stream Edge
- Provides event system for transcripts, responses, etc.

### Stream Video SDK
- **Backend**: Vision Agents uses it internally (no manual imports needed)
- **Frontend**: Must use `@stream-io/video-react-native-sdk` to join calls
- **Authentication**: User token generated by backend using `stream-chat`

### Call Flow
1. Frontend → Backend: `POST /video-call/start` with `user_id` and `exercise`
2. Backend: Generate token, create agent, join call in background
3. Backend → Frontend: Return `call_id` and `user_token`
4. Frontend: Initialize client with token, join call with `call_id`
5. Both connected to same call via Stream Edge Network
6. AI agent provides real-time voice coaching
7. Frontend → Backend: `POST /video-call/end/{call_id}`
8. Backend: Calculate stats, save to DB, return summary

## References

- Vision Agents Docs: https://visionagents.ai
- Stream Video React Native: https://getstream.io/video/docs/react-native/
- Stream Video Python: https://getstream.io/video/docs/python/
