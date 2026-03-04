"""
GymBro — Diet Router
POST /diet/generate    — Generate AI meal plan (async via Gemini)
GET  /diet/current     — Get current diet plan
PUT  /diet/update      — Update a meal
POST /diet/supplement  — AI supplement recommendations (Premium)
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db
from models import DietInput
from routers.auth import get_current_user
from services.diet_service import compute_diet_targets
from services.gemini_service import generate_meal_plan, generate_supplement_advice
from services.usage_service import check_quota, increment_usage

router = APIRouter(prefix="/diet", tags=["diet"])


class SupplementRequest(BaseModel):
    requirements: str


@router.post("/generate")
async def generate_diet(
    payload: DietInput,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = str(user["_id"])

    # Check usage quota
    quota = await check_quota(user_id, "diet_coach")
    if not quota["allowed"]:
        raise HTTPException(
            status_code=403,
            detail=f"Diet Coach limit reached ({quota['used']}/{quota['limit']} this month). Upgrade to Premium for more."
        )

    targets = compute_diet_targets(
        weight_kg=payload.weight,
        height_cm=payload.height,
        age=payload.age,
        gender=payload.gender,
        activity_level=payload.activity_level,
        goal=payload.goal,
    )

    plan_doc = {
        "user_id": user_id,
        "calories": targets["calories"],
        "protein_g": targets["protein_g"],
        "carbs_g": targets["carbs_g"],
        "fat_g": targets["fat_g"],
        "meals": [],
        "status": "generating",
        "generated_at": datetime.utcnow(),
    }
    await db["diet_plans"].find_one_and_replace(
        {"user_id": user_id},
        plan_doc,
        upsert=True,
        return_document=True,
    )

    # Increment usage
    await increment_usage(user_id, "diet_coach")

    background_tasks.add_task(
        _generate_and_save_meals,
        user_id=user_id,
        calories=targets["calories"],
        protein_g=targets["protein_g"],
        carbs_g=targets["carbs_g"],
        fat_g=targets["fat_g"],
        goal=payload.goal,
    )

    return {
        "status": "generating",
        "targets": targets,
        "message": "Meal plan is being generated. Poll /diet/current in ~5 seconds.",
    }


async def _generate_and_save_meals(
    user_id: str,
    calories: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    goal: str,
):
    db = get_db()
    try:
        meals = await generate_meal_plan(calories, protein_g, carbs_g, fat_g, goal)
        await db["diet_plans"].update_one(
            {"user_id": user_id},
            {"$set": {"meals": meals, "status": "ready"}},
        )
    except Exception as e:
        print(f"[Diet] Meal generation failed: {e}")
        await db["diet_plans"].update_one(
            {"user_id": user_id},
            {"$set": {"status": "error"}},
        )


@router.get("/current")
async def get_current_plan(user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    plan = await db["diet_plans"].find_one({"user_id": user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="No diet plan found. Generate one first.")
    plan["id"] = str(plan.pop("_id"))
    return plan


@router.put("/meal/{meal_index}")
async def update_meal(
    meal_index: int,
    meal: dict,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = str(user["_id"])
    plan = await db["diet_plans"].find_one({"user_id": user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="No diet plan found")
    meals = plan.get("meals", [])
    if meal_index < 0 or meal_index >= len(meals):
        raise HTTPException(status_code=400, detail="Invalid meal index")
    meals[meal_index] = meal
    await db["diet_plans"].update_one({"user_id": user_id}, {"$set": {"meals": meals}})
    return {"message": "Meal updated"}


@router.post("/supplement")
async def get_supplement_advice(
    payload: SupplementRequest,
    user: dict = Depends(get_current_user),
):
    """AI-powered supplement recommendations based on user requirements (Premium only)."""
    user_id = str(user["_id"])

    quota = await check_quota(user_id, "supplement_coach")
    if not quota["allowed"]:
        raise HTTPException(
            status_code=403,
            detail="Supplement Coach is a Premium feature. Subscribe to get personalized supplement advice."
        )

    try:
        advice = await generate_supplement_advice(payload.requirements)
        await increment_usage(user_id, "supplement_coach")
        return {"advice": advice}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI service error: {str(e)}")
