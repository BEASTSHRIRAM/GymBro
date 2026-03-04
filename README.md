# 🏋️ GymBro — Your AI Gym Companion

![GymBro Banner](https://raw.githubusercontent.com/BEASTSHRIRAM/GymBro/main/banner.png)

> **The ultimate fitness sidekick that knows your form, your diet, and your goals — powered by real-time Computer Vision and Voice AI.**

GymBro isn't just a tracker; it’s a living context engine that acts as your personal elite-level coach. By merging high-frequency computer vision analysis with persistent memory, GymBro provides guidance that is specifically tailored to YOUR body and YOUR history.

---

## 🚀 Visionary Features

### 🤖 AI Trainer (Real-Time Vision)
*   **Precision Pose Estimation**: Analyzes 17 key COCO keypoints at 30 FPS using YOLO11n-Pose to ensure your squat depth is perfect and your back is straight.
*   **Audio Coaching (Voice AI)**: Integrated with **ElevenLabs**, giving you instant, natural-sounding voice corrections (e.g., *"Keep your chest up, Shriram!"*) while you are mid-set.
*   **WebRTC/WebSocket Streaming**: Ultra-low latency streaming between your mobile camera and the AI backend for zero-lag feedback.

### 🥗 Personal Nutritionist & Supplement Coach
*   **Metabolic Calculation**: Uses Mifflin-St Jeor formulas to precisely calculate your BMR and TDEE based on your profile.
*   **Context-Aware Dieting**: AI-generated meal plans that adapt to your training volume.
*   **Supplementation Intelligence**: Specific advice on micronutrients and performance boosters based on your goal (Bulking, Cutting, or Maintenance).

### 🧘 AI Body Scan & Posture Engine
*   **Imbalance Detection**: Identifies anterior pelvic tilt, kyphosis, and other common lifting posture issues.
*   **Physical Evolution Tracking**: Visualized progress reports that show how your posture and body composition improve over months of training.

### 🎮 Gamified Motivation
*   **RPG-Style XP System**: Earn experience for consistent logs, perfect form scores, and distance traveled.
*   **Tiered Leaderboard**: Rise from *Beginner* to *Beast* status and compete on the global "Bros" leaderboard.

---

## 🧠 Brain Activity: Context Persistence

GymBro is built on a **Central Context Engine** that ensures the AI doesn't forget who you are. This engine aggregates:
1.  **Bio-Data**: Weight, height, age, and gender.
2.  **Training History**: Last 50 workout summaries including average form scores and common faults.
3.  **Voice Insights**: Remembers previous questions you've asked the AI coach.
4.  **Posture History**: Maintains a baseline of your skeletal alignment to track improvements.

---

## 🛠️ State-of-the-Art Stack

| Category | Technology |
| :--- | :--- |
| **Mobile App** | React Native, Expo, TypeScript |
| **Design Language** | Glassmorphic Dark UI, Ionicons, Linear Gradients |
| **Backend** | FastAPI (Python 3.11), Uvicorn (High-Concurrency) |
| **Compute Vision** | VisionAgents SDK, YOLO11, NumPy, OpenCV |
| **Large Language Models** | Google Gemini 1.5 Flash (Context Framing) |
| **Real-time Protocol** | WebRTC (Stream), WebSocket (Full-Duplex) |
| **Persistence** | MongoDB (Motor Async), Atlas Geo-Spatial Indexing |

---

## 🗺️ Roadmap: The Future of GymBro

*   [ ] **Velkey Integration**: We are moving towards **Velkey** for ultra-optimized user context storage. This will allow the AI to retrieve years of training context in milliseconds, providing an even more personalized and predictive coaching experience.
*   [ ] **Wearable Sync**: Direct integration with Apple Health and Google Fit for heart-rate-aware sessions.
*   [ ] **Multi-Camera Form Check**: Simultaneous front/side analysis for 3D form verification.
*   [ ] **Recipe Scanner**: Photo-to-Macro conversion for instant nutrition logging.

---

## 🏁 Installation

### Backend (Python Core)
*Ensure you have Python 3.11+ installed.*

```bash
cd backend
python -m venv venv
# Activate & Install
source venv/bin/activate # Mac/Linux
pip install -r requirements.txt
# Start the engine
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Expo App)
```bash
cd frontend
npm install
npx expo start
```

---

## 🧹 Security & Environment
All sensitive configurations are managed via `.env` in the `backend/` directory. **Never** hardcode keys. Reference the `.env.example` for the required keys: `GEMINI_API_KEY`, `STREAM_API_KEY`, `ELEVENLABS_API_KEY`, and `DEEPGRAM_API_KEY`.

---

## � License & Attribution
**Project Owner**: BEASTSHRIRAM  
**Engineered with ❤️ for the pursuit of gains.**
