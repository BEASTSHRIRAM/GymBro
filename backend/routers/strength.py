"""
GymBro — Strength Router
POST /strength/log          — Log a workout set
GET  /strength/predict/{exercise} — Get 1RM + 4/8-week projections
GET  /strength/history/{exercise} — Get workout log history
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from database import get_db
from routers.auth import get_current_user
from services.strength_service import estimate_1rm, predict_progression

router = APIRouter(prefix="/strength", tags=["strength"])


class WorkoutLogRequest(BaseModel):
    exercise_name: str
    weight_kg: float
    reps: int
    notes: str = ""


@router.post("/log")
async def log_workout(payload: WorkoutLogRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    one_rm = estimate_1rm(payload.weight_kg, payload.reps)

    log_entry = {
        "weight_kg": payload.weight_kg,
        "reps": payload.reps,
        "estimated_1rm": one_rm,
        "notes": payload.notes,
        "logged_at": datetime.utcnow(),
    }

    # Upsert the strength prediction doc for this user + exercise
    await db["strength_predictions"].update_one(
        {"user_id": user_id, "exercise_name": payload.exercise_name},
        {
            "$push": {"logs": log_entry},
            "$set": {"updated_at": datetime.utcnow()},
        },
        upsert=True,
    )

    return {"estimated_1rm": one_rm, "message": "Workout logged successfully"}


@router.get("/predict/{exercise_name}")
async def predict(exercise_name: str, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])

    doc = await db["strength_predictions"].find_one(
        {"user_id": user_id, "exercise_name": exercise_name}
    )
    if not doc or not doc.get("logs"):
        raise HTTPException(status_code=404, detail="No workout logs found for this exercise")

    result = predict_progression(doc["logs"])

    # Cache prediction back to DB
    await db["strength_predictions"].update_one(
        {"user_id": user_id, "exercise_name": exercise_name},
        {"$set": {
            "current_1rm": result["current_1rm"],
            "predicted_4_week": result["predicted_4_week"],
            "predicted_8_week": result["predicted_8_week"],
            "updated_at": datetime.utcnow(),
        }},
    )
    return result


@router.get("/history/{exercise_name}")
async def get_history(exercise_name: str, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    doc = await db["strength_predictions"].find_one(
        {"user_id": user_id, "exercise_name": exercise_name}
    )
    if not doc:
        return {"logs": []}
    return {"logs": doc.get("logs", []), "exercise_name": exercise_name}
