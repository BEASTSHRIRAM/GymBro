"""
GymBro — Vision Agents Gym Coach Service
Uses Vision Agents SDK with Gemini Realtime (built-in STT + TTS + Vision).
Based on: https://github.com/GetStream/Vision-Agents/tree/main/examples/02_golf_coach_example

Architecture (matches golf coach example exactly):
- Gemini Realtime handles speech-to-text, text-to-speech AND vision in a
  single model call → zero extra round-trip latency.
- YOLO Pose Processor overlays skeleton on the video frames sent to Gemini
  so the LLM can see exact joint positions for rep counting & form analysis.
- fps=10 for responsive real-time coaching (golf coach uses 10).
"""
import os
import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from vision_agents.core import Agent, User
    from vision_agents.plugins import getstream, gemini, ultralytics
    from vision_agents.core.edge import events as core_events
    VISION_AGENTS_AVAILABLE = True
except ImportError:
    VISION_AGENTS_AVAILABLE = False
    print("[GymAgent] Vision Agents SDK not installed. Agent mode disabled.")

from config import get_settings

settings = get_settings()


# ── Monkey-patch: Fix _on_track_published race condition ─────────────────────
# The SDK's StreamEdge._on_track_published raises TimeoutError when
# republish_tracks() fires a duplicate TrackPublishedEvent for tracks that
# were already subscribed.  This kills the event handler and prevents
# TrackAddedEvent from ever being sent → YOLO+Gemini never see video.
#
# The patch replaces the TimeoutError with a graceful fallback: if the
# pending-track poll times out, look for ANY track in the track map from the
# same user with the right type and emit the event using that track ID.
if VISION_AGENTS_AVAILABLE:
    from vision_agents.plugins.getstream import stream_edge_transport as _set
    from vision_agents.plugins.getstream import sfu_events as _sfu_events

    _original_on_track_published = _set.StreamEdge._on_track_published

    async def _patched_on_track_published(self, event: _sfu_events.TrackPublishedEvent):
        """Patched handler that won't raise TimeoutError on duplicate tracks."""
        if not event.payload:
            return

        if event.participant and event.participant.user_id:
            session_id = event.participant.session_id
            user_id = event.participant.user_id
        else:
            user_id = event.payload.user_id
            session_id = event.payload.session_id

        track_type_int = event.payload.type
        track_type = _set._to_core_track_type(track_type_int)
        webrtc_track_kind = self._get_webrtc_kind(track_type_int)

        is_agent_track = user_id == self.agent_user_id
        if is_agent_track:
            return

        # Check if track already exists in map
        track_key = (user_id, session_id, track_type_int)
        if track_key in self._track_map:
            self._track_map[track_key]["published"] = True
            track_id = self._track_map[track_key]["track_id"]
            self.events.send(
                core_events.TrackAddedEvent(
                    plugin_name="getstream",
                    track_id=track_id,
                    track_type=track_type,
                    participant=_set._to_core_participant(event.participant),
                )
            )
            return

        # Wait for pending track (shortened timeout — 15s)
        track_id = None
        timeout = 15.0
        poll_interval = 0.05
        elapsed = 0.0

        while elapsed < timeout:
            for tid, (pu, ps, pk) in list(self._pending_tracks.items()):
                if pu == user_id and ps == session_id and pk == webrtc_track_kind:
                    track_id = tid
                    del self._pending_tracks[tid]
                    break
            if track_id:
                break
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        if track_id:
            self._track_map[track_key] = {"track_id": track_id, "published": True}
            self.events.send(
                core_events.TrackAddedEvent(
                    plugin_name="getstream",
                    track_id=track_id,
                    track_type=track_type,
                    participant=_set._to_core_participant(event.participant),
                )
            )
        else:
            # ── Graceful fallback ──
            # Instead of raising TimeoutError, try to find any track from
            # the same user_id with the matching type (different session).
            fallback_id = None
            for (mu, ms, mt), minfo in self._track_map.items():
                if mu == user_id and mt == track_type_int and minfo.get("track_id"):
                    fallback_id = minfo["track_id"]
                    break

            if fallback_id:
                logger.warning(
                    f"[GymAgent-patch] Track timeout for {track_type.name} "
                    f"from {user_id} session {session_id} — using fallback "
                    f"track {fallback_id}"
                )
                self._track_map[track_key] = {"track_id": fallback_id, "published": True}
                self.events.send(
                    core_events.TrackAddedEvent(
                        plugin_name="getstream",
                        track_id=fallback_id,
                        track_type=track_type,
                        participant=_set._to_core_participant(event.participant),
                    )
                )
            else:
                logger.warning(
                    f"[GymAgent-patch] Track timeout for {track_type.name} "
                    f"from {user_id} — no fallback available. "
                    f"Pending: {self._pending_tracks}, Map: {self._track_map}"
                )

    _set.StreamEdge._on_track_published = _patched_on_track_published
    print("[GymAgent] ✓ Patched StreamEdge._on_track_published (no more TimeoutError)")
# ── End monkey-patch ─────────────────────────────────────────────────────────

# ── Instruction files ────────────────────────────────────────────────────────
INSTRUCTIONS_DIR = Path(__file__).parent.parent / "instructions"

EXERCISE_INSTRUCTIONS = {
    "squat": "gym_coach_squat.md",
    "bench_press": "gym_coach_bench_press.md",
    "deadlift": "gym_coach_deadlift.md",
    "shoulder_press": "gym_coach_shoulder_press.md",
}


def _instruction_ref(exercise: str) -> str:
    """
    Return an instruction string that uses the @file.md reference pattern
    (like the golf coach example) so the SDK loads the markdown natively.
    Falls back to inline text if the file doesn't exist.
    """
    filename = EXERCISE_INSTRUCTIONS.get(exercise, "gym_coach_squat.md")
    filepath = INSTRUCTIONS_DIR / filename
    if filepath.exists():
        return f"Read @{filename}"
    return (
        f"You are GymBro, an AI gym coach. Coach the user through "
        f"{exercise} with proper form cues. Count every rep out loud. "
        f"Call out form faults immediately."
    )


def _load_instructions(exercise: str) -> str:
    """Load exercise-specific coaching instructions (full text)."""
    filename = EXERCISE_INSTRUCTIONS.get(exercise, "gym_coach_squat.md")
    filepath = INSTRUCTIONS_DIR / filename
    if filepath.exists():
        return filepath.read_text(encoding="utf-8")
    return (
        f"You are GymBro, an AI gym coach. Coach the user through "
        f"{exercise} with proper form cues. Count every rep out loud. "
        f"Call out form faults immediately."
    )


class GymAgentService:
    """
    Manages Vision Agents gym coaching sessions using Stream video calls.
    Each training session creates an Agent that joins a Stream call.

    Follows the golf coach example pattern:
      create_agent → create_call → agent.join(call) → simple_response → finish
    """

    def __init__(self):
        self.active_agents: Dict[str, dict] = {}

        if VISION_AGENTS_AVAILABLE:
            # Set env vars for Vision Agents SDK
            # Only Stream + Gemini needed — Gemini Realtime handles STT+TTS natively
            os.environ.setdefault("STREAM_API_KEY", settings.stream_api_key)
            os.environ.setdefault("STREAM_API_SECRET", settings.stream_api_secret)
            os.environ.setdefault("GOOGLE_API_KEY", settings.gemini_api_key)
            print("[GymAgent] ✓ Service initialized (Gemini Realtime — no separate STT/TTS)")
        else:
            print("[GymAgent] ✗ Vision Agents SDK not available")

    async def create_agent(self, exercise: str = "squat") -> Optional["Agent"]:
        """
        Create a Vision Agents Agent for gym coaching.
        Mirrors the golf coach example exactly:
          Agent(edge, agent_user, instructions, llm=Realtime(fps), processors=[YOLO])
        """
        if not VISION_AGENTS_AVAILABLE:
            print("[GymAgent] Cannot create agent — SDK not available")
            return None

        instructions = _load_instructions(exercise)

        # Gemini Realtime handles STT + TTS + Vision in ONE model call.
        # fps=10 matches the golf coach reference example for responsive coaching.
        # YOLO overlays skeleton keypoints on every frame → Gemini sees joint angles.
        agent = Agent(
            edge=getstream.Edge(),
            agent_user=User(name="GymBro Coach", id="gymbro-coach"),
            instructions=instructions,
            llm=gemini.Realtime(fps=10),
            processors=[
                ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt")
            ],
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
        3. Agent joins the call (background task)
        4. Return call credentials so frontend can join

        The agent runs as a background task — it watches the user's video,
        counts reps, and coaches form in real time via Gemini Realtime.
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

            # SDK sets agent_user_id lazily during full startup,
            # but create_call needs it immediately for server-side auth.
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
                "task": None,
            }

            # Launch agent in background — it joins the call and starts coaching
            task = asyncio.create_task(
                self._run_agent(session_id, agent, call, exercise)
            )
            self.active_agents[session_id]["task"] = task

            # Get call credentials for the frontend
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
        call,
        exercise: str,
    ):
        """
        Background task: Agent joins call and coaches until session ends.

        Follows the golf coach pattern:
          async with agent.join(call):
              await agent.llm.simple_response(text="...")
              await agent.finish()
        """
        try:
            # participant_wait_timeout=30 gives the phone enough time to
            # join and publish both audio + video tracks before the SDK
            # gives up waiting.
            async with agent.join(call, participant_wait_timeout=30.0):
                # Initial greeting — tell the user what to do
                try:
                    await agent.llm.simple_response(
                        text=(
                            f"Say hi as GymBro Coach. Tell the user you can see them "
                            f"through the camera and you're ready to coach them through "
                            f"{exercise.replace('_', ' ')}. Tell them to start their "
                            f"exercise when ready — you'll count every rep and watch "
                            f"their form. Be hyped and motivating."
                        )
                    )
                except Exception as greet_err:
                    print(f"[GymAgent] Greeting error (non-fatal): {greet_err}")

                # Run until call ends or session is stopped
                await agent.finish()

        except asyncio.CancelledError:
            print(f"[GymAgent] Session {session_id} cancelled")
        except Exception as e:
            # Log but don't crash — TimeoutError from track subscription is
            # handled internally by the SDK's event manager and logged as a
            # warning. If it bubbles up here the agent session is already over.
            print(f"[GymAgent] ✗ Agent error in session {session_id}: {e}")
            import traceback
            traceback.print_exc()


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
