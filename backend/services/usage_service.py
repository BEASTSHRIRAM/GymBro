"""
GymBro — Usage Tracking Service
Tracks per-user, per-feature usage counts on a monthly basis.
Enforces quota limits based on subscription tier (free vs premium).
"""
from datetime import datetime
from database import get_db

# Quota limits per feature
QUOTAS = {
    "free": {
        "ai_trainer": 1,
        "diet_coach": 1,
        "supplement_coach": 0,
        "workout_split": 1,
    },
    "premium": {
        "ai_trainer": 35,
        "diet_coach": 10,
        "supplement_coach": 10,
        "workout_split": 999,  # effectively unlimited
    },
}


def _month_key() -> str:
    """Returns current year-month string, e.g. '2026-03'."""
    return datetime.utcnow().strftime("%Y-%m")


async def get_user_tier(user_id: str) -> str:
    """Check subscription status and return 'premium' or 'free'."""
    db = get_db()
    user = await db["users"].find_one({"_id": user_id})
    if not user:
        # Also check with ObjectId
        from bson import ObjectId
        user = await db["users"].find_one({"_id": ObjectId(user_id)})

    if not user:
        return "free"

    status = (user.get("subscription_status") or "").upper()
    if status == "ACTIVE":
        # Check expiry
        expiry = user.get("subscription_expiry_date")
        if expiry and expiry > datetime.utcnow():
            return "premium"
    return "free"


async def check_quota(user_id: str, feature: str) -> dict:
    """
    Check if the user has remaining quota for a feature.
    Returns: {"allowed": bool, "used": int, "limit": int, "tier": str}
    """
    db = get_db()
    tier = await get_user_tier(user_id)
    limit = QUOTAS.get(tier, QUOTAS["free"]).get(feature, 0)
    month = _month_key()

    doc = await db["usage_tracking"].find_one({
        "user_id": user_id,
        "feature": feature,
        "month": month,
    })
    used = doc["count"] if doc else 0

    return {
        "allowed": used < limit,
        "used": used,
        "limit": limit,
        "tier": tier,
    }


async def increment_usage(user_id: str, feature: str) -> int:
    """Increment usage count for a feature. Returns new count."""
    db = get_db()
    month = _month_key()

    result = await db["usage_tracking"].find_one_and_update(
        {"user_id": user_id, "feature": feature, "month": month},
        {
            "$inc": {"count": 1},
            "$set": {"updated_at": datetime.utcnow()},
        },
        upsert=True,
        return_document=True,
    )
    return result["count"]


async def get_all_usage(user_id: str) -> dict:
    """Get all usage counts for the current month."""
    db = get_db()
    tier = await get_user_tier(user_id)
    month = _month_key()
    limits = QUOTAS.get(tier, QUOTAS["free"])

    cursor = db["usage_tracking"].find({
        "user_id": user_id,
        "month": month,
    })
    usage_docs = await cursor.to_list(length=20)

    usage = {}
    for feature, limit in limits.items():
        doc = next((d for d in usage_docs if d["feature"] == feature), None)
        used = doc["count"] if doc else 0
        usage[feature] = {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
        }

    return {"tier": tier, "month": month, "usage": usage}
