"""
GymBro — Subscription Router
GET  /subscription/plans    -- List available plans
POST /subscription/activate -- Mock-activate premium for a user
GET  /subscription/status   -- Current plan + usage quotas
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timedelta

from database import get_db
from routers.auth import get_current_user
from services.usage_service import get_all_usage

router = APIRouter(prefix="/subscription", tags=["subscription"])

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price": 0,
        "currency": "INR",
        "features": [
            "1 AI Trainer demo session",
            "1 diet plan generation",
            "1 workout split generation",
            "Basic activity logging",
            "Strength & cardio tracking",
        ],
    },
    {
        "id": "premium",
        "name": "GymBro Premium",
        "price": 499,
        "currency": "INR",
        "period": "month",
        "features": [
            "35 AI training sessions/month",
            "10 adaptive diet consultations",
            "10 supplement coach sessions",
            "Unlimited workout split regeneration",
            "Requirements-based AI splits",
            "Weekly AI consultation",
            "Priority support",
        ],
    },
]


@router.get("/plans")
async def get_plans():
    return {"plans": PLANS}


@router.post("/activate")
async def activate_premium(user: dict = Depends(get_current_user)):
    """Mock-activate premium subscription for 30 days."""
    db = get_db()
    user_id = user["_id"]
    now = datetime.utcnow()

    await db["users"].update_one(
        {"_id": user_id},
        {
            "$set": {
                "subscription_name": "GymBro Premium",
                "subscription_status": "ACTIVE",
                "subscription_start_date": now,
                "subscription_expiry_date": now + timedelta(days=30),
            }
        },
    )
    return {
        "message": "Premium activated successfully",
        "plan": "GymBro Premium",
        "expires_at": (now + timedelta(days=30)).isoformat(),
    }


@router.get("/status")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    user_id = str(user["_id"])
    usage_data = await get_all_usage(user_id)

    # Get subscription info from user doc
    sub_info = {
        "name": user.get("subscription_name", "Free"),
        "status": user.get("subscription_status", "INACTIVE"),
        "start_date": user.get("subscription_start_date"),
        "expiry_date": user.get("subscription_expiry_date"),
    }

    return {
        "subscription": sub_info,
        **usage_data,
    }
