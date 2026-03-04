"""
GymBro — FastAPI Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import connect_db, close_db
from routers import auth, strength, diet, body_scan, gamification, coaches, form_checker, profile, workout_split, stream_video, video_call, vision_agents, vision_agents_ws, gym_agent, subscription

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="GymBro API",
    description="AI-powered gym assistant backend — Real-time form correction, diet planning, strength prediction, gamification.",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(strength.router)
app.include_router(diet.router)
app.include_router(body_scan.router)
app.include_router(gamification.router)
app.include_router(coaches.router)
app.include_router(form_checker.router)
app.include_router(profile.router)
app.include_router(workout_split.router)
app.include_router(stream_video.router)
app.include_router(video_call.router)
app.include_router(vision_agents.router)
app.include_router(vision_agents_ws.router)
app.include_router(gym_agent.router)
app.include_router(subscription.router)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "app": "GymBro API", "version": "1.0.0"}


@app.get("/", tags=["health"])
async def root():
    return {
        "message": "GymBro API is running",
        "docs": "/docs",
        "health": "/health",
    }
