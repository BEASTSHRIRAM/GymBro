"""
Vision Agents WebSocket Router — Real-Time AI Gym Trainer
Streams video frames via WebSocket, processes with Vision Agents SDK,
returns real-time pose detection + AI coaching feedback + voice query support
"""
import asyncio
import base64
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.vision_agents_sdk_service import VisionAgentsSDKService
from services.tts_service import get_coaching_audio
from services.stt_service import get_user_input_text
from services.gemini_service import generate_coaching_response

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
        self.conversation_history = []  # Track voice conversation for context
        print(f"[Vision Agents WS] Creating training session: {session_id}")
        self.vision_service = VisionAgentsSDKService()
        print(f"[Vision Agents WS] Vision service initialized (mock mode: {self.vision_service.use_mock})")

# ─── WebSocket Endpoint ────────────────────────────────────────────────────────

@router.websocket("/vision-agents/{session_id}/{user_id}/{exercise}")
async def websocket_vision_agents(websocket: WebSocket, session_id: str, user_id: str, exercise: str):
    """
    WebSocket endpoint for real-time Vision Agents streaming.
    
    Client sends frames:
    {"type": "frame", "frame_base64": "...", "timestamp": 1234567890}
    
    Client sends voice queries:
    {"type": "voice_query", "audio_base64": "...", "timestamp": 1234567890}
    
    Server responds with analysis:
    {"type": "analysis", "rep_count": 5, "form_score": 87.5, "faults": [...], "feedback": "...", "audio_base64": "..."}
    
    Server responds with voice:
    {"type": "voice_response", "transcript": "...", "response": "...", "audio_base64": "..."}
    """
    await websocket.accept()
    
    # Create session
    session = TrainingSession(session_id, user_id, exercise)
    active_sessions[session_id] = session
    
    # Send initial greeting with TTS
    greeting = f"Let's work on your {exercise.replace('_', ' ')}! Show me your form and I'll give you real-time feedback."
    greeting_audio_bytes = await get_coaching_audio(greeting)
    greeting_audio_b64 = base64.b64encode(greeting_audio_bytes).decode() if greeting_audio_bytes else ""
    
    await websocket.send_json({
        "type": "session_started",
        "session_id": session_id,
        "message": greeting,
        "audio_base64": greeting_audio_b64,
    })
    print(f"[Vision Agents WS] Session started: {session_id}, greeting audio: {len(greeting_audio_b64)} bytes")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            msg_type = data.get("type", "")
            
            # ── Handle video frame ─────────────────────────────────────────
            if msg_type == "frame":
                frame_base64 = data.get("frame_base64", "")
                
                if not frame_base64:
                    continue
                
                try:
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
                    
                    # Generate audio via ElevenLabs TTS (only when feedback changes)
                    audio_base64 = ""
                    if feedback != session.last_feedback or faults:
                        audio_bytes = await get_coaching_audio(feedback)
                        audio_base64 = base64.b64encode(audio_bytes).decode() if audio_bytes else ""
                    
                    print(f"[Vision Agents WS] ✓ Reps: {session.rep_count}, Form: {analysis.get('form_score', 0):.1f}%")
                    
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
                    print(f"[Vision Agents WS] ✗ Frame error: {e}")
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })
            
            # ── Handle voice query ─────────────────────────────────────────
            elif msg_type == "voice_query":
                audio_b64 = data.get("audio_base64", "")
                
                # Silently skip empty audio (happens in continuous listening gaps)
                if not audio_b64:
                    continue
                
                try:
                    # 1. Decode audio and transcribe via Deepgram STT
                    audio_bytes = base64.b64decode(audio_b64)
                    transcript = await get_user_input_text(audio_bytes)
                    
                    # Silently skip silence segments (no speech detected)
                    if not transcript or not transcript.strip():
                        continue
                    
                    print(f"[Vision Agents WS] 🎤 User said: '{transcript}'")
                    
                    # 2. Build context for AI response (with GymBro context)
                    avg_score = (
                        sum(session.form_scores) / len(session.form_scores)
                        if session.form_scores else 0
                    )
                    unique_faults = list(set(session.all_faults))
                    
                    # Inject GymBro context if available
                    gymbro_context = ""
                    try:
                        from services.gymbro_context_service import get_context_service
                        ctx_service = get_context_service()
                        user_ctx = await ctx_service.get_full_context(user_id)
                        gymbro_context = ctx_service.build_coaching_prompt(user_ctx, exercise)
                    except Exception:
                        pass  # Context is optional enhancement
                    
                    context = (
                        f"{gymbro_context} "
                        f"You are GymBro — a gym brotherhood companion. Be direct, motivating, real. "
                        f"Current session: {exercise.replace('_', ' ')}, "
                        f"{session.rep_count} reps, {avg_score:.1f}% avg form. "
                        f"Recent faults: {', '.join(unique_faults[-5:]) if unique_faults else 'none'}. "
                        f"Respond briefly (under 30 words), friendly and encouraging."
                    )
                    
                    # Add conversation history for context
                    history_text = ""
                    for turn in session.conversation_history[-3:]:
                        history_text += f"\nUser: {turn['user']}\nCoach: {turn['coach']}"
                    
                    prompt = f"{context}{history_text}\n\nUser asks: {transcript}\nCoach:"
                    
                    # 3. Generate response via Gemini
                    response_text = await generate_coaching_response(prompt)
                    if not response_text:
                        response_text = f"You're doing great with {session.rep_count} reps so far! Keep pushing!"
                    
                    print(f"[Vision Agents WS] AI response: '{response_text}'")
                    
                    # Save to conversation history
                    session.conversation_history.append({
                        "user": transcript,
                        "coach": response_text,
                    })
                    
                    # 4. Generate TTS audio for response
                    response_audio_bytes = await get_coaching_audio(response_text)
                    response_audio_b64 = base64.b64encode(response_audio_bytes).decode() if response_audio_bytes else ""
                    
                    print(f"[Vision Agents WS] Voice response audio: {len(response_audio_b64)} bytes")
                    
                    try:
                        await websocket.send_json({
                            "type": "voice_response",
                            "transcript": transcript,
                            "response": response_text,
                            "audio_base64": response_audio_b64,
                        })
                    except (WebSocketDisconnect, RuntimeError):
                        print("[Vision Agents WS] Client disconnected during voice response send")
                        break
                    
                except (WebSocketDisconnect, RuntimeError):
                    print("[Vision Agents WS] Client disconnected during voice processing")
                    break
                except Exception as e:
                    print(f"[Vision Agents WS] ✗ Voice query error: {e}")
                    try:
                        await websocket.send_json({
                            "type": "voice_response",
                            "transcript": "",
                            "response": "Sorry, I had trouble processing that. Try again!",
                            "audio_base64": "",
                        })
                    except (WebSocketDisconnect, RuntimeError):
                        break
            
            # ── Handle end session ─────────────────────────────────────────
            elif msg_type == "end_session":
                avg_form_score = sum(session.form_scores) / len(session.form_scores) if session.form_scores else 0
                
                # Save training summary to GymBro context
                try:
                    from services.gymbro_context_service import get_context_service
                    ctx_service = get_context_service()
                    await ctx_service.save_training_summary(user_id, {
                        "session_id": session_id,
                        "exercise": exercise,
                        "total_reps": session.rep_count,
                        "avg_form_score": avg_form_score,
                        "unique_faults": list(set(session.all_faults)),
                        "duration_seconds": 0,  # TODO: track duration
                    })
                except Exception as e:
                    print(f"[Vision Agents WS] Context save error: {e}")
                
                try:
                    await websocket.send_json({
                        "type": "session_ended",
                        "total_reps": session.rep_count,
                        "avg_form_score": avg_form_score,
                        "feedback": f"Great workout! {session.rep_count} reps with {avg_form_score:.1f}% form score."
                    })
                except (WebSocketDisconnect, RuntimeError):
                    pass
                break
    
    except WebSocketDisconnect:
        print(f"[Vision Agents WS] Client disconnected: {session_id}")
    
    except Exception as e:
        print(f"[Vision Agents WS] Error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except (WebSocketDisconnect, RuntimeError):
            pass
    
    finally:
        # Clean up
        if session_id in active_sessions:
            del active_sessions[session_id]
        try:
            await websocket.close()
        except Exception:
            pass

