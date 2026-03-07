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

---

## 🧠 Brain Architecture: The MCP CNS

GymBro now uses a **Central Nervous System (CNS)** based on the Model Context Protocol (MCP). This standalone "Brain" server aggregates all user context into three tiers of memory for the AI Agent:

1.  **Short-Term (Redis)**: Real-time chat history and ultra-fast profile caching.
2.  **Hard Facts (MongoDB Atlas)**: Persistent user profiles, goals, and medical data.
3.  **Long-Term/Semantic (Qdrant)**: A vector database that stores multi-dimensional "memories" of past workouts, allowing the AI to actually learn from your previous sessions.

---

## 🛠️ State-of-the-Art Stack

| Category | Technology |
| :--- | :--- |
| **Mobile App** | React Native, Expo, TypeScript |
| **Backend** | FastAPI (Python 3.12), Uvicorn |
| **Brain (MCP)** | Model Context Protocol (FastMCP), Redis, MongoDB, Qdrant |
| **Compute Vision** | VisionAgents SDK, YOLO11, NumPy, OpenCV |
| **Large Language Models** | Gemini 1.5 Flash (Context Framing), Gemini Realtime |
| **Real-time Protocol** | WebRTC (Stream), WebSocket (Full-Duplex) |
| **Persistence** | MongoDB Atlas, Qdrant Vector Engine |

---

## 🏁 Installation

### 1. Database Setup (Docker)
Ensure Docker is running, then start the local infrastructure:
```bash
cd backend
docker-compose up -d
```

### 2. Brain (MCP Server)
```bash
cd backend
uv run gymbro_mcp_server.py
```

### 3. Backend (FastAPI Core)
```bash
cd backend
# Starts the server on port 8080 (fixes Windows port bugs)
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### 4. Frontend (Expo App)
```bash
cd frontend
npm install
npx expo start --clear
```

---

## 🚢 Deployment

Deployed to **Azure App Service for Containers**. We provide specialized guides for the new architecture:
*   [Azure MCP Deployment Guide](file:///C:/Users/nages/.gemini/antigravity/brain/6f0d7068-ecfc-41eb-9339-f85809fb44b5/azure_mcp_deployment.md) — **New architecture build**.
*   [GymBro Integration Guide](file:///C:/Users/nages/.gemini/antigravity/brain/6f0d7068-ecfc-41eb-9339-f85809fb44b5/mcp_integration_client.md) — Technical deep-dive on context injection.

---

## 🧹 Security & Environment
All sensitive configurations are managed via `.env` in the `backend/` directory. Reference `.env.example` for required keys. 

> [!IMPORTANT]
> **Windows Users**: We have included a global DNS monkey-patch in `main.py` and `services/` to bypass the `aiodns` bug on local development networks.

---

## 📜 License & Attribution
**Project Owner**: BEASTSHRIRAM  
**Engineered with ❤️ for the pursuit of gains.**
