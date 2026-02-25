"""
GymBro — Gamification Router
GET  /gamification/profile     — XP, rank, streak, badges
POST /gamification/award-xp    — Award XP for an activity
GET  /gamification/leaderboard — Top 20 users by XP (MongoDB, no Redis)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from database import get_db
from routers.auth import get_current_user
from services.gamification_service import (
    get_rank, calculate_xp_award, update_streak,
    get_earned_badges, build_badge_list, XP_REWARDS,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])


class AwardXPRequest(BaseModel):
    activity: str   # e.g. "workout_complete", "diet_generated"
    form_score: float = 0.0


@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])

    xp = user.get("xp", 0)
    streak = user.get("streak_count", 0)
    rank = get_rank(xp)

    # Count total workouts for badges
    workout_count = await db["workout_sessions"].count_documents({"user_id": user_id})

    # Best form score
    best_form_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "best": {"$max": "$form_score"}}},
    ]
    agg = await db["workout_sessions"].aggregate(best_form_pipeline).to_list(1)
    best_form = agg[0]["best"] if agg else 0.0

    earned_keys = get_earned_badges(xp, streak, workout_count, best_form)
    badges = build_badge_list(earned_keys)

    # Ensure rank is synced in DB
    if user.get("rank") != rank:
        await db["users"].update_one({"_id": user["_id"]}, {"$set": {"rank": rank}})

    return {
        "xp": xp,
        "rank": rank,
        "streak_count": streak,
        "workout_count": workout_count,
        "best_form_score": best_form,
        "badges": badges,
    }


@router.post("/award-xp")
async def award_xp(payload: AwardXPRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    uid = user["_id"]

    if payload.activity == "workout_complete":
        xp_gain = calculate_xp_award(payload.form_score)

        # Streak update
        last_date = user.get("last_workout_date")
        increment, _ = update_streak(last_date)
        now = datetime.utcnow()

        update_fields: dict = {
            "last_workout_date": now,
        }

        # If streak broken (more than 1 day gap), reset to 1
        if last_date:
            from datetime import timedelta
            last = last_date if isinstance(last_date, datetime) else datetime.fromisoformat(str(last_date))
            delta = (now.date() - last.date()).days
            if delta > 1:
                update_fields["streak_count"] = 1
            elif delta == 1:
                update_fields["streak_count"] = user.get("streak_count", 0) + 1
                # Weekly streak bonus every 7 days
                new_streak = update_fields["streak_count"]
                if new_streak % 7 == 0:
                    xp_gain += XP_REWARDS["weekly_streak"]
                else:
                    xp_gain += XP_REWARDS["daily_streak"]
        else:
            update_fields["streak_count"] = 1
            xp_gain += XP_REWARDS["daily_streak"]

    else:
        xp_gain = XP_REWARDS.get(payload.activity, 0)
        update_fields = {}

    total_xp = user.get("xp", 0) + xp_gain
    new_rank = get_rank(total_xp)
    update_fields["xp"] = total_xp
    update_fields["rank"] = new_rank

    await db["users"].update_one({"_id": uid}, {"$set": update_fields})

    return {
        "xp_gained": xp_gain,
        "total_xp": total_xp,
        "new_rank": new_rank,
    }


@router.get("/leaderboard")
async def get_leaderboard():
    """Top 20 users by XP — MongoDB query (no Redis)."""
    db = get_db()
    cursor = db["users"].find(
        {"is_verified": True},
        {"_id": 1, "name": 1, "xp": 1, "rank": 1, "streak_count": 1},
    ).sort("xp", -1).limit(20)

    leaderboard = []
    rank_pos = 1
    async for doc in cursor:
        leaderboard.append({
            "position": rank_pos,
            "user_id": str(doc["_id"]),
            "name": doc.get("name", "Athlete"),
            "xp": doc.get("xp", 0),
            "rank": doc.get("rank", "Beginner"),
            "streak_count": doc.get("streak_count", 0),
        })
        rank_pos += 1

    return {"leaderboard": leaderboard}
