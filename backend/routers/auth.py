"""
GymBro — Auth Router
POST /auth/register  — Register + send OTP
POST /auth/verify-otp — Verify OTP, activate account
POST /auth/login     — Login, return JWT
POST /auth/refresh   — Refresh access token
GET  /auth/me        — Current user profile
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime
from bson import ObjectId

from database import get_db
from models import UserCreate, UserInDB, UserPublic
from services.auth_service import (
    hash_password, verify_password,
    generate_otp, get_otp_expiry, send_otp_email,
    create_access_token, create_refresh_token, decode_token,
    check_rate_limit,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Helpers ───────────────────────────────────────────────────────────────────
def serialize_user(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        age=doc.get("age"),
        height=doc.get("height"),
        weight=doc.get("weight"),
        goal=doc.get("goal"),
        activity_level=doc.get("activity_level"),
        role=doc.get("role", "user"),
        xp=doc.get("xp", 0),
        rank=doc.get("rank", "Beginner"),
        streak_count=doc.get("streak_count", 0),
    )


async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────
class OTPVerify(BaseModel):
    email: EmailStr
    otp: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ResendOTPRequest(BaseModel):
    email: EmailStr


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(payload: UserCreate):
    db = get_db()
    existing = await db["users"].find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    otp = generate_otp()
    expires = get_otp_expiry()

    user_doc = UserInDB(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        age=payload.age,
        height=payload.height,
        weight=payload.weight,
        goal=payload.goal,
        activity_level=payload.activity_level,
        otp_code=otp,
        otp_expires=expires,
        is_verified=False,
    ).model_dump()

    await db["users"].insert_one(user_doc)

    try:
        await send_otp_email(payload.email, otp)
    except Exception as e:
        print(f"[Auth] OTP email failed: {e}")

    return {"message": "Registration successful. Check your email for OTP."}


@router.post("/verify-otp")
async def verify_otp(payload: OTPVerify):
    db = get_db()
    user = await db["users"].find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="Account already verified")
    if user.get("otp_code") != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if user.get("otp_expires") and datetime.utcnow() > user["otp_expires"]:
        raise HTTPException(status_code=400, detail="OTP expired")

    await db["users"].update_one(
        {"email": payload.email},
        {"$set": {"is_verified": True, "otp_code": None, "otp_expires": None}},
    )
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/login")
async def login(payload: LoginRequest):
    db = get_db()
    user = await db["users"].find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email first")

    uid = str(user["_id"])
    access = create_access_token(uid, user["email"], user.get("role", "user"))
    refresh = create_refresh_token(uid)

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.post("/refresh")
async def refresh_token(payload: RefreshRequest):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(data["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    uid = str(user["_id"])
    access = create_access_token(uid, user["email"], user.get("role", "user"))
    return {"access_token": access, "token_type": "bearer"}


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


@router.post("/resend-otp")
async def resend_otp(payload: ResendOTPRequest):
    """
    Resend OTP endpoint with rate limiting.
    
    - Query user by email
    - Return 404 if user not found
    - Return 400 if account already verified
    - Check rate limit (60-second cooldown)
    - Return 429 with remaining seconds if cooldown active
    - Generate new 6-digit OTP code
    - Update user document with new OTP, expiration, and timestamp
    - Send OTP email
    - Return success response with cooldown_seconds
    """
    db = get_db()
    
    # Log resend request received
    print(f"[Auth] Resend OTP request received - email: {payload.email}, timestamp: {datetime.utcnow().isoformat()}")
    
    # Query user by email
    user = await db["users"].find_one({"email": payload.email})
    
    # Return 404 if user not found
    if not user:
        print(f"[Auth] Resend OTP failed - reason: User not found, email: {payload.email}, timestamp: {datetime.utcnow().isoformat()}")
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return 400 if account already verified
    if user.get("is_verified"):
        print(f"[Auth] Resend OTP failed - reason: Account already verified, email: {payload.email}, timestamp: {datetime.utcnow().isoformat()}")
        raise HTTPException(status_code=400, detail="Account already verified")
    
    # Check rate limit
    is_allowed, remaining_seconds = check_rate_limit(user)
    
    # Return 429 with remaining seconds if cooldown active
    if not is_allowed:
        print(f"[Auth] Resend OTP rate limited - email: {payload.email}, remaining_cooldown: {remaining_seconds}s, timestamp: {datetime.utcnow().isoformat()}")
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Please wait before requesting another OTP",
                "remaining_seconds": remaining_seconds
            }
        )
    
    # Generate new 6-digit OTP code
    otp = generate_otp()
    expires = get_otp_expiry()
    
    # Update user document with new OTP, expiration (10 min), and timestamp
    await db["users"].update_one(
        {"email": payload.email},
        {
            "$set": {
                "otp_code": otp,
                "otp_expires": expires,
                "last_otp_generated_at": datetime.utcnow()
            }
        }
    )
    
    # Send OTP email
    try:
        await send_otp_email(payload.email, otp)
    except Exception as e:
        print(f"[Auth] Resend OTP failed - reason: Email send failed ({e}), email: {payload.email}, timestamp: {datetime.utcnow().isoformat()}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    
    # Log success event
    print(f"[Auth] Resend OTP success - email: {payload.email}, timestamp: {datetime.utcnow().isoformat()}")
    
    # Return success response with cooldown_seconds
    return {
        "message": "New OTP sent to your email",
        "cooldown_seconds": 60
    }
