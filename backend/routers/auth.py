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

    # Check if a verified user already exists
    existing = await db["users"].find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    otp = generate_otp()
    expires = get_otp_expiry()

    # Check if there's already a pending registration for this email
    pending = await db["pending_registrations"].find_one({"email": payload.email})

    if pending:
        # Update existing pending registration with new OTP and data
        await db["pending_registrations"].update_one(
            {"email": payload.email},
            {"$set": {
                "name": payload.name,
                "password_hash": hash_password(payload.password),
                "age": payload.age,
                "height": payload.height,
                "weight": payload.weight,
                "goal": payload.goal,
                "activity_level": payload.activity_level,
                "otp_code": otp,
                "otp_expires": expires,
                "last_otp_generated_at": datetime.utcnow(),
            }}
        )
    else:
        # Insert new pending registration
        pending_doc = {
            "name": payload.name,
            "email": payload.email,
            "password_hash": hash_password(payload.password),
            "age": payload.age,
            "height": payload.height,
            "weight": payload.weight,
            "goal": payload.goal,
            "activity_level": payload.activity_level,
            "otp_code": otp,
            "otp_expires": expires,
            "created_at": datetime.utcnow(),
            "last_otp_generated_at": datetime.utcnow(),
        }
        await db["pending_registrations"].insert_one(pending_doc)

    try:
        await send_otp_email(payload.email, otp)
    except Exception as e:
        print(f"[Auth] OTP email failed: {e}")

    return {"message": "OTP sent to your email. Please verify to complete registration."}


@router.post("/verify-otp")
async def verify_otp(payload: OTPVerify):
    db = get_db()

    # Look up in pending_registrations
    pending = await db["pending_registrations"].find_one({"email": payload.email})
    if not pending:
        # Also check if user is already verified in users collection
        existing = await db["users"].find_one({"email": payload.email})
        if existing and existing.get("is_verified"):
            raise HTTPException(status_code=400, detail="Account already verified. Please log in.")
        raise HTTPException(status_code=404, detail="No pending registration found. Please register first.")

    if pending.get("otp_code") != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if pending.get("otp_expires") and datetime.utcnow() > pending["otp_expires"]:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    # Move user from pending_registrations → users
    user_doc = UserInDB(
        name=pending["name"],
        email=pending["email"],
        password_hash=pending["password_hash"],
        age=pending.get("age"),
        height=pending.get("height"),
        weight=pending.get("weight"),
        goal=pending.get("goal"),
        activity_level=pending.get("activity_level"),
        otp_code=None,
        otp_expires=None,
        is_verified=True,
    ).model_dump()

    result = await db["users"].insert_one(user_doc)
    await db["pending_registrations"].delete_one({"email": payload.email})

    # Generate JWT tokens for auto-login
    uid = str(result.inserted_id)
    user_doc["_id"] = result.inserted_id
    access = create_access_token(uid, pending["email"], "user")
    refresh = create_refresh_token(uid)

    return {
        "message": "Email verified successfully.",
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": serialize_user(user_doc),
    }


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
    Resend OTP for pending registration.
    Queries pending_registrations (not users) since unverified users aren't in users collection.
    """
    db = get_db()
    
    print(f"[Auth] Resend OTP request received - email: {payload.email}, timestamp: {datetime.utcnow().isoformat()}")
    
    # Query pending_registrations
    pending = await db["pending_registrations"].find_one({"email": payload.email})
    
    if not pending:
        # Check if already verified in users
        existing = await db["users"].find_one({"email": payload.email})
        if existing:
            print(f"[Auth] Resend OTP failed - reason: Account already verified, email: {payload.email}")
            raise HTTPException(status_code=400, detail="Account already verified. Please log in.")
        print(f"[Auth] Resend OTP failed - reason: No pending registration, email: {payload.email}")
        raise HTTPException(status_code=404, detail="No pending registration found. Please register first.")
    
    # Check rate limit
    is_allowed, remaining_seconds = check_rate_limit(pending)
    
    if not is_allowed:
        print(f"[Auth] Resend OTP rate limited - email: {payload.email}, remaining_cooldown: {remaining_seconds}s")
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Please wait before requesting another OTP",
                "remaining_seconds": remaining_seconds
            }
        )
    
    # Generate new OTP
    otp = generate_otp()
    expires = get_otp_expiry()
    
    await db["pending_registrations"].update_one(
        {"email": payload.email},
        {
            "$set": {
                "otp_code": otp,
                "otp_expires": expires,
                "last_otp_generated_at": datetime.utcnow()
            }
        }
    )
    
    try:
        await send_otp_email(payload.email, otp)
    except Exception as e:
        print(f"[Auth] Resend OTP failed - reason: Email send failed ({e}), email: {payload.email}")
        raise HTTPException(status_code=500, detail="Failed to send OTP")
    
    print(f"[Auth] Resend OTP success - email: {payload.email}")
    
    return {
        "message": "New OTP sent to your email",
        "cooldown_seconds": 60
    }
