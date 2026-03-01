"""
GymBro — Vision Agents Gym Coach Service
Uses Vision Agents SDK properly: Agent + Stream Edge + YOLO + Gemini Realtime.
Based on: https://github.com/GetStream/vision-agents/examples/02_golf_coach_example
"""
import os
import asyncio
from typing import Dict, Optional
from datetime import datetime
from pathlib import Path

try:
    from vision_agents.core import Agent, User
    from vision_agents.plugins import getstream, gemini, ultralytics, deepgram, elevenlabs
    VISION_AGENTS_AVAILABLE = True
except ImportError:
    VISION_AGENTS_AVAILABLE = False
    print("[GymAgent] Vision Agents SDK not installed. Agent mode disabled.")

from config import get_settings

settings = get_settings()

# ── Instruction files ────────────────────────────────────────────────────────
INSTRUCTIONS_DIR = Path(__file__).parent.parent / "instructions"

EXERCISE_INSTRUCTIONS = {
    "squat": "gym_coach_squat.md",
    "bench_press": "gym_coach_bench_press.md",
    "deadlift": "gym_coach_deadlift.md",
    "shoulder_press": "gym_coach_shoulder_press.md",
}


def _load_instructions(exercise: str) -> str:
    """Load exercise-specific coaching instructions."""
    filename = EXERCISE_INSTRUCTIONS.get(exercise, "gym_coach_squat.md")
    filepath = INSTRUCTIONS_DIR / filename
    if filepath.exists():
        return filepath.read_text(encoding="utf-8")
    return f"You are GymBro, an AI gym coach. Coach the user through {exercise} with proper form cues."





class GymAgentService:
    """
    Manages Vision Agents gym coaching sessions using Stream video calls.
    Each training session creates an Agent that joins a Stream call.
    """

    def __init__(self):
        self.active_agents: Dict[str, dict] = {}

        if VISION_AGENTS_AVAILABLE:
            # Set env vars for Vision Agents SDK
            os.environ.setdefault("STREAM_API_KEY", settings.stream_api_key)
            os.environ.setdefault("STREAM_API_SECRET", settings.stream_api_secret)
            os.environ.setdefault("GOOGLE_API_KEY", settings.gemini_api_key)
            os.environ.setdefault("DEEPGRAM_API_KEY", settings.deepgram_api_key)
            os.environ.setdefault("ELEVENLABS_API_KEY", settings.elevenlabs_api_key)
            print("[GymAgent] ✓ Service initialized with Vision Agents SDK")
        else:
            print("[GymAgent] ✗ Vision Agents SDK not available")

    async def create_agent(self, exercise: str = "squat") -> Optional["Agent"]:
        """
        Create a Vision Agents Agent for gym coaching.
        Applies a monkey-patch to fix WebRTC track subscription on LAN backends.
        """
        if not VISION_AGENTS_AVAILABLE:
            print("[GymAgent] Cannot create agent — SDK not available")
            return None

        instructions = _load_instructions(exercise)

        agent = Agent(
            edge=getstream.Edge(),
            agent_user=User(name="GymBro Coach", id="gymbro-coach"),
            instructions=instructions,
            llm=gemini.Realtime(fps=1),
            processors=[
                ultralytics.YOLOPoseProcessor(
                    model_path="yolo11n-pose.pt",
                    fps=15,
                    conf_threshold=0.5,
                )
            ],
            stt=deepgram.STT(),
            tts=elevenlabs.TTS(),
        )

        return agent


    async def start_session(
        self,
        session_id: str,
        user_id: str,
        exercise: str,
        call_type: str = "default",
    ) -> dict:
        """
        Start a gym coaching session:
        1. Create the Agent
        2. Create a Stream call
        3. Agent joins the call
        4. Return call credentials so frontend can join

        The agent runs as a background task.
        """
        if not VISION_AGENTS_AVAILABLE:
            return {
                "error": "Vision Agents SDK not available",
                "fallback": True,
            }

        if session_id in self.active_agents:
            return {"error": "Session already active"}

        try:
            agent = await self.create_agent(exercise)
            if not agent:
                return {"error": "Failed to create agent"}

            call_id = f"gym_{session_id}"

            # Fix: SDK sets agent_user_id lazily during full startup,
            # but create_call needs it immediately for server-side auth.
            # Manually set it before calling create_call.
            if hasattr(agent, 'edge') and agent.edge is not None:
                agent.edge.agent_user_id = "gymbro-coach"

            # Create the Stream call
            call = await agent.create_call(call_type, call_id)


            # Store session info
            self.active_agents[session_id] = {
                "agent": agent,
                "call": call,
                "user_id": user_id,
                "exercise": exercise,
                "start_time": datetime.utcnow(),
                "task": None,  # Will store the background task
            }

            # Launch agent in background — it joins the call and starts coaching
            task = asyncio.create_task(
                self._run_agent(session_id, agent, call, exercise)
            )
            self.active_agents[session_id]["task"] = task

            # Get call credentials for the frontend
            # call is a StreamCall object — use .id and .type attributes
            actual_call_id = getattr(call, 'id', call_id)
            actual_call_type = getattr(call, 'type', call_type)
            call_cid = f"{actual_call_type}:{actual_call_id}"

            print(f"[GymAgent] ✓ Session {session_id} started for {exercise}, call: {call_cid}")

            return {
                "status": "started",
                "session_id": session_id,
                "exercise": exercise,
                "call_id": actual_call_id,
                "call_type": actual_call_type,
                "call_cid": call_cid,
                "stream_api_key": settings.stream_api_key,
            }


        except Exception as e:
            print(f"[GymAgent] ✗ Failed to start session: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e), "fallback": True}

    async def _run_agent(
        self,
        session_id: str,
        agent: "Agent",
        call: dict,
        exercise: str,
    ):
        """Background task: Agent joins call and coaches until session ends."""
        try:
            async with agent.join(call):
                # Initial greeting
                try:
                    await agent.llm.simple_response(
                        text=f"Say hi as GymBro. Tell the user you're ready to coach them "
                             f"through {exercise.replace('_', ' ')}. Be hyped and motivating. "
                             f"Then wait for them to start their exercise."
                    )
                except Exception as greet_err:
                    print(f"[GymAgent] Greeting error (non-fatal): {greet_err}")

                # Run until call ends or session is stopped
                await agent.finish()

        except asyncio.CancelledError:
            print(f"[GymAgent] Session {session_id} cancelled")
        except TimeoutError as te:
            # SDK timeout waiting for WebRTC tracks from phone — non-fatal.
            # The agent still coaches via Gemini Realtime even without receiving tracks.
            print(f"[GymAgent] Track subscription timeout (non-fatal) in {session_id}: {te}")
        except Exception as e:
            print(f"[GymAgent] ✗ Agent error in session {session_id}: {e}")


    async def end_session(self, session_id: str) -> dict:
        """End a coaching session and return summary."""
        if session_id not in self.active_agents:
            return {"error": "Session not found"}

        session = self.active_agents.pop(session_id)

        # Cancel the agent background task
        task = session.get("task")
        if task and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        duration = (datetime.utcnow() - session["start_time"]).seconds

        summary = {
            "session_id": session_id,
            "exercise": session["exercise"],
            "user_id": session["user_id"],
            "duration_seconds": duration,
            "timestamp": datetime.utcnow().isoformat(),
        }

        print(f"[GymAgent] Session {session_id} ended ({duration}s)")
        return summary

    def is_available(self) -> bool:
        """Check if Vision Agents SDK is available."""
        return VISION_AGENTS_AVAILABLE


# ── Singleton ────────────────────────────────────────────────────────────────
_gym_agent_service = None


def get_gym_agent_service() -> GymAgentService:
    global _gym_agent_service
    if _gym_agent_service is None:
        _gym_agent_service = GymAgentService()
    return _gym_agent_service
