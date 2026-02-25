"""
GymBro — Form Checker WebSocket Router
WS /ws/form-check/{session_id}

Client sends: JSON {"frame": "<base64_jpeg>", "exercise": "squat", "voice": true}
Server sends: JSON {"faults":[], "rep_count":0, "form_score":0, "joint_angles":{}, "feedback":"", "audio":"<base64_mp3>"}
"""
import json
import base64
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from bson import ObjectId

from database import get_db
from services.vision_service import analyze_frame
from services.gemini_service import generate_form_feedback_narrative
from services.tts_service import get_coaching_audio

router = APIRouter(tags=["form-checker"])

# Active session states: {session_id: {reps, position, last_feedback, ...}}
_sessions: dict[str, dict] = {}


@router.websocket("/ws/form-check/{session_id}")
async def form_check_ws(
    websocket: WebSocket,
    session_id: str,
    user_id: str = Query(...),
    exercise: str = Query("squat"),
):
    """
    Real-time AI form checker via WebSocket.
    - Accepts base64-encoded camera frames from Expo
    - Returns rep count, form score, fault list, AI feedback text + optional TTS audio
    """
    await websocket.accept()

    # Initialize session state
    _sessions[session_id] = {
        "reps": 0,
        "position": "up",
        "form_scores": [],
        "all_faults": [],
        "last_feedback": "",
        "voice_enabled": True,
        "exercise": exercise,
        "start_time": datetime.utcnow(),
    }
    state = _sessions[session_id]

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            frame_b64 = msg.get("frame", "")
            ex = msg.get("exercise", exercise)
            voice = msg.get("voice", True)
            state["voice_enabled"] = voice

            if not frame_b64:
                await websocket.send_json({"error": "No frame provided"})
                continue

            # ── Analyze frame via VisionAgents ──────────────────────────
            analysis = await analyze_frame(frame_b64, ex, state)

            faults = analysis["faults"]
            rep_count = analysis["rep_count"]
            form_score = analysis["form_score"]
            joint_angles = analysis["joint_angles"]

            state["form_scores"].append(form_score)
            state["all_faults"].extend(faults)

            # ── Generate feedback (throttle to every 5 reps or new fault) ──
            feedback_text = ""
            audio_b64 = ""

            if faults or rep_count % 5 == 0:
                feedback_text = await generate_form_feedback_narrative(faults, ex)
                state["last_feedback"] = feedback_text

                if voice and feedback_text and feedback_text != state.get("_last_tts", ""):
                    audio_bytes = await get_coaching_audio(feedback_text)
                    if audio_bytes:
                        audio_b64 = base64.b64encode(audio_bytes).decode()
                    state["_last_tts"] = feedback_text
            else:
                feedback_text = state.get("last_feedback", "Looking good!")

            # ── Send response ────────────────────────────────────────────
            await websocket.send_json({
                "rep_count": rep_count,
                "form_score": form_score,
                "faults": faults,
                "joint_angles": joint_angles,
                "feedback": feedback_text,
                "audio": audio_b64,  # base64 MP3 or ""
            })

    except WebSocketDisconnect:
        # ── Save session to MongoDB ──────────────────────────────────────
        await _save_session(session_id, user_id, exercise, state)
        _sessions.pop(session_id, None)
        print(f"[WS] Session {session_id} disconnected and saved")

    except Exception as e:
        print(f"[WS] Error in session {session_id}: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
        _sessions.pop(session_id, None)


async def _save_session(session_id: str, user_id: str, exercise: str, state: dict):
    """Persist completed session to MongoDB."""
    db = get_db()
    scores = state.get("form_scores", [])
    avg_score = sum(scores) / len(scores) if scores else 0.0

    session_doc = {
        "user_id": user_id,
        "session_id": session_id,
        "exercise_name": exercise,
        "reps": state.get("reps", 0),
        "form_score": round(avg_score, 1),
        "joint_metrics": {},
        "feedback_log": list(set(state.get("all_faults", []))),
        "duration_seconds": (datetime.utcnow() - state.get("start_time", datetime.utcnow())).seconds,
        "created_at": datetime.utcnow(),
    }
    await db["workout_sessions"].insert_one(session_doc)
