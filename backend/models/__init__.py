"""
GymBro — MongoDB Models (Pydantic v2)
All collections defined here as Pydantic schemas.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ─── User ───────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    age: Optional[int] = None
    height: Optional[float] = None   # cm
    weight: Optional[float] = None   # kg
    goal: Optional[str] = None       # e.g. "lose_fat", "build_muscle"
    activity_level: Optional[str] = None  # sedentary, light, moderate, active, very_active


class UserInDB(BaseModel):
    name: str
    email: str
    password_hash: str
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    role: str = "user"   # user | coach
    xp: int = 0
    rank: str = "Beginner"
    streak_count: int = 0
    last_workout_date: Optional[datetime] = None
    is_verified: bool = False
    otp_code: Optional[str] = None
    otp_expires: Optional[datetime] = None
    last_otp_generated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Profile fields
    profile_picture_url: Optional[str] = None
    location: Optional[str] = None
    # Subscription fields
    subscription_name: Optional[str] = None
    subscription_status: Optional[str] = None  # ACTIVE, INACTIVE, EXPIRED
    subscription_start_date: Optional[datetime] = None
    subscription_expiry_date: Optional[datetime] = None
    # Workout split field
    workout_split: Optional[dict] = None


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    role: str
    xp: int
    rank: str
    streak_count: int


# ─── Workout Session ─────────────────────────────────────────────────────────
class WorkoutSessionCreate(BaseModel):
    user_id: str
    exercise_name: str
    reps: int
    form_score: float
    joint_metrics: Optional[dict] = None
    feedback_log: Optional[list[str]] = None
    recorded_video_url: Optional[str] = None


class WorkoutSessionInDB(WorkoutSessionCreate):
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Strength Prediction ─────────────────────────────────────────────────────
class WorkoutLogEntry(BaseModel):
    weight_kg: float
    reps: int
    logged_at: datetime = Field(default_factory=datetime.utcnow)


class StrengthPredictionInDB(BaseModel):
    user_id: str
    exercise_name: str
    logs: list[WorkoutLogEntry] = []
    current_1rm: Optional[float] = None
    predicted_4_week: Optional[float] = None
    predicted_8_week: Optional[float] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Diet Plan ───────────────────────────────────────────────────────────────
class DietInput(BaseModel):
    age: int
    height: float      # cm
    weight: float      # kg
    goal: str          # lose_fat | build_muscle | maintain
    activity_level: str  # sedentary | light | moderate | active | very_active
    gender: str = "male"


class Meal(BaseModel):
    name: str
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    items: list[str]


class DietPlanInDB(BaseModel):
    user_id: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    meals: list[Meal] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Body Scan ───────────────────────────────────────────────────────────────
class BodyScanInDB(BaseModel):
    user_id: str
    body_fat_estimate: Optional[float] = None
    posture_analysis: Optional[str] = None
    imbalance_scores: Optional[dict] = None
    corrective_exercises: Optional[list[str]] = None
    scan_date: datetime = Field(default_factory=datetime.utcnow)


# ─── Coach ───────────────────────────────────────────────────────────────────
class CoachInDB(BaseModel):
    name: str
    gym_name: str
    email: str
    password_hash: str
    geo_location: dict   # GeoJSON: {"type": "Point", "coordinates": [lng, lat]}
    rating: float = 5.0
    review_count: int = 0
    price_per_session: float = 0.0
    specialties: list[str] = []
    availability: dict = {}  # {"mon": ["09:00", "17:00"], ...}
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CoachPublic(BaseModel):
    id: str
    name: str
    gym_name: str
    rating: float
    review_count: int
    price_per_session: float
    specialties: list[str]
    availability: dict
    distance_km: Optional[float] = None


# ─── Profile Management ──────────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    location: Optional[str] = Field(None, max_length=100)
    age: Optional[int] = Field(None, ge=13, le=120)
    height: Optional[float] = Field(None, ge=100, le=250)
    weight: Optional[float] = Field(None, ge=20, le=300)
    goal: Optional[str] = Field(None, pattern="^(lose_fat|build_muscle|maintain)$")
    activity_level: Optional[str] = Field(
        None, 
        pattern="^(sedentary|light|moderate|active|very_active)$"
    )


class ProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    profile_picture_url: Optional[str] = None
    location: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    subscription: Optional[dict] = None
    workout_split: Optional[dict] = None
    xp: int
    rank: str
    streak_count: int


# ─── Workout Split ───────────────────────────────────────────────────────────
class Exercise(BaseModel):
    name: str
    sets: int = Field(ge=1, le=10)
    reps: str  # e.g., "8-10" or "12"
    rest_seconds: int = Field(ge=0, le=600)
    notes: Optional[str] = None


class WorkoutDay(BaseModel):
    day_name: str
    exercises: list[Exercise]
    notes: Optional[str] = None


class WorkoutSplit(BaseModel):
    split_name: str
    frequency: str
    days: list[WorkoutDay]
    notes: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class WorkoutSplitGenerateRequest(BaseModel):
    age: int = Field(ge=13, le=120)
    height: float = Field(ge=100, le=250)
    weight: float = Field(ge=20, le=300)
    goal: str = Field(pattern="^(lose_fat|build_muscle|maintain)$")
    activity_level: str = Field(
        pattern="^(sedentary|light|moderate|active|very_active)$"
    )
