"""
GymBro — Stream Video Router
REST endpoints for managing Stream video calls with AI coaching
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime

from services.stream_video_agent_service import get_stream_coach

router = APIRouter(prefix="/api/stream", tags=["stream-video"])


class StartCallRequest(BaseModel):
    """Request to start a video coaching call"""
    user_id: str
    exercise: str  # squat, bench_press, deadlift, shoulder_press
    call_type: str = "default"


class CallResponse(BaseModel):
    """Response with call details"""
    session_id: str
    call_id: str
    exercise: str
    status: str


class SessionSummary(BaseModel):
    """Session summary after call ends"""
    session_id: str
    exercise: str
    total_reps: int
    avg_form_score: float
    duration_seconds: int
    unique_faults: list[str]


@router.post("/start-call", response_model=CallResponse)
async def start_video_call(request: StartCallRequest):
    """
    Start a new video coaching call
    
    Args:
        request: Call start request with user_id, exercise, call_type
        
    Returns:
        Call details including session_id and call_id
    """
    try:
        coach = get_stream_coach()
        
        # Generate IDs
        session_id = f"session_{datetime.utcnow().timestamp()}"
        call_id = f"call_{session_id}"
        
        # Start session
        result = await coach.start_session(
            session_id=session_id,
            user_id=request.user_id,
            exercise=request.exercise,
            call_type=request.call_type,
        )
        
        return CallResponse(
            session_id=session_id,
            call_id=call_id,
            exercise=request.exercise,
            status="started",
        )
        
    except Exception as e:
        print(f"[StreamVideo] Error starting call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/end-call/{session_id}", response_model=SessionSummary)
async def end_video_call(session_id: str):
    """
    End a video coaching call and get summary
    
    Args:
        session_id: Session identifier
        
    Returns:
        Session summary with stats
    """
    try:
        coach = get_stream_coach()
        summary = await coach.end_session(session_id)
        
        if "error" in summary:
            raise HTTPException(status_code=404, detail=summary["error"])
        
        return SessionSummary(**summary)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[StreamVideo] Error ending call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/call-token")
async def get_call_token(
    user_id: str = Query(...),
    call_id: str = Query(...),
):
    """
    Get Stream call token for frontend
    
    Args:
        user_id: User identifier
        call_id: Call identifier
        
    Returns:
        Token for joining the call
    """
    try:
        from stream_chat import StreamChat
        from config import get_settings
        
        settings = get_settings()
        
        # Initialize Stream client
        client = StreamChat(
            api_key=settings.stream_api_key,
            api_secret=settings.stream_api_secret,
        )
        
        # Generate token
        token = client.create_token(user_id)
        
        return {
            "token": token,
            "user_id": user_id,
            "call_id": call_id,
            "api_key": settings.stream_api_key,
        }
        
    except Exception as e:
        print(f"[StreamVideo] Error generating token: {e}")
        raise HTTPException(status_code=500, detail=str(e))
