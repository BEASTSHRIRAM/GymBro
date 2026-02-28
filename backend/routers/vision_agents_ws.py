"""
Vision Agents WebSocket Router — Real-Time AI Gym Trainer
Streams video frames via WebSocket, processes with Vision Agents SDK,
returns real-time pose detection + AI coaching feedback
"""
import asyncio
import base64
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.vision_agents_sdk_service import VisionAgentsSDKService
from services.tts_service import get_coaching_audio

router = APIRouter(prefix="/ws", tags=["websocket"])

# ─── Session Storage ───────────────────────────────────────────────────────────
active_sessions = {}

class TrainingSession:
    def __init__(self, session_id: str, user_id: str, exercise: str):
        self.session_id = session_id
        self.user_id = user_id
        self.exercise = exercise
        self.rep_count = 0
        self.form_scores = []
        self.all_faults = []
        self.last_feedback = ""
        self.vision_service = VisionAgentsSDKService()

# ─── WebSocket Endpoint ────────────────────────────────────────────────────────

@router.websocket("/vision-agents/{session_id}/{user_id}/{exercise}")
async def websocket_vision_agents(websocket: WebSocket, session_id: str, user_id: str, exercise: str):
    """
    WebSocket endpoint for real-time Vision Agents streaming.
    
    Client sends:
    {
        "type": "frame",
        "frame_base64": "...",
        "timestamp": 1234567890
    }
    
    Server responds:
    {
        "type": "analysis",
        "rep_count": 5,
        "form_score": 87.5,
        "faults": ["knee_not_aligned"],
        "feedback": "Keep your knees aligned with your toes",
        "audio_base64": "..."
    }
    """
    await websocket.accept()
    
    # Create session
    session = TrainingSession(session_id, user_id, exercise)
    active_sessions[session_id] = session
    
    # Send initial message
    await websocket.send_json({
        "type": "session_started",
        "session_id": session_id,
        "message": f"Let's work on your {exercise.replace('_', ' ')}! Show me your form and I'll give you real-time feedback."
    })
    
    try:
        while True:
            # Receive frame from client
            data = await websocket.receive_json()
            
            if data.get("type") == "frame":
                frame_base64 = data.get("frame_base64", "")
                
                if not frame_base64:
                    print(f"[Vision Agents WS] Empty frame received, skipping")
                    continue
                
                print(f"[Vision Agents WS] Processing frame for {exercise} (size: {len(frame_base64)} bytes)")
                
                try:
                    # Analyze with Vision Agents SDK (pass base64 directly)
                    analysis = await session.vision_service.analyze_frame(
                        frame_base64,
                        exercise,
                        {
                            "rep_count": session.rep_count,
                            "form_scores": session.form_scores,
                            "all_faults": session.all_faults,
                        }
                    )
                    
                    # Update session
                    session.rep_count = analysis.get("rep_count", 0)
                    session.form_scores.append(analysis.get("form_score", 0))
                    session.all_faults.extend(analysis.get("faults", []))
                    
                    # Generate coaching feedback
                    faults = analysis.get("faults", [])
                    feedback = ""
                    
                    if faults:
                        fault_text = ", ".join([f.replace("_", " ") for f in faults])
                        feedback = f"I noticed: {fault_text}. Focus on proper form."
                    else:
                        feedback = "Great form! Keep it up!"
                    
                    session.last_feedback = feedback
                    
                    # Generate audio
                    audio_bytes = await get_coaching_audio(feedback)
                    audio_base64 = base64.b64encode(audio_bytes).decode() if audio_bytes else ""
                    
                    print(f"[Vision Agents WS] Analysis complete - Reps: {session.rep_count}, Form: {analysis.get('form_score', 0):.1f}%, Audio: {len(audio_base64)} bytes")
                    
                    # Send analysis back to client
                    await websocket.send_json({
                        "type": "analysis",
                        "rep_count": session.rep_count,
                        "form_score": analysis.get("form_score", 0),
                        "faults": faults,
                        "feedback": feedback,
                        "audio_base64": audio_base64,
                        "timestamp": data.get("timestamp")
                    })
                    
                except Exception as e:
                    print(f"[Vision Agents WS] Frame analysis error: {e}")
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })
            
            elif data.get("type") == "end_session":
                # Calculate final stats
                avg_form_score = sum(session.form_scores) / len(session.form_scores) if session.form_scores else 0
                
                await websocket.send_json({
                    "type": "session_ended",
                    "total_reps": session.rep_count,
                    "avg_form_score": avg_form_score,
                    "feedback": f"Great workout! {session.rep_count} reps with {avg_form_score:.1f}% form score."
                })
                break
    
    except WebSocketDisconnect:
        print(f"[Vision Agents WS] Client disconnected: {session_id}")
    
    except Exception as e:
        print(f"[Vision Agents WS] Error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
    
    finally:
        # Clean up
        if session_id in active_sessions:
            del active_sessions[session_id]
        await websocket.close()
