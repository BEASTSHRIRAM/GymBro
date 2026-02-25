# 🏋️ GymBro — AI-Powered Fitness App

> Real-time AI form correction · Voice coaching · Diet planning · Strength prediction · Gamification

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React Native + Expo (TypeScript) |
| Navigation | React Navigation (Drawer + Bottom Tabs) |
| State | Zustand |
| Backend | FastAPI (Python 3.11) |
| Database | MongoDB (Motor async) |
| AI Vision | VisionAgents SDK |
| AI Text | Google Gemini 1.5 Flash |
| TTS | Deepgram |
| Auth | JWT + OTP email (Gmail) |
| Realtime | WebSocket (native) |
| Deploy | Docker Compose |

---

## Folder Structure

```
GymBro/
├── backend/
│   ├── main.py           # FastAPI entry point
│   ├── config.py         # Settings (Pydantic)
│   ├── database.py       # MongoDB Motor
│   ├── models/           # Pydantic DB schemas
│   ├── routers/          # API endpoints
│   │   ├── auth.py       # Register/OTP/Login/Refresh
│   │   ├── form_checker.py  # WS /ws/form-check
│   │   ├── strength.py
│   │   ├── diet.py
│   │   ├── body_scan.py
│   │   ├── gamification.py
│   │   └── coaches.py
│   └── services/         # Business logic
│       ├── auth_service.py
│       ├── vision_service.py
│       ├── gemini_service.py
│       ├── tts_service.py
│       ├── strength_service.py
│       ├── diet_service.py
│       └── gamification_service.py
└── frontend/
    ├── App.tsx
    └── src/
        ├── navigation/
        ├── screens/      # 10 screens
        ├── stores/       # 4 Zustand stores
        ├── services/     # api, websocket, audio
        └── theme/
```

---

## Quick Start

### 1. Clone & Environment

```bash
# Backend .env (fill in your keys)
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:
- `GMAIL_USER` + `GMAIL_APP_PASSWORD` — for OTP emails
- `GEMINI_API_KEY` — Google AI Studio
- `VISIONAGENTS_API_KEY` — VisionAgents dashboard
- `DEEPGRAM_API_KEY` — Deepgram console

### 2. Backend (Python)

```bash
cd backend

# Using uv (recommended):
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or using traditional venv:
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API Docs: http://localhost:8000/docs

### 3. Frontend (Expo)

```bash
cd frontend
npm install
npx expo start
```

Scan QR code with **Expo Go** app (iOS/Android).

> Set `EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000` in `frontend/.env`

### 4. Docker (full stack)

```bash
# Start MongoDB + Backend
docker-compose up --build

# Verify
curl http://localhost:8000/health
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register + OTP email |
| POST | `/auth/verify-otp` | Verify OTP |
| POST | `/auth/login` | Login → JWT |
| POST | `/auth/refresh` | Refresh token |
| GET | `/auth/me` | Profile |
| WS | `/ws/form-check/{id}` | Real-time form AI |
| POST | `/strength/log` | Log workout set |
| GET | `/strength/predict/{exercise}` | 1RM + 4/8wk |
| POST | `/diet/generate` | Generate meal plan |
| GET | `/diet/current` | Current diet plan |
| POST | `/body-scan/analyze` | Upload 360° video |
| GET | `/gamification/profile` | XP/rank/badges |
| GET | `/gamification/leaderboard` | Top 20 |
| GET | `/coaches/nearby` | Geo search |
| POST | `/coaches/book` | Book session |

---

## MongoDB Collections

- `users` — Auth + profile + XP/rank/streak
- `workout_sessions` — Form check history
- `strength_predictions` — Logs + 1RM predictions
- `diet_plans` — AI-generated meal plans
- `body_scans` — Posture reports
- `coaches` — Coach profiles (2dsphere geo)
- `bookings` — Session bookings
- `reviews` — Coach reviews

---

## Adding API Keys

All keys go in `backend/.env`:
```
GEMINI_API_KEY=AIza...
VISIONAGENTS_API_KEY=va_...
DEEPGRAM_API_KEY=dg_...
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

Payment: `STRIPE_SECRET_KEY` — add when ready.

---

## MongoDB Geo Index (coaches)

Run once after starting MongoDB:
```js
db.coaches.createIndex({ "geo_location": "2dsphere" })
```

---

## Notes

- **Voice coaching**: Deepgram TTS → MP3 → played via Expo AV. Toggle in form checker screen.
- **Form analysis**: VisionAgents API at 3fps via WebSocket. Graceful fallback if API unavailable.
- **Diet plan**: Generated async via Gemini (Mifflin-St Jeor BMR → TDEE → macros → meals). Poll `/diet/current`.
- **Gamification**: No Redis — MongoDB leaderboard query (top 20 by XP).
- **Payment**: Stripe-ready structure in `/coaches/book` — add Stripe SDK when ready.
