# AI Gym Trainer - Quick Start

## ✅ What's Fixed

1. **Backend Import Error** - Removed problematic `get_gemini_coaching` import
2. **WebSocket Frame Analysis** - Fixed parameter passing to Vision Agents SDK
3. **Camera Integration** - Added real frame capture from device camera
4. **Audio Playback** - Implemented automatic TTS audio playback
5. **Mock Mode** - Works without Vision Agents SDK installed (for testing)
6. **Deepgram STT** - Created service for future speech-to-text

## 🚀 Start Testing Now

### Terminal 1: Backend
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2: Frontend
```bash
cd frontend
npx expo start
```

### On Your Phone
1. Open Expo Go
2. Scan QR code
3. Grant camera permission
4. Select exercise
5. Tap "Start AI Training"
6. Move in front of camera
7. Watch real-time feedback + hear audio coaching

## 📊 What You'll See

- **Camera feed** with live overlay
- **Real-time stats**: Reps, Form Score
- **Trainer message** with coaching feedback
- **Audio** plays automatically (ElevenLabs TTS)
- **Session summary** when you end training

## 🔧 Configuration

**Backend .env** (already set):
- ✅ ELEVENLABS_API_KEY
- ✅ DEEPGRAM_API_KEY
- ✅ GEMINI_API_KEY

**Frontend .env** (already set):
- ✅ EXPO_PUBLIC_API_URL=http://192.168.29.188:8000

## 📱 Expected Behavior

### Mock Mode (Current)
- Rep count increases every ~15 seconds
- Form score: 80-95% (realistic simulation)
- Random faults per exercise
- Audio feedback for each frame

### Real Mode (When SDK installed)
- Actual pose detection from camera
- Real rep counting based on joint angles
- Actual form faults detected
- Same audio feedback

## 🎯 Test Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads in Expo Go
- [ ] Camera permission granted
- [ ] Camera feed displays
- [ ] Trainer message appears
- [ ] Rep count increases
- [ ] Form score updates
- [ ] Audio plays automatically
- [ ] Session ends cleanly

## 📚 Documentation

- **Testing Guide:** `AI_TRAINER_TESTING_GUIDE.md`
- **Architecture:** `AI_TRAINER_ARCHITECTURE.md`
- **Fixes Applied:** `VISION_AGENTS_FIXES.md`

## 🐛 Troubleshooting

**WebSocket disconnects immediately?**
- Check backend is running: `curl http://192.168.29.188:8000/health`
- Check frontend logs: Press `j` in Expo Go

**No audio playing?**
- Check ElevenLabs API key in `backend/.env`
- Check backend logs for TTS errors

**Camera not showing?**
- Grant camera permission when prompted
- Restart Expo Go

**Frames not being sent?**
- Check backend logs for "Processing frame"
- Verify camera is working

## 🎬 Example Session

```
1. Start backend: uvicorn main:app --reload
2. Start frontend: npx expo start
3. Scan QR code in Expo Go
4. Grant camera permission
5. Select "Squat"
6. Tap "Start AI Training"
7. Move in front of camera
8. See real-time feedback + hear audio
9. Tap "End Training"
10. See summary alert
```

## 📞 Support

Check logs:
- **Backend:** Terminal where uvicorn is running
- **Frontend:** Expo Go → press `j` for logs

## 🎉 You're Ready!

Everything is set up and ready to test. Just start the backend and frontend, then use the app!
