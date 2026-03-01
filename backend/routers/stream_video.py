"""
GymBro — Stream Video Router
REST endpoints for managing Stream video calls with AI coaching.
Uses the new GymAgentService (Vision Agents SDK).
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime

from services.stream_video_agent_service import get_gym_agent_service

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
    duration_seconds: int = 0


@router.post("/start-call", response_model=CallResponse)
async def start_video_call(request: StartCallRequest):
    """
    Start a new video coaching call via Vision Agents Agent.
    """
    try:
        service = get_gym_agent_service()

        # Generate IDs
        session_id = f"session_{datetime.utcnow().timestamp()}"
        call_id = f"call_{session_id}"

        # Start session
        result = await service.start_session(
            session_id=session_id,
            user_id=request.user_id,
            exercise=request.exercise,
            call_type=request.call_type,
        )

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return CallResponse(
            session_id=session_id,
            call_id=call_id,
            exercise=request.exercise,
            status="started",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[StreamVideo] Error starting call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/end-call/{session_id}")
async def end_video_call(session_id: str):
    """End a video coaching call and get summary."""
    try:
        service = get_gym_agent_service()
        summary = await service.end_session(session_id)

        if "error" in summary:
            raise HTTPException(status_code=404, detail=summary["error"])

        return summary

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
    """Get Stream call token for frontend."""
    try:
        from stream_chat import StreamChat
        from config import get_settings

        settings = get_settings()

        client = StreamChat(
            api_key=settings.stream_api_key,
            api_secret=settings.stream_api_secret,
        )

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

