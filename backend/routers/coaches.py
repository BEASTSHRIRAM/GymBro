"""
GymBro — Coaches Router
GET  /coaches/nearby   — Geo-search coaches
GET  /coaches/{id}     — Coach profile
POST /coaches/book     — Book a session (Stripe-ready placeholder)
POST /coaches/review   — Submit a rating/review
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from typing import Optional

from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/coaches", tags=["coaches"])


class BookingRequest(BaseModel):
    coach_id: str
    date: str        # ISO datetime string
    duration_min: int = 60
    notes: str = ""


class ReviewRequest(BaseModel):
    coach_id: str
    rating: float    # 1.0 - 5.0
    comment: str = ""


def serialize_coach(doc: dict, distance_km: Optional[float] = None) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    doc.pop("email", None)
    if distance_km is not None:
        doc["distance_km"] = round(distance_km, 2)
    return doc


@router.get("/nearby")
async def get_nearby_coaches(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius_km: float = Query(10.0, description="Search radius in km"),
    limit: int = Query(20, le=50),
):
    """
    MongoDB $nearSphere geo query for coaches within radius_km.
    Requires 2dsphere index on geo_location field.
    """
    db = get_db()
    radius_meters = radius_km * 1000

    try:
        cursor = db["coaches"].find({
            "geo_location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": radius_meters,
                }
            }
        }).limit(limit)
        coaches = []
        async for doc in cursor:
            coaches.append(serialize_coach(doc))
        return {"coaches": coaches, "count": len(coaches)}
    except Exception:
        # Fallback if 2dsphere index not created — return all coaches
        cursor = db["coaches"].find({}).limit(limit)
        coaches = []
        async for doc in cursor:
            coaches.append(serialize_coach(doc))
        return {"coaches": coaches, "count": len(coaches)}


@router.get("/{coach_id}")
async def get_coach(coach_id: str):
    db = get_db()
    try:
        oid = ObjectId(coach_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coach ID")
    coach = await db["coaches"].find_one({"_id": oid})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    return serialize_coach(coach)


@router.post("/book")
async def book_session(payload: BookingRequest, user: dict = Depends(get_current_user)):
    """
    Stripe-ready booking placeholder.
    Currently stores booking in MongoDB; payment processing to be added later.
    """
    db = get_db()
    user_id = str(user["_id"])

    try:
        coach_oid = ObjectId(payload.coach_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coach ID")

    coach = await db["coaches"].find_one({"_id": coach_oid})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    booking_doc = {
        "user_id": user_id,
        "coach_id": payload.coach_id,
        "date": payload.date,
        "duration_min": payload.duration_min,
        "notes": payload.notes,
        "status": "pending",           # pending | confirmed | cancelled
        "payment_status": "unpaid",    # Stripe: unpaid | paid | refunded
        "created_at": datetime.utcnow(),
    }
    result = await db["bookings"].insert_one(booking_doc)
    return {
        "booking_id": str(result.inserted_id),
        "status": "pending",
        "message": "Booking created. Payment integration coming soon.",
    }


@router.post("/review")
async def submit_review(payload: ReviewRequest, user: dict = Depends(get_current_user)):
    db = get_db()

    if not (1.0 <= payload.rating <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")

    try:
        coach_oid = ObjectId(payload.coach_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid coach ID")

    # Update coach's rating (rolling average)
    coach = await db["coaches"].find_one({"_id": coach_oid})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    old_rating = coach.get("rating", 5.0)
    review_count = coach.get("review_count", 0)
    new_count = review_count + 1
    new_rating = round((old_rating * review_count + payload.rating) / new_count, 2)

    await db["coaches"].update_one(
        {"_id": coach_oid},
        {"$set": {"rating": new_rating, "review_count": new_count}},
    )

    # Store the review
    await db["reviews"].insert_one({
        "user_id": str(user["_id"]),
        "coach_id": payload.coach_id,
        "rating": payload.rating,
        "comment": payload.comment,
        "created_at": datetime.utcnow(),
    })

    return {"new_rating": new_rating, "message": "Review submitted"}
