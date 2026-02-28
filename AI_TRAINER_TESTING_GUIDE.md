# AI Gym Trainer - Complete Testing Guide

## 🎯 What's Fixed

### Backend
✅ Import errors resolved (removed problematic `get_gemini_coaching` import)
✅ WebSocket frame analysis fixed (now passes correct parameters)
✅ Mock mode enabled (works without Vision Agents SDK installed)
✅ ElevenLabs TTS integrated (voice coaching)
✅ Deepgram STT service created (for future audio input)
✅ Better logging added for debugging

### Frontend
✅ Camera integration with `expo-camera`
✅ Real-time frame capture (500ms intervals)
✅ Audio playback for TTS responses
✅ Camera permission handling
✅ Real-time stats display (reps, form score)
✅ Training UI with camera feed overlay

## 🚀 How to Test

### Step 1: Start Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

**Verify WebSocket endpoint:**
- Open browser: `http://192.168.29.188:8000/docs`
- Look for `/ws/vision-agents/{session_id}/{user_id}/{exercise}` endpoint

### Step 2: Start Frontend in Expo Go

```bash
cd frontend
npx expo start
```

**Expected output:**
```
Starting project at C:\myprojects\GymBro\frontend
Expo Go is ready at exp://192.168.29.188:19000
```

**On your phone:**
1. Open Expo Go app
2. Scan QR code from terminal
3. Wait for app to load

### Step 3: Test AI Trainer Flow

#### 3.1 Grant Camera Permission
- App will ask for camera permission
- Tap "Allow" to grant access

#### 3.2 Select Exercise
- Choose from: Squat, Bench Press, Deadlift, Shoulder Press
- Selected exercise will highlight in blue

#### 3.3 Start AI Training
- Tap "Start AI Training" button
- **Expected behavior:**
  - Camera feed appears full-screen
  - Header shows exercise name and timer
  - Trainer message appears: "Let's work on your [exercise]! Show me your form..."
  - Stats box shows: Reps: 0, Form: 0%

#### 3.4 Perform Exercise
- Move in front of camera
- **Expected behavior:**
  - Frames sent to backend every 500ms
  - Trainer message updates with feedback
  - Rep count increases (simulated every ~15 seconds)
  - Form score updates (80-95%)
  - Audio plays automatically with coaching feedback

#### 3.5 End Training
- Tap "End Training" button
- **Expected behavior:**
  - Alert shows summary:
    - Duration: X minutes Y seconds
    - Total reps completed
    - Average form score
    - Final feedback

### Step 4: Monitor Backend Logs

**Look for these log messages:**

```
[Vision Agents WS] Client connected: va_699f1f916180f42586bf66cc_squat_1772291379546
[Vision Agents WS] Processing frame for squat (size: 45000 bytes)
[Vision Agents WS] Analysis complete - Reps: 1, Form: 87.5%, Audio: 8500 bytes
[TTS] ElevenLabs TTS generated audio (8500 bytes)
[Vision Agents WS] Client disconnected: va_699f1f916180f42586bf66cc_squat_1772291379546
```

## 🔍 Troubleshooting

### Issue: WebSocket disconnects immediately
**Cause:** Frames not being sent from frontend
**Solution:**
1. Check camera permission is granted
2. Check browser console for errors: `npx expo start` → press `w` for web
3. Verify backend is running: `curl http://192.168.29.188:8000/health`

### Issue: No audio playing
**Cause:** ElevenLabs API key missing or invalid
**Solution:**
1. Check `backend/.env` has `ELEVENLABS_API_KEY` set
2. Verify API key is valid: `curl -H "xi-api-key: YOUR_KEY" https://api.elevenlabs.io/v1/voices`
3. Check backend logs for TTS errors

### Issue: Camera not showing
**Cause:** Camera permission denied or camera not available
**Solution:**
1. Grant camera permission when prompted
2. On Android: Settings → Apps → GymBro → Permissions → Camera
3. On iOS: Settings → GymBro → Camera

### Issue: Frames not being sent
**Cause:** Camera capture failing in Expo Go
**Solution:**
1. Check backend logs for "Empty frame received"
2. Try restarting Expo Go
3. Check if device has camera: `expo-camera` requires physical device or emulator with camera

### Issue: Backend crashes on startup
**Cause:** Import errors or missing dependencies
**Solution:**
```bash
cd backend
pip install -r requirements.txt
python -c "from routers import vision_agents_ws; print('✅ Imports OK')"
```

## 📊 Expected Behavior

### Mock Mode (No Vision Agents SDK)
- Rep count increases every ~15 seconds (30 frames at 500ms = 15s)
- Form score: 80-95% normally, 70-80% occasionally
- Faults: 10% chance per frame (random fault type per exercise)
- Audio: Generated for each feedback message

### Real Mode (With Vision Agents SDK)
- Rep count based on actual pose detection
- Form score based on joint angles and alignment
- Faults: Detected from pose keypoints
- Audio: Same as mock mode

## 🎬 Example Session

```
[User starts app]
→ Grants camera permission
→ Selects "Squat"
→ Taps "Start AI Training"

[Backend logs]
[Vision Agents WS] Client connected: va_699f1f916180f42586bf66cc_squat_1772291379546
[Vision Agents WS] Processing frame for squat (size: 45000 bytes)
[Vision Agents WS] Analysis complete - Reps: 0, Form: 87.5%, Audio: 8500 bytes

[Frontend shows]
Camera feed with overlay:
- Header: "SQUAT" | Timer: 0:05
- Message: "Great form! Keep it up!"
- Stats: Reps: 0, Form: 87%
- Audio plays automatically

[After 15 seconds]
[Vision Agents WS] Analysis complete - Reps: 1, Form: 92.3%, Audio: 7200 bytes

[Frontend updates]
- Stats: Reps: 1, Form: 92%
- Message: "Excellent! One rep down!"
- Audio plays

[User taps "End Training" after 30 seconds]
[Vision Agents WS] Client disconnected

[Frontend shows alert]
Training Complete! 🎉
Duration: 0m 30s
Reps: 2
Form Score: 89.9%
Feedback: Great workout! 2 reps with 89.9% form score.
```

## 🔧 Configuration

### Backend (.env)
```
ELEVENLABS_API_KEY=sk_58bae26dc3f7fd15b5cf55d5701e9cf5feecf7cfafbd0997
DEEPGRAM_API_KEY=d8bffe1a464ece5a6e34c42525e307380d534705
GEMINI_API_KEY=AIzaSyD7A_WJTNwIAUxVxt3SquRI9dEnswagDGY
```

### Frontend (.env)
```
EXPO_PUBLIC_API_URL=http://192.168.29.188:8000
```

## 📱 Device Requirements

- **Phone:** Android or iOS with camera
- **Network:** Same WiFi as backend (192.168.29.188)
- **Permissions:** Camera access required
- **Expo Go:** Latest version installed

## 🎯 Success Criteria

✅ Backend starts without errors
✅ Frontend loads in Expo Go
✅ Camera permission granted
✅ Camera feed displays during training
✅ Frames sent to backend (check logs)
✅ Trainer message updates
✅ Audio plays automatically
✅ Stats update in real-time
✅ Session ends cleanly
✅ Summary alert shows correct data

## 📝 Next Steps

1. **Test with real Vision Agents SDK** (when installed)
   - Install: `pip install vision-agents[ultralytics]`
   - Download YOLO model: `yolo11n-pose.pt`
   - Real pose detection will replace mock mode

2. **Add STT for user commands** (Deepgram)
   - Record user audio during training
   - Transcribe with Deepgram
   - Parse commands: "stop", "faster", "slower", etc.

3. **Improve rep counting** per exercise
   - Tune thresholds for each exercise
   - Add temporal smoothing
   - Validate with real users

4. **Add form correction tips**
   - Generate specific feedback per fault
   - Use Gemini to create personalized tips
   - Show on-screen form corrections

## 🐛 Debug Mode

To enable verbose logging:

**Backend:**
```python
# In vision_agents_ws.py, add:
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```typescript
// In visionAgentsWS.ts, add:
console.log('[VisionAgentsWS] Debug:', data);
```

Then check logs:
- Backend: Terminal where `uvicorn` is running
- Frontend: Expo Go → press `j` for logs
