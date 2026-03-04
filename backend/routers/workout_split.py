"""
GymBro — Workout Split Router
POST /api/workout-split/generate — Generate AI workout split using Gemini
PUT /api/workout-split — Save workout split to user profile
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
import asyncio

from database import get_db
from models import WorkoutSplitGenerateRequest, WorkoutSplit
from routers.auth import get_current_user
from services.gemini_service import generate_workout_split
from services.usage_service import check_quota, increment_usage

router = APIRouter(prefix="/api/workout-split", tags=["workout-split"])


@router.post("/generate")
async def generate_workout_split_endpoint(
    request: WorkoutSplitGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a personalized workout split using Gemini AI.
    
    - Validates authentication token (handled by get_current_user dependency)
    - Validates WorkoutSplitGenerateRequest (Pydantic validation)
    - Calls Gemini service with user stats (age, weight, height, goal, activity_level)
    - Returns generated WorkoutSplit
    - Handles timeout (408), service unavailable (503), invalid response errors
    
    Requirements: 13.4, 7.1, 7.2, 7.3, 7.4, 15.1, 15.2, 15.3
    """
    # Prepare user stats dictionary for Gemini service
    user_stats = {
        "age": request.age,
        "weight": request.weight,
        "height": request.height,
        "goal": request.goal,
        "activity_level": request.activity_level,
    }

    user_id = str(current_user["_id"])

    # Check usage quota
    quota = await check_quota(user_id, "workout_split")
    if not quota["allowed"]:
        raise HTTPException(
            status_code=403,
            detail=f"Workout Split limit reached ({quota['used']}/{quota['limit']} this month). Upgrade to Premium for unlimited splits."
        )
    
    try:
        # Call Gemini service to generate workout split
        requirements = getattr(request, 'requirements', None)
        workout_split = await generate_workout_split(user_stats, requirements=requirements)

        # Increment usage on success
        await increment_usage(user_id, "workout_split")
        
        # Return the generated workout split
        return workout_split
        
    except TimeoutError as e:
        # Handle timeout (10 seconds)
        raise HTTPException(
            status_code=408,
            detail="Request timed out, please try again"
        )
        
    except ValueError as e:
        # Handle invalid response from Gemini
        raise HTTPException(
            status_code=503,
            detail="AI service returned invalid data, please try again"
        )
        
    except Exception as e:
        # Handle service unavailable or other errors
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable"
        )


@router.put("")
async def save_workout_split(
    workout_split: WorkoutSplit,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Save workout split to user profile.
    
    - Validates authentication token (handled by get_current_user dependency)
    - Validates WorkoutSplit structure (Pydantic validation)
    - Updates user document with workout_split field
    - Returns success confirmation
    
    Requirements: 13.5, 7.7, 18.5
    """
    # Convert WorkoutSplit to dictionary for MongoDB storage
    workout_split_dict = workout_split.model_dump()
    
    # Update user document in MongoDB
    result = await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"workout_split": workout_split_dict}}
    )
    
    # Check if update was successful
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return success confirmation
    return {
        "message": "Workout split saved successfully",
        "workout_split": workout_split_dict
    }
