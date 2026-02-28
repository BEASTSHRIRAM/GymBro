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
from services.vision_agents_video_service import get_video_agent
from services.tts_service import get_coaching_audio

router = APIRouter(tags=["form-checker"])

# Active session states: {session_id: {last_tts, ...}}
_sessions: dict[str, dict] = {}


@router.websocket("/ws/form-check/{session_id}")
async def form_check_ws(
    websocket: WebSocket,
    session_id: str,
    user_id: str = Query(...),
    exercise: str = Query("squat"),
):
    """
    Real-time AI form checker via WebSocket with Vision Agents Video Agent.
    - Accepts base64-encoded camera frames from Expo Camera
    - Returns rep count, form score, fault list, AI feedback text + optional TTS audio
    """
    await websocket.accept()
    print(f"[WS] Session {session_id} connected for {exercise}")

    # Initialize Vision Agents Video Agent
    try:
        video_agent = get_video_agent()
        await video_agent.start_session(session_id, user_id, exercise)
        print(f"[WS] Video Agent initialized for session {session_id}")
    except ImportError as e:
        print(f"[WS] Vision Agents SDK error: {e}")
        await websocket.send_json({"error": f"Vision Agents SDK not available: {str(e)}"})
        await websocket.close()
        return
    except Exception as e:
        print(f"[WS] Video Agent init error: {e}")
        import traceback
        traceback.print_exc()
        await websocket.send_json({"error": f"Video Agent initialization failed: {str(e)}"})
        await websocket.close()
        return

    # Initialize session state for TTS tracking
    _sessions[session_id] = {
        "last_tts": "",
        "voice_enabled": True,
    }
    state = _sessions[session_id]

    try:
        frame_count = 0
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            frame_b64 = msg.get("frame", "")
            ex = msg.get("exercise", exercise)
            voice = msg.get("voice", True)
            state["voice_enabled"] = voice
            frame_count += 1

            if not frame_b64:
                print(f"[WS] No frame provided in message")
                await websocket.send_json({"error": "No frame provided"})
                continue

            try:
                # ── Analyze frame via Vision Agents Video Agent ──────────────────
                print(f"[WS] Processing frame {frame_count} for session {session_id}")
                analysis = await video_agent.process_frame(session_id, frame_b64, ex)

                faults = analysis.get("faults", [])
                rep_count = analysis.get("rep_count", 0)
                form_score = analysis.get("form_score", 0.0)
                joint_angles = analysis.get("joint_angles", {})
                feedback_text = analysis.get("feedback", "")

                # Validate data
                if rep_count is None or form_score is None:
                    print(f"[WS] Invalid analysis data: rep_count={rep_count}, form_score={form_score}")
                    rep_count = rep_count or 0
                    form_score = form_score or 0.0

                # ── Generate TTS audio ──────────────────────────────────────────
                audio_b64 = ""
                
                if voice and feedback_text and feedback_text != state.get("last_tts", ""):
                    try:
                        audio_bytes = await get_coaching_audio(feedback_text)
                        if audio_bytes:
                            audio_b64 = base64.b64encode(audio_bytes).decode()
                        state["last_tts"] = feedback_text
                    except Exception as tts_err:
                        print(f"[WS] TTS error: {tts_err}")
                        # Continue without audio

                # ── Send response ────────────────────────────────────────────
                response = {
                    "rep_count": int(rep_count) if rep_count is not None else 0,
                    "form_score": float(form_score) if form_score is not None else 0.0,
                    "faults": faults if isinstance(faults, list) else [],
                    "joint_angles": joint_angles if isinstance(joint_angles, dict) else {},
                    "feedback": feedback_text if isinstance(feedback_text, str) else "",
                    "audio": audio_b64,
                }
                
                print(f"[WS] Sending response: reps={response['rep_count']}, score={response['form_score']}")
                await websocket.send_json(response)

            except Exception as frame_err:
                print(f"[WS] Frame processing error: {frame_err}")
                import traceback
                traceback.print_exc()
                
                # Send error response but keep connection alive
                try:
                    await websocket.send_json({
                        "rep_count": 0,
                        "form_score": 0.0,
                        "faults": [],
                        "joint_angles": {},
                        "feedback": f"Error: {str(frame_err)[:50]}",
                        "audio": "",
                    })
                except Exception:
                    pass

    except WebSocketDisconnect:
        # ── End session and save to MongoDB ──────────────────────────────
        try:
            summary = await video_agent.end_session(session_id)
            await _save_session(session_id, user_id, exercise, summary)
            print(f"[WS] Session {session_id} disconnected and saved - {frame_count} frames processed")
        except Exception as save_err:
            print(f"[WS] Error saving session: {save_err}")
        finally:
            _sessions.pop(session_id, None)

    except Exception as e:
        print(f"[WS] Unexpected error in session {session_id}: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
        _sessions.pop(session_id, None)


async def _save_session(session_id: str, user_id: str, exercise: str, summary: dict):
    """Persist completed session to MongoDB."""
    db = get_db()

    session_doc = {
        "user_id": user_id,
        "session_id": session_id,
        "exercise_name": exercise,
        "reps": summary.get("total_reps", 0),
        "form_score": summary.get("avg_form_score", 0.0),
        "joint_metrics": {},
        "feedback_log": summary.get("unique_faults", []),
        "duration_seconds": summary.get("duration_seconds", 0),
        "frame_count": summary.get("frame_count", 0),
        "created_at": datetime.utcnow(),
    }
    await db["workout_sessions"].insert_one(session_doc)
