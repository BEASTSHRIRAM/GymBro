"""
GymBro — Profile Router
GET /api/profile  — Get user profile with subscription status
POST /api/profile/picture — Upload profile picture
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime
from bson import ObjectId
import base64
import io
from PIL import Image

from database import get_db
from models import ProfileResponse, ProfileUpdate
from routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["profile"])


def calculate_subscription_status(expiry_date: datetime | None) -> str:
    """
    Calculate subscription status based on expiry date.
    
    Returns:
        - "ACTIVE" if expiry is in the future
        - "EXPIRING TODAY" if expiry is today
        - "EXPIRED" if expiry is in the past
        - "INACTIVE" if no expiry date
    """
    if not expiry_date:
        return "INACTIVE"
    
    now = datetime.utcnow()
    # Compare dates only (ignore time)
    expiry_date_only = expiry_date.replace(hour=0, minute=0, second=0, microsecond=0)
    now_date_only = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if expiry_date_only > now_date_only:
        return "ACTIVE"
    elif expiry_date_only == now_date_only:
        return "EXPIRING TODAY"
    else:
        return "EXPIRED"


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """
    Get user profile with all fields including subscription status.
    
    - Validates authentication token (handled by get_current_user dependency)
    - Fetches user profile data from MongoDB
    - Calculates subscription status based on expiry date
    - Returns ProfileResponse with all fields
    
    Requirements: 13.1, 13.6, 13.7, 20.1, 20.2, 20.3, 20.5
    """
    # Calculate subscription status
    subscription_status = calculate_subscription_status(
        current_user.get("subscription_expiry_date")
    )
    
    # Build subscription object if subscription data exists
    subscription = None
    if current_user.get("subscription_name"):
        subscription = {
            "name": current_user.get("subscription_name"),
            "status": subscription_status,
            "start_date": current_user.get("subscription_start_date").isoformat() if current_user.get("subscription_start_date") else None,
            "expiry_date": current_user.get("subscription_expiry_date").isoformat() if current_user.get("subscription_expiry_date") else None,
        }
    
    # Build and return profile response
    return ProfileResponse(
        id=str(current_user["_id"]),
        name=current_user["name"],
        email=current_user["email"],
        profile_picture_url=current_user.get("profile_picture_url"),
        location=current_user.get("location"),
        age=current_user.get("age"),
        height=current_user.get("height"),
        weight=current_user.get("weight"),
        goal=current_user.get("goal"),
        activity_level=current_user.get("activity_level"),
        subscription=subscription,
        workout_split=current_user.get("workout_split"),
        xp=current_user.get("xp", 0),
        rank=current_user.get("rank", "Beginner"),
        streak_count=current_user.get("streak_count", 0),
    )


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    profile_update: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Update user profile information.
    
    - Validates authentication token (handled by get_current_user dependency)
    - Validates request body using ProfileUpdate schema (Pydantic validation)
    - Updates user document in MongoDB with provided fields
    - Returns updated profile data
    - Handles validation errors with 400 status (automatic via Pydantic)
    
    Requirements: 13.2, 9.2, 9.3, 9.4
    """
    # Build update dictionary with only provided fields
    update_data = {}
    if profile_update.name is not None:
        update_data["name"] = profile_update.name
    if profile_update.location is not None:
        update_data["location"] = profile_update.location
    if profile_update.age is not None:
        update_data["age"] = profile_update.age
    if profile_update.height is not None:
        update_data["height"] = profile_update.height
    if profile_update.weight is not None:
        update_data["weight"] = profile_update.weight
    if profile_update.goal is not None:
        update_data["goal"] = profile_update.goal
    if profile_update.activity_level is not None:
        update_data["activity_level"] = profile_update.activity_level
    
    # If no fields to update, return current profile
    if not update_data:
        return await get_profile(current_user)
    
    # Update user document in MongoDB
    result = await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": update_data}
    )
    
    # Check if update was successful
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch updated user document
    updated_user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate subscription status
    subscription_status = calculate_subscription_status(
        updated_user.get("subscription_expiry_date")
    )
    
    # Build subscription object if subscription data exists
    subscription = None
    if updated_user.get("subscription_name"):
        subscription = {
            "name": updated_user.get("subscription_name"),
            "status": subscription_status,
            "start_date": updated_user.get("subscription_start_date").isoformat() if updated_user.get("subscription_start_date") else None,
            "expiry_date": updated_user.get("subscription_expiry_date").isoformat() if updated_user.get("subscription_expiry_date") else None,
        }
    
    # Build and return updated profile response
    return ProfileResponse(
        id=str(updated_user["_id"]),
        name=updated_user["name"],
        email=updated_user["email"],
        profile_picture_url=updated_user.get("profile_picture_url"),
        location=updated_user.get("location"),
        age=updated_user.get("age"),
        height=updated_user.get("height"),
        weight=updated_user.get("weight"),
        goal=updated_user.get("goal"),
        activity_level=updated_user.get("activity_level"),
        subscription=subscription,
        workout_split=updated_user.get("workout_split"),
        xp=updated_user.get("xp", 0),
        rank=updated_user.get("rank", "Beginner"),
        streak_count=updated_user.get("streak_count", 0),
    )


@router.post("/profile/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Upload and update user profile picture.
    
    - Validates authentication token (handled by get_current_user dependency)
    - Accepts multipart form data with image file
    - Validates file format (JPEG, PNG only)
    - Validates file size (max 5MB)
    - Resizes image to max 800×800px while maintaining aspect ratio
    - Converts image to base64 data URL for storage
    - Updates user document with new profile_picture_url
    - Returns the new profile_picture_url
    
    Requirements: 13.3, 10.5, 10.6, 10.7
    """
    # Validate file format
    content_type = file.content_type
    if content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only JPEG and PNG are supported."
        )
    
    # Read file content
    file_content = await file.read()
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 5MB."
        )
    
    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(file_content))
        
        # Convert RGBA to RGB if necessary (for PNG with transparency)
        if image.mode == "RGBA":
            # Create a white background
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])  # Use alpha channel as mask
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")
        
        # Resize image to max 800×800px while maintaining aspect ratio
        max_dimension = 800
        if image.width > max_dimension or image.height > max_dimension:
            # Calculate new dimensions maintaining aspect ratio
            if image.width > image.height:
                new_width = max_dimension
                new_height = int(image.height * (max_dimension / image.width))
            else:
                new_height = max_dimension
                new_width = int(image.width * (max_dimension / image.height))
            
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Convert image to base64 data URL
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=85, optimize=True)
        img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        profile_picture_url = f"data:image/jpeg;base64,{img_base64}"
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to process image: {str(e)}"
        )
    
    # Update user document with new profile_picture_url
    result = await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"profile_picture_url": profile_picture_url}}
    )
    
    # Check if update was successful
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return the new profile_picture_url
    return {"profile_picture_url": profile_picture_url}
