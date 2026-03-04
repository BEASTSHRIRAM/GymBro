"""
GymBro — Strength Router (Logging & Goals)
GET  /strength/data/{exercise_name}  — Get active goal and history logs
POST /strength/log                   — Log a workout set
POST /strength/goal                  — Set a new active goal
POST /strength/goal/complete         — Mark the active goal as completed
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/strength", tags=["strength"])

class WorkoutLogRequest(BaseModel):
    activity_type: str  # 'strength' or 'cardio'
    exercise_name: str
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    duration_minutes: Optional[int] = None
    distance_km: Optional[float] = None

class GoalRequest(BaseModel):
    activity_type: str
    exercise_name: str
    target_weight_kg: Optional[float] = None
    target_duration_minutes: Optional[int] = None
    target_distance_km: Optional[float] = None

class GoalCompleteRequest(BaseModel):
    activity_type: str
    exercise_name: str


@router.get("/data/{activity_type}/{exercise_name}")
async def get_strength_data(activity_type: str, exercise_name: str, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    
    doc = await db["strength_logs"].find_one({
        "user_id": user_id, 
        "activity_type": activity_type,
        "exercise_name": exercise_name
    })
    if not doc:
        return {"active_goal": None, "logs": [], "completed_goals": []}
        
    return {
        "active_goal": doc.get("active_goal"),
        "logs": sorted(doc.get("logs", []), key=lambda x: x["logged_at"], reverse=True),
        "completed_goals": sorted(doc.get("completed_goals", []), key=lambda x: x["completed_at"], reverse=True)
    }

@router.post("/log")
async def log_workout(payload: WorkoutLogRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    
    log_entry = {
        "id": str(uuid.uuid4()),
        "logged_at": datetime.utcnow()
    }
    
    if payload.activity_type == 'strength':
        log_entry["weight_kg"] = payload.weight_kg
        log_entry["reps"] = payload.reps
    else:
        log_entry["duration_minutes"] = payload.duration_minutes
        log_entry["distance_km"] = payload.distance_km
    
    await db["strength_logs"].update_one(
        {
            "user_id": user_id, 
            "activity_type": payload.activity_type, 
            "exercise_name": payload.exercise_name
        },
        {
            "$push": {"logs": log_entry},
            "$set": {"updated_at": datetime.utcnow()}
        },
        upsert=True
    )
    return {"message": "Workout logged successfully", "log": log_entry}

@router.post("/goal")
async def set_goal(payload: GoalRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    
    active_goal = {
        "created_at": datetime.utcnow()
    }
    
    if payload.activity_type == 'strength':
        active_goal["target_weight_kg"] = payload.target_weight_kg
    else:
        if payload.target_duration_minutes is not None:
            active_goal["target_duration_minutes"] = payload.target_duration_minutes
        if payload.target_distance_km is not None:
            active_goal["target_distance_km"] = payload.target_distance_km
    
    await db["strength_logs"].update_one(
        {
            "user_id": user_id, 
            "activity_type": payload.activity_type, 
            "exercise_name": payload.exercise_name
        },
        {
            "$set": {
                "active_goal": active_goal,
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    return {"message": "Goal set successfully", "active_goal": active_goal}

@router.post("/goal/complete")
async def complete_goal(payload: GoalCompleteRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    
    doc = await db["strength_logs"].find_one({
        "user_id": user_id, 
        "activity_type": payload.activity_type, 
        "exercise_name": payload.exercise_name
    })
    
    if not doc or not doc.get("active_goal"):
        return {"message": "No active goal found"}
        
    completed_goal = doc["active_goal"]
    completed_goal["completed_at"] = datetime.utcnow()
    
    await db["strength_logs"].update_one(
        {
            "user_id": user_id, 
            "activity_type": payload.activity_type, 
            "exercise_name": payload.exercise_name
        },
        {
            "$unset": {"active_goal": ""},
            "$push": {"completed_goals": completed_goal},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return {"message": "Goal marked as complete!"}
