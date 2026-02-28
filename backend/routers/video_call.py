"""
GymBro — Video Call Router
REST API for WebRTC video calls with AI gym trainer
"""
import secrets
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import get_db
from services.video_call_service import get_video_call_service
from config import get_settings

router = APIRouter(prefix="/video-call", tags=["video-call"])
settings = get_settings()


class StartCallRequest(BaseModel):
    user_id: str
    exercise: str = "squat"


class StartCallResponse(BaseModel):
    call_id: str
    call_type: str
    exercise: str
    status: str
    user_token: str  # Token for frontend to join call


class EndCallResponse(BaseModel):
    call_id: str
    exercise: str
    duration_seconds: int
    total_reps: int
    avg_form_score: float


@router.post("/start", response_model=StartCallResponse)
async def start_video_call(req: StartCallRequest):
    """
    Start a new WebRTC video call with AI gym trainer
    
    Returns call_id and user_token that frontend uses to join the call via Stream SDK
    """
    try:
        # Generate unique call ID
        call_id = f"gymbro_{req.user_id}_{int(datetime.utcnow().timestamp())}"
        call_type = "default"
        
        # Generate user token for Stream Video SDK
        from stream_chat import StreamChat
        
        chat_client = StreamChat(
            api_key=settings.stream_api_key,
            api_secret=settings.stream_api_secret
        )
        
        # Create token for user to join call
        user_token = chat_client.create_token(req.user_id)
        
        # Create agent for this call
        video_service = get_video_call_service()
        await video_service.create_agent_for_call(
            call_id=call_id,
            call_type=call_type,
            exercise=req.exercise,
            user_id=req.user_id
        )
        
        return StartCallResponse(
            call_id=call_id,
            call_type=call_type,
            exercise=req.exercise,
            status="started",
            user_token=user_token
        )
        
    except Exception as e:
        print(f"[VideoCall] Error starting call: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start call: {str(e)}")


@router.post("/end/{call_id}", response_model=EndCallResponse)
async def end_video_call(call_id: str):
    """
    End a video call and get summary
    """
    try:
        video_service = get_video_call_service()
        summary = await video_service.end_call(call_id)
        
        # Save to MongoDB even if call failed
        db = get_db()
        await db["workout_sessions"].insert_one({
            "user_id": summary.get("user_id", "unknown"),
            "call_id": call_id,
            "exercise_name": summary.get("exercise", "unknown"),
            "reps": summary.get("total_reps", 0),
            "form_score": summary.get("avg_form_score", 0.0),
            "duration_seconds": summary.get("duration_seconds", 0),
            "created_at": datetime.utcnow(),
        })
        
        return EndCallResponse(**summary)
        
    except Exception as e:
        print(f"[VideoCall] Error ending call: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to end call: {str(e)}")


@router.get("/status/{call_id}")
async def get_call_status(call_id: str):
    """
    Get current status of a video call
    """
    video_service = get_video_call_service()
    status = video_service.get_call_status(call_id)
    
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Call not found")
    
    return status
