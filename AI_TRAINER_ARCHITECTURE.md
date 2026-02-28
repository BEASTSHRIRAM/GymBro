# AI Gym Trainer - Architecture & Implementation

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native (Expo Go)                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  VideoCallFormCheckerScreen.tsx                          │  │
│  │  - Exercise selection                                    │  │
│  │  - Camera feed display                                   │  │
│  │  - Real-time stats (reps, form score)                    │  │
│  │  - Trainer message display                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  visionAgentsWS.ts (WebSocket Service)                   │  │
│  │  - Connect to backend WebSocket                          │  │
│  │  - Send frames every 500ms                               │  │
│  │  - Receive analysis + audio                              │  │
│  │  - Play audio automatically                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  expo-camera (Camera Module)                             │  │
│  │  - Capture frames from device camera                     │  │
│  │  - Convert to base64                                     │  │
│  │  - Send via WebSocket                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↕ WebSocket
                    ws://192.168.29.188:8000
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Python FastAPI Backend                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  vision_agents_ws.py (WebSocket Router)                  │  │
│  │  - Accept WebSocket connections                          │  │
│  │  - Receive base64 frames                                 │  │
│  │  - Manage training sessions                              │  │
│  │  - Send analysis + audio back to client                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  vision_agents_sdk_service.py (Pose Detection)           │  │
│  │  - Decode base64 frames                                  │  │
│  │  - Run YOLO pose estimation (or mock mode)               │  │
│  │  - Extract keypoints                                     │  │
│  │  - Calculate joint angles                                │  │
│  │  - Detect form faults                                    │  │
│  │  - Count reps                                            │  │
│  │  - Calculate form score                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  tts_service.py (Text-to-Speech)                         │  │
│  │  - Generate coaching feedback text                       │  │
│  │  - Convert to audio via ElevenLabs API                   │  │
│  │  - Return audio bytes                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  stt_service.py (Speech-to-Text) [Future]                │  │
│  │  - Receive audio from client                             │  │
│  │  - Transcribe via Deepgram API                           │  │
│  │  - Parse user commands                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↕ HTTP
                    https://api.elevenlabs.io
                    https://api.deepgram.com
```

## 📡 Data Flow

### 1. Session Start
```
Frontend                          Backend
   │                                │
   ├─ User selects exercise         │
   ├─ Requests camera permission    │
   ├─ Taps "Start AI Training"      │
   │                                │
   └─ WebSocket.connect()           │
      └─────────────────────────────→ Accept connection
                                    ├─ Create TrainingSession
                                    ├─ Initialize VisionAgentsSDKService
                                    └─ Send "session_started" message
      ←─────────────────────────────┘
   ├─ Receive "session_started"
   ├─ Display trainer message
   └─ Start frame capture loop
```

### 2. Frame Processing (Every 500ms)
```
Frontend                          Backend
   │                                │
   ├─ Capture frame from camera     │
   ├─ Convert to base64             │
   ├─ Create FrameMessage           │
   │  {                             │
   │    "type": "frame",            │
   │    "frame_base64": "...",      │
   │    "timestamp": 1234567890     │
   │  }                             │
   │                                │
   └─ WebSocket.send()              │
      └─────────────────────────────→ Receive frame
                                    ├─ Decode base64
                                    ├─ Call analyze_frame()
                                    │  ├─ Run YOLO pose detection
                                    │  ├─ Extract keypoints
                                    │  ├─ Calculate angles
                                    │  ├─ Detect faults
                                    │  ├─ Count reps
                                    │  └─ Calculate form score
                                    ├─ Generate feedback text
                                    ├─ Call get_coaching_audio()
                                    │  └─ ElevenLabs API
                                    │     └─ Return audio bytes
                                    ├─ Encode audio to base64
                                    └─ Send AnalysisResponse
      ←─────────────────────────────┘
   ├─ Receive analysis
   │  {
   │    "type": "analysis",
   │    "rep_count": 1,
   │    "form_score": 87.5,
   │    "faults": ["knee_not_aligned"],
   │    "feedback": "I noticed: knee not aligned...",
   │    "audio_base64": "..."
   │  }
   ├─ Update state (reps, form score, faults)
   ├─ Update trainer message
   ├─ Play audio
   └─ Re-render UI
```

### 3. Session End
```
Frontend                          Backend
   │                                │
   ├─ User taps "End Training"      │
   │                                │
   └─ WebSocket.send()              │
      {                             │
        "type": "end_session"       │
      }                             │
      └─────────────────────────────→ Receive end_session
                                    ├─ Calculate stats
                                    │  ├─ Total reps
                                    │  ├─ Average form score
                                    │  └─ Final feedback
                                    ├─ Clean up session
                                    └─ Send SessionEndedResponse
      ←─────────────────────────────┘
   ├─ Receive session_ended
   ├─ Show summary alert
   ├─ Award XP
   └─ Reset state
```

## 🔄 Component Interactions

### Frontend Components

**VideoCallFormCheckerScreen.tsx**
- Main UI component
- Manages training state
- Handles camera permissions
- Displays camera feed
- Shows real-time stats
- Plays audio feedback

**visionAgentsWS.ts**
- WebSocket client
- Manages connection lifecycle
- Sends frames
- Receives analysis
- Plays audio

**expo-camera**
- Captures frames from device camera
- Converts to base64
- Provides camera feed for UI

### Backend Components

**vision_agents_ws.py**
- WebSocket endpoint handler
- Session management
- Frame reception
- Response sending

**vision_agents_sdk_service.py**
- Pose detection (YOLO or mock)
- Keypoint extraction
- Joint angle calculation
- Form fault detection
- Rep counting
- Form score calculation

**tts_service.py**
- Text-to-speech conversion
- ElevenLabs API integration
- Audio byte generation

**stt_service.py** (Future)
- Speech-to-text conversion
- Deepgram API integration
- Command parsing

## 🎯 Key Features

### 1. Real-Time Frame Streaming
- **Interval:** 500ms (2 FPS)
- **Format:** Base64-encoded JPEG
- **Quality:** 50% (optimized for bandwidth)
- **Transport:** WebSocket (persistent connection)

### 2. Pose Detection
- **Model:** YOLO11n-pose (lightweight)
- **Keypoints:** 17 COCO keypoints
- **Fallback:** Mock mode (simulated data)
- **Exercises:** Squat, Bench Press, Deadlift, Shoulder Press

### 3. Form Analysis
- **Rep Counting:** Temporal state machine
- **Form Score:** 0-100% based on joint angles
- **Fault Detection:** Exercise-specific rules
- **Feedback:** Real-time coaching messages

### 4. Voice Coaching
- **TTS Provider:** ElevenLabs
- **Voice:** Rachel (clear, professional)
- **Format:** MP3 audio
- **Playback:** Automatic on frontend

### 5. Session Management
- **Storage:** In-memory (per session)
- **Tracking:** Reps, form scores, faults
- **Summary:** Total reps, average form score, feedback

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```
ELEVENLABS_API_KEY=sk_...
DEEPGRAM_API_KEY=...
GEMINI_API_KEY=...
VISIONAGENTS_API_KEY=...
VISIONAGENTS_SECRET_KEY=...
```

**Frontend (.env)**
```
EXPO_PUBLIC_API_URL=http://192.168.29.188:8000
```

### API Keys

- **ElevenLabs:** For TTS (voice coaching)
- **Deepgram:** For STT (future user commands)
- **Gemini:** For feedback generation (future)
- **Vision Agents:** For SDK access (future)

## 📊 Data Models

### FrameMessage (Frontend → Backend)
```typescript
{
  type: "frame",
  frame_base64: string,
  timestamp: number
}
```

### AnalysisResponse (Backend → Frontend)
```typescript
{
  type: "analysis",
  rep_count: number,
  form_score: number,
  faults: string[],
  feedback: string,
  audio_base64: string,
  timestamp: number
}
```

### SessionStartedResponse (Backend → Frontend)
```typescript
{
  type: "session_started",
  session_id: string,
  message: string
}
```

### SessionEndedResponse (Backend → Frontend)
```typescript
{
  type: "session_ended",
  total_reps: number,
  avg_form_score: number,
  feedback: string
}
```

## 🚀 Performance Considerations

### Frame Rate
- **Current:** 500ms interval (2 FPS)
- **Rationale:** Balance between responsiveness and bandwidth
- **Adjustable:** Can be tuned based on device performance

### Frame Quality
- **Current:** 50% JPEG quality
- **Rationale:** Reduce bandwidth while maintaining pose detection accuracy
- **Adjustable:** Can be increased for better quality

### Session State
- **Current:** In-memory storage
- **Limitation:** Lost on server restart
- **Future:** Database persistence

### Concurrent Sessions
- **Current:** Unlimited (limited by server resources)
- **Scaling:** Add load balancer for multiple servers

## 🔐 Security Considerations

### API Keys
- Store in `.env` files (not in code)
- Use environment variables
- Rotate regularly

### WebSocket
- No authentication (add JWT in production)
- No rate limiting (add in production)
- No input validation (add in production)

### Audio
- Base64 encoded (safe for JSON)
- Temporary storage (cleaned up after session)

## 🎓 Learning Resources

- **Vision Agents:** https://visionagents.ai/
- **YOLO Pose:** https://docs.ultralytics.com/tasks/pose/
- **ElevenLabs TTS:** https://elevenlabs.io/docs
- **Deepgram STT:** https://developers.deepgram.com/
- **FastAPI WebSocket:** https://fastapi.tiangolo.com/advanced/websockets/
- **React Native Camera:** https://docs.expo.dev/versions/latest/sdk/camera/

## 📝 Future Enhancements

1. **Real Vision Agents SDK Integration**
   - Install and configure YOLO model
   - Real pose detection instead of mock

2. **User Commands via STT**
   - Record user audio during training
   - Transcribe with Deepgram
   - Parse commands: "stop", "faster", "slower"

3. **Personalized Feedback**
   - Use Gemini to generate custom tips
   - Learn from user history
   - Adapt difficulty

4. **Multi-Exercise Tracking**
   - Track progress across exercises
   - Compare form scores
   - Suggest improvements

5. **Social Features**
   - Share workout summaries
   - Compare with friends
   - Leaderboards

6. **Advanced Analytics**
   - Form improvement over time
   - Rep count trends
   - Injury risk assessment
