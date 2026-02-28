"""
Vision Agents Router — AI Gym Trainer Sessions
Handles AI training sessions with real-time voice coaching via Vision Agents SDK
NOTE: This router is deprecated. Use WebSocket endpoint at /ws/vision-agents instead.
"""
import base64
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.vision_agents_sdk_service import VisionAgentsSDKService
from services.tts_service import get_coaching_audio

router = APIRouter(prefix="/vision-agents", tags=["vision-agents"])

# ─── Models ───────────────────────────────────────────────────────────────────
class StartSessionRequest(BaseModel):
    user_id: str
    exercise: str

class AnalyzeFrameRequest(BaseModel):
    session_id: str
    frame_base64: str
    exercise: str

class EndSessionRequest(BaseModel):
    session_id: str

class StartSessionResponse(BaseModel):
    session_id: str
    initial_message: str

class AnalyzeFrameResponse(BaseModel):
    rep_count: int
    form_score: float
    faults: list
    feedback: str
    audio_base64: str

class EndSessionResponse(BaseModel):
    total_reps: int
    avg_form_score: float
    feedback: str

# ─── Session Storage (in-memory for now) ───────────────────────────────────────
sessions = {}

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start-session", response_model=StartSessionResponse)
async def start_session(req: StartSessionRequest):
    """Start an AI training session with Vision Agents SDK"""
    try:
        session_id = f"va_{req.user_id}_{req.exercise}_{int(__import__('time').time())}"
        
        # Initialize session state
        sessions[session_id] = {
            "user_id": req.user_id,
            "exercise": req.exercise,
            "rep_count": 0,
            "form_scores": [],
            "all_faults": [],
        }
        
        initial_message = f"Let's work on your {req.exercise.replace('_', ' ')}! Show me your form and I'll give you real-time feedback."
        
        return StartSessionResponse(
            session_id=session_id,
            initial_message=initial_message
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-frame", response_model=AnalyzeFrameResponse)
async def analyze_frame(req: AnalyzeFrameRequest):
    """Analyze a frame from the camera and return form feedback"""
    try:
        if req.session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[req.session_id]
        
        # Decode frame
        frame_bytes = base64.b64decode(req.frame_base64)
        
        # Analyze with Vision Agents SDK
        vision_service = VisionAgentsSDKService()
        analysis = await vision_service.analyze_frame(frame_bytes, req.exercise)
        
        # Update session
        session["rep_count"] = analysis.get("rep_count", 0)
        session["form_scores"].append(analysis.get("form_score", 0))
        session["all_faults"].extend(analysis.get("faults", []))
        
        # Generate coaching feedback
        faults = analysis.get("faults", [])
        feedback = ""
        if faults:
            feedback = f"I noticed: {', '.join(faults)}. Focus on keeping proper form."
        else:
            feedback = "Great form! Keep it up!"
        
        # Generate audio
        audio_bytes = await get_coaching_audio(feedback)
        audio_base64 = base64.b64encode(audio_bytes).decode() if audio_bytes else ""
        
        return AnalyzeFrameResponse(
            rep_count=session["rep_count"],
            form_score=analysis.get("form_score", 0),
            faults=faults,
            feedback=feedback,
            audio_base64=audio_base64
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/end-session/{session_id}", response_model=EndSessionResponse)
async def end_session(session_id: str):
    """End an AI training session and return summary"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[session_id]
        
        # Calculate averages
        avg_form_score = sum(session["form_scores"]) / len(session["form_scores"]) if session["form_scores"] else 0
        total_reps = session["rep_count"]
        
        # Generate final feedback
        feedback = f"Great workout! You completed {total_reps} reps with an average form score of {avg_form_score:.1f}%."
        
        # Clean up session
        del sessions[session_id]
        
        return EndSessionResponse(
            total_reps=total_reps,
            avg_form_score=avg_form_score,
            feedback=feedback
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
