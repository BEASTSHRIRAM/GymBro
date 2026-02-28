"""
Quick validation test for the new profile models
"""
from models import (
    UserInDB,
    ProfileUpdate,
    ProfileResponse,
    Exercise,
    WorkoutDay,
    WorkoutSplit,
    WorkoutSplitGenerateRequest
)
from datetime import datetime
from pydantic import ValidationError


def test_user_in_db_new_fields():
    """Test that UserInDB accepts new profile fields"""
    user = UserInDB(
        name="Test User",
        email="test@example.com",
        password_hash="hashed_password",
        profile_picture_url="https://example.com/pic.jpg",
        location="Mumbai",
        subscription_name="Premium",
        subscription_status="ACTIVE",
        subscription_start_date=datetime.utcnow(),
        subscription_expiry_date=datetime.utcnow(),
        workout_split={"split_name": "Test Split", "days": []}
    )
    assert user.profile_picture_url == "https://example.com/pic.jpg"
    assert user.location == "Mumbai"
    assert user.subscription_name == "Premium"
    assert user.workout_split is not None
    print("✓ UserInDB new fields validated")


def test_profile_update_validation():
    """Test ProfileUpdate validation constraints"""
    # Valid update
    valid_update = ProfileUpdate(
        name="John Doe",
        location="Delhi",
        age=25,
        height=175.5,
        weight=75.0,
        goal="build_muscle",
        activity_level="moderate"
    )
    assert valid_update.name == "John Doe"
    print("✓ ProfileUpdate valid data accepted")
    
    # Test age validation (13-120)
    try:
        ProfileUpdate(age=12)
        assert False, "Should reject age < 13"
    except ValidationError:
        print("✓ ProfileUpdate rejects age < 13")
    
    try:
        ProfileUpdate(age=121)
        assert False, "Should reject age > 120"
    except ValidationError:
        print("✓ ProfileUpdate rejects age > 120")
    
    # Test weight validation (20-300)
    try:
        ProfileUpdate(weight=19.9)
        assert False, "Should reject weight < 20"
    except ValidationError:
        print("✓ ProfileUpdate rejects weight < 20")
    
    try:
        ProfileUpdate(weight=300.1)
        assert False, "Should reject weight > 300"
    except ValidationError:
        print("✓ ProfileUpdate rejects weight > 300")
    
    # Test height validation (100-250)
    try:
        ProfileUpdate(height=99.9)
        assert False, "Should reject height < 100"
    except ValidationError:
        print("✓ ProfileUpdate rejects height < 100")
    
    try:
        ProfileUpdate(height=250.1)
        assert False, "Should reject height > 250"
    except ValidationError:
        print("✓ ProfileUpdate rejects height > 250")
    
    # Test name validation (2-50 chars)
    try:
        ProfileUpdate(name="A")
        assert False, "Should reject name < 2 chars"
    except ValidationError:
        print("✓ ProfileUpdate rejects name < 2 chars")
    
    try:
        ProfileUpdate(name="A" * 51)
        assert False, "Should reject name > 50 chars"
    except ValidationError:
        print("✓ ProfileUpdate rejects name > 50 chars")


def test_profile_response():
    """Test ProfileResponse schema"""
    response = ProfileResponse(
        id="user123",
        name="Test User",
        email="test@example.com",
        profile_picture_url="https://example.com/pic.jpg",
        location="Mumbai",
        age=25,
        height=175.5,
        weight=75.0,
        goal="build_muscle",
        activity_level="moderate",
        subscription={"name": "Premium", "status": "ACTIVE"},
        workout_split={"split_name": "Test Split"},
        xp=100,
        rank="Intermediate",
        streak_count=5
    )
    assert response.id == "user123"
    assert response.subscription is not None
    assert response.workout_split is not None
    print("✓ ProfileResponse validated")


def test_workout_split_schemas():
    """Test workout split related schemas"""
    # Test Exercise
    exercise = Exercise(
        name="Bench Press",
        sets=4,
        reps="8-10",
        rest_seconds=90,
        notes="Focus on form"
    )
    assert exercise.name == "Bench Press"
    print("✓ Exercise schema validated")
    
    # Test WorkoutDay
    workout_day = WorkoutDay(
        day_name="Day 1: Chest & Triceps",
        exercises=[exercise],
        notes="Push day"
    )
    assert workout_day.day_name == "Day 1: Chest & Triceps"
    assert len(workout_day.exercises) == 1
    print("✓ WorkoutDay schema validated")
    
    # Test WorkoutSplit
    workout_split = WorkoutSplit(
        split_name="5-Day Split",
        frequency="5 days per week",
        days=[workout_day],
        notes="Progressive overload"
    )
    assert workout_split.split_name == "5-Day Split"
    assert len(workout_split.days) == 1
    print("✓ WorkoutSplit schema validated")


def test_workout_split_generate_request():
    """Test WorkoutSplitGenerateRequest validation"""
    # Valid request
    request = WorkoutSplitGenerateRequest(
        age=25,
        height=175.5,
        weight=75.0,
        goal="build_muscle",
        activity_level="moderate"
    )
    assert request.age == 25
    print("✓ WorkoutSplitGenerateRequest valid data accepted")
    
    # Test validation constraints
    try:
        WorkoutSplitGenerateRequest(
            age=12,
            height=175,
            weight=75,
            goal="build_muscle",
            activity_level="moderate"
        )
        assert False, "Should reject age < 13"
    except ValidationError:
        print("✓ WorkoutSplitGenerateRequest rejects age < 13")


if __name__ == "__main__":
    print("Testing new profile models...\n")
    test_user_in_db_new_fields()
    test_profile_update_validation()
    test_profile_response()
    test_workout_split_schemas()
    test_workout_split_generate_request()
    print("\n✅ All model validations passed!")
