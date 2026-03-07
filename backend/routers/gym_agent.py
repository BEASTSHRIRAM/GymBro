"""
GymBro — Gym Agent Router
REST endpoints to start/end Vision Agents coaching sessions via Stream video calls.
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from routers.auth import get_current_user
from services.stream_video_agent_service import get_gym_agent_service
from services.gymbro_context_service import get_context_service
from services.usage_service import check_quota, increment_usage

router = APIRouter(prefix="/gym-agent", tags=["gym-agent"])


class StartSessionRequest(BaseModel):
    exercise: str = "squat"
    call_type: str = "default"


class EndSessionRequest(BaseModel):
    session_id: str


# ── Start Training Session ───────────────────────────────────────────────────

@router.post("/start")
async def start_training(
    req: StartSessionRequest,
    user: dict = Depends(get_current_user),
):
    """
    Start a Vision Agents gym coaching session.
    Creates a Stream video call and launches the AI coach agent.
    Returns call credentials so the frontend can join.
    """
    user_id = str(user["_id"])

    # Check usage quota
    quota = await check_quota(user_id, "ai_trainer")
    if not quota["allowed"]:
        raise HTTPException(
            status_code=403,
            detail=f"AI Trainer limit reached ({quota['used']}/{quota['limit']} this month). Upgrade to Premium for more sessions."
        )

    service = get_gym_agent_service()

    if not service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Vision Agents SDK not available. Check server logs."
        )

    # Generate unique session ID
    import time
    session_id = f"gym_{user_id}_{req.exercise}_{int(time.time())}"

    result = await service.start_session(
        session_id=session_id,
        user_id=user_id,
        exercise=req.exercise,
        call_type=req.call_type,
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Increment usage on success
    await increment_usage(user_id, "ai_trainer")

    return result


# ── End Training Session ─────────────────────────────────────────────────────

@router.post("/end")
async def end_training(
    req: EndSessionRequest,
    user: dict = Depends(get_current_user),
):
    """
    End a coaching session. Saves training summary to GymBro context.
    """
    user_id = str(user["_id"])
    service = get_gym_agent_service()

    summary = await service.end_session(req.session_id)

    if "error" in summary:
        raise HTTPException(status_code=404, detail=summary["error"])

    # Save training summary to GymBro context
    context_service = get_context_service()
    await context_service.save_training_summary(user_id, summary)

    # Automatically log the workout summary to the external MCP Vector DB Memory!
    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        
        server_params = StdioServerParameters(command="uv", args=["run", "gymbro_mcp_server.py"], env=None)
        
        async def _log_to_mcp():
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    
                    # Convert dict summary to a nice readable text paragraph for Vector storage
                    summary_str = (
                        f"Workout: {summary.get('exercise', 'unknown')}. "
                        f"Duration: {summary.get('duration_seconds', 0)} seconds. "
                        f"Overall form score: {summary.get('avg_form_score', 0)}%. "
                        f"Faults observed: {', '.join(summary.get('unique_faults', [])) or 'None'}."
                    )
                    
                    await session.call_tool(
                        "log_workout_to_long_term_memory",
                        arguments={
                            "user_id": user_id, 
                            "timestamp": summary.get("timestamp", ""),
                            "summary": summary_str
                        }
                    )
                    print(f"[Router] ✓ Sent workout summary to MCP Vector DB")
        
        # Fire and forget in the background so we don't block the user's return
        asyncio.create_task(_log_to_mcp())
    except Exception as e:
        print(f"[Router] ⚠ Failed to log to MCP: {e}")

    return summary


# ── Check Agent Status ───────────────────────────────────────────────────────

@router.get("/status")
async def agent_status(user: dict = Depends(get_current_user)):
    """Check if Vision Agents SDK is available."""
    service = get_gym_agent_service()
    return {
        "available": service.is_available(),
        "active_sessions": len(service.active_agents),
    }


# ── Recent Sessions ──────────────────────────────────────────────────────────

@router.get("/sessions")
async def get_recent_sessions(
    user: dict = Depends(get_current_user),
    limit: int = 10,
):
    """
    Return the user's recent training sessions from GymBro context.
    Each session includes: exercise, duration, reps, form score, faults, timestamp.
    """
    user_id = str(user["_id"])
    context_service = get_context_service()

    ctx = await context_service.get_full_context(user_id)
    history = ctx.get("training_history", [])

    # Newest first, limited
    sessions = sorted(
        history,
        key=lambda s: s.get("timestamp", ""),
        reverse=True,
    )[:limit]

    # Serialize timestamps
    for s in sessions:
        if hasattr(s.get("timestamp"), "isoformat"):
            s["timestamp"] = s["timestamp"].isoformat()

    return {"sessions": sessions, "total": len(history)}
