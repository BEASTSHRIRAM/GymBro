# GymBro WebRTC Video Call Implementation

## Overview

This implementation uses **Vision Agents SDK** with **Stream's global edge network** for real-time WebRTC video calls between users and an AI gym trainer.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  React Native   │◄───────►│  FastAPI Backend │◄───────►│ Vision Agents   │
│   Frontend      │  REST   │   + WebRTC       │  SDK    │  + Stream Edge  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Gemini 3.0 Flash│
                            │  Deepgram STT    │
                            │  ElevenLabs TTS  │
                            │  YOLO Pose       │
                            └──────────────────┘
```

## How It Works

### 1. Backend Components

#### `backend/services/video_call_service.py`
- Creates Vision Agents `Agent` instances for each video call
- Configures agent with:
  - **Edge**: Stream's global edge network for low-latency WebRTC
  - **LLM**: Gemini 3.0 Flash for form analysis
  - **STT**: Deepgram for speech-to-text
  - **TTS**: ElevenLabs for text-to-speech voice coaching
  - **Processors**: YOLO pose detection for exercise form analysis
- Manages agent lifecycle (create, join call, end call)

#### `backend/routers/video_call.py`
- **POST /video-call/start**: Creates a new video call and starts the AI agent
- **POST /video-call/end/{call_id}**: Ends the call and returns workout summary
- **GET /video-call/status/{call_id}**: Gets current call status

### 2. Frontend Components

#### `frontend/src/screens/VideoCallFormCheckerScreen.tsx`
- Simple UI for starting/ending video calls
- Calls backend REST API to manage calls
- Displays call status and exercise selection

### 3. Call Flow

```
1. User selects exercise (squat, bench press, etc.)
2. User taps "Start Video Call"
3. Frontend calls POST /video-call/start
4. Backend creates Agent and joins Stream call
5. Agent sends greeting: "Hey! I'm your AI gym trainer..."
6. User's video/audio streams to agent via WebRTC
7. Agent analyzes form in real-time using YOLO + Gemini
8. Agent provides voice coaching via ElevenLabs TTS
9. User taps "End Call"
10. Frontend calls POST /video-call/end/{call_id}
11. Backend returns workout summary (reps, form score, duration)
12. Summary saved to MongoDB
```

## Key Features

### Real-Time Voice Coaching
- **STT (Deepgram)**: Converts user speech to text
- **LLM (Gemini)**: Analyzes form and generates coaching feedback
- **TTS (ElevenLabs)**: Converts feedback to natural voice audio
- All happens in real-time over WebRTC

### Form Analysis
- **YOLO Pose Detection**: Detects body keypoints (shoulders, hips, knees, ankles)
- **Gemini Vision**: Analyzes exercise form from video frames
- **Rep Counting**: Tracks completed reps automatically
- **Fault Detection**: Identifies form issues (knees caving, back rounding, etc.)

### Low Latency
- Stream's global edge network ensures <100ms latency
- WebRTC peer-to-peer connections when possible
- Automatic fallback to TURN servers

## Configuration

### Environment Variables (backend/.env)

```bash
# Stream Video (Vision Agents)
STREAM_API_KEY=gbcsh8pnjuj7
STREAM_API_SECRET=ur67jrvq5pnyt7mk98dacxudq86q8hr65w5teej9rmatceg25s4tc83dkamhqph2

# Gemini (LLM)
GEMINI_API_KEY=AIzaSyD7A_WJTNwIAUxVxt3SquRI9dEnswagDGY

# Deepgram (STT)
DEEPGRAM_API_KEY=d8bffe1a464ece5a6e34c42525e307380d534705

# ElevenLabs (TTS)
ELEVENLABS_API_KEY=sk_58bae26dc3f7fd15b5cf55d5701e9cf5feecf7cfafbd0997
```

### Dependencies

#### Backend (pyproject.toml)
```toml
dependencies = [
    "vision-agents[getstream,gemini,deepgram,elevenlabs,ultralytics]>=0.3.0",
    # ... other deps
]
```

#### Frontend (package.json)
```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",
    "axios": "^1.7.2",
    // ... other deps
  }
}
```

## Installation

### Backend

```bash
cd backend

# Install dependencies with uv
uv sync

# Run server
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Expo
npm start
```

## Usage

### Starting a Call

1. Open GymBro app
2. Navigate to "Video Call Trainer" from drawer menu
3. Select exercise (squat, bench press, deadlift, shoulder press)
4. Tap "Start Video Call"
5. Wait for agent to join (you'll see "LIVE CALL" status)
6. Start exercising - agent will provide real-time coaching

### During Call

- Agent watches your video feed via WebRTC
- YOLO detects your body pose
- Gemini analyzes your form
- Agent speaks coaching tips via ElevenLabs TTS
- Rep count updates automatically

### Ending Call

1. Tap "End Call"
2. View workout summary:
   - Duration
   - Total reps
   - Average form score
3. XP awarded automatically

## API Reference

### POST /video-call/start

**Request:**
```json
{
  "user_id": "699f1f916180f42586bf66cc",
  "exercise": "squat"
}
```

**Response:**
```json
{
  "call_id": "gymbro_699f1f916180f42586bf66cc_1772280237",
  "call_type": "default",
  "exercise": "squat",
  "status": "started"
}
```

### POST /video-call/end/{call_id}

**Response:**
```json
{
  "call_id": "gymbro_699f1f916180f42586bf66cc_1772280237",
  "exercise": "squat",
  "duration_seconds": 180,
  "total_reps": 15,
  "avg_form_score": 87.5
}
```

### GET /video-call/status/{call_id}

**Response:**
```json
{
  "status": "active",
  "call_id": "gymbro_699f1f916180f42586bf66cc_1772280237",
  "exercise": "squat",
  "duration_seconds": 45,
  "reps": 5
}
```

## Troubleshooting

### Agent not joining call
- Check Stream API keys in `.env`
- Verify `api_key` and `api_secret` env vars are set
- Check backend logs for Vision Agents errors

### No voice coaching
- Verify ElevenLabs API key
- Check Deepgram API key for STT
- Ensure `stt=` and `tts=` are passed to Agent (not using Realtime mode)

### Poor video quality
- Check network connection
- Stream automatically adjusts quality based on bandwidth
- Try moving closer to WiFi router

### YOLO model download fails
- Model downloads automatically on first use
- Check internet connection
- Verify `yolo11n-pose.pt` in backend directory

## Differences from WebSocket Approach

| Feature | WebSocket (Old) | WebRTC (New) |
|---------|----------------|--------------|
| **Transport** | Custom WebSocket | Stream Edge Network |
| **Latency** | ~300ms | <100ms |
| **Audio** | Base64 MP3 chunks | Native WebRTC audio |
| **Video** | JPEG frames @ 3fps | Full video stream |
| **Scalability** | Limited | Global edge network |
| **Setup** | Complex frame capture | Native camera access |

## Next Steps

1. **Add Stream Video React Native SDK** for native video UI
2. **Implement call controls** (mute, camera flip, etc.)
3. **Add call history** to profile screen
4. **Implement group calls** for trainer-led classes
5. **Add screen sharing** for exercise demonstrations

## Resources

- [Vision Agents Documentation](https://visionagents.ai)
- [Stream Video Documentation](https://getstream.io/video/docs/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Deepgram STT](https://developers.deepgram.com/)
- [ElevenLabs TTS](https://elevenlabs.io/docs)
