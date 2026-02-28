"""
Test suite for Profile Router
Tests GET /api/profile endpoint
"""
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from bson import ObjectId

from main import app
from routers.profile import calculate_subscription_status

client = TestClient(app)


# ─── Helper Functions Tests ───────────────────────────────────────────────────
def test_calculate_subscription_status_active():
    """Test subscription status calculation for active subscription"""
    future_date = datetime.utcnow() + timedelta(days=30)
    status = calculate_subscription_status(future_date)
    assert status == "ACTIVE"
    print("✓ calculate_subscription_status returns ACTIVE for future date")


def test_calculate_subscription_status_expiring_today():
    """Test subscription status calculation for subscription expiring today"""
    today = datetime.utcnow()
    status = calculate_subscription_status(today)
    assert status == "EXPIRING TODAY"
    print("✓ calculate_subscription_status returns EXPIRING TODAY for today's date")


def test_calculate_subscription_status_expired():
    """Test subscription status calculation for expired subscription"""
    past_date = datetime.utcnow() - timedelta(days=30)
    status = calculate_subscription_status(past_date)
    assert status == "EXPIRED"
    print("✓ calculate_subscription_status returns EXPIRED for past date")


def test_calculate_subscription_status_inactive():
    """Test subscription status calculation for no expiry date"""
    status = calculate_subscription_status(None)
    assert status == "INACTIVE"
    print("✓ calculate_subscription_status returns INACTIVE for None")


# ─── GET /api/profile Endpoint Tests ──────────────────────────────────────────
def test_get_profile_success():
    """Test GET /api/profile returns profile data with valid token"""
    # Mock user data
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "profile_picture_url": "https://example.com/pic.jpg",
        "location": "Mumbai",
        "age": 25,
        "height": 175.5,
        "weight": 75.0,
        "goal": "build_muscle",
        "activity_level": "moderate",
        "subscription_name": "Premium",
        "subscription_status": "ACTIVE",
        "subscription_start_date": datetime.utcnow() - timedelta(days=30),
        "subscription_expiry_date": datetime.utcnow() + timedelta(days=30),
        "workout_split": {
            "split_name": "5-Day Split",
            "frequency": "5 days per week",
            "days": []
        },
        "xp": 100,
        "rank": "Intermediate",
        "streak_count": 5,
    }
    
    # Override the dependency
    from routers.profile import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    try:
        response = client.get(
            "/api/profile",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        print(f"Response status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response body: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test User"
        assert data["email"] == "test@example.com"
        assert data["location"] == "Mumbai"
        assert data["age"] == 25
        assert data["subscription"] is not None
        assert data["subscription"]["name"] == "Premium"
        assert data["subscription"]["status"] == "ACTIVE"
        assert data["workout_split"] is not None
        print("✓ GET /api/profile returns complete profile data")
    finally:
        # Clean up the override
        app.dependency_overrides.clear()


def test_get_profile_without_subscription():
    """Test GET /api/profile returns profile without subscription data"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    from routers.profile import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    try:
        response = client.get(
            "/api/profile",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test User"
        assert data["subscription"] is None
        assert data["workout_split"] is None
        print("✓ GET /api/profile handles missing subscription gracefully")
    finally:
        app.dependency_overrides.clear()


def test_get_profile_calculates_subscription_status():
    """Test GET /api/profile calculates subscription status correctly"""
    # Test with expired subscription
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "subscription_name": "Basic",
        "subscription_start_date": datetime.utcnow() - timedelta(days=60),
        "subscription_expiry_date": datetime.utcnow() - timedelta(days=5),
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    from routers.profile import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    try:
        response = client.get(
            "/api/profile",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["subscription"]["status"] == "EXPIRED"
        print("✓ GET /api/profile calculates EXPIRED status correctly")
    finally:
        app.dependency_overrides.clear()


def test_get_profile_unauthorized():
    """Test GET /api/profile returns error without valid token"""
    response = client.get("/api/profile")
    assert response.status_code == 422  # FastAPI returns 422 for missing required header
    print("✓ GET /api/profile returns error without authorization header")


def test_get_profile_invalid_token():
    """Test GET /api/profile returns 401 with invalid token"""
    # Mock get_current_user to raise HTTPException
    from fastapi import HTTPException
    from routers.profile import get_current_user
    
    def mock_get_current_user():
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    try:
        response = client.get(
            "/api/profile",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
        print("✓ GET /api/profile returns 401 for invalid token")
    finally:
        app.dependency_overrides.clear()


def test_get_profile_with_all_optional_fields():
    """Test GET /api/profile returns all optional fields when present"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Complete User",
        "email": "complete@example.com",
        "profile_picture_url": "https://example.com/complete.jpg",
        "location": "Delhi",
        "age": 30,
        "height": 180.0,
        "weight": 80.0,
        "goal": "lose_fat",
        "activity_level": "active",
        "subscription_name": "Premium Plus",
        "subscription_start_date": datetime.utcnow() - timedelta(days=10),
        "subscription_expiry_date": datetime.utcnow() + timedelta(days=20),
        "workout_split": {
            "split_name": "Custom Split",
            "frequency": "6 days per week",
            "days": [
                {
                    "day_name": "Day 1: Chest",
                    "exercises": [
                        {
                            "name": "Bench Press",
                            "sets": 4,
                            "reps": "8-10",
                            "rest_seconds": 90
                        }
                    ]
                }
            ]
        },
        "xp": 500,
        "rank": "Advanced",
        "streak_count": 15,
    }
    
    from routers.profile import get_current_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    try:
        response = client.get(
            "/api/profile",
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["profile_picture_url"] == "https://example.com/complete.jpg"
        assert data["location"] == "Delhi"
        assert data["age"] == 30
        assert data["height"] == 180.0
        assert data["weight"] == 80.0
        assert data["goal"] == "lose_fat"
        assert data["activity_level"] == "active"
        assert data["xp"] == 500
        assert data["rank"] == "Advanced"
        assert data["streak_count"] == 15
        print("✓ GET /api/profile returns all optional fields correctly")
    finally:
        app.dependency_overrides.clear()


# ─── PUT /api/profile Endpoint Tests ──────────────────────────────────────────
def test_update_profile_success():
    """Test PUT /api/profile updates profile data successfully"""
    mock_user_id = ObjectId()
    mock_user = {
        "_id": mock_user_id,
        "name": "Old Name",
        "email": "test@example.com",
        "age": 25,
        "height": 170.0,
        "weight": 70.0,
        "goal": "maintain",
        "activity_level": "light",
        "location": "Old Location",
        "xp": 100,
        "rank": "Intermediate",
        "streak_count": 5,
    }
    
    # Mock database
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return {
                    "_id": mock_user_id,
                    "name": "New Name",
                    "email": "test@example.com",
                    "age": 30,
                    "height": 175.0,
                    "weight": 75.0,
                    "goal": "build_muscle",
                    "activity_level": "moderate",
                    "location": "New Location",
                    "xp": 100,
                    "rank": "Intermediate",
                    "streak_count": 5,
                }
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={
                "name": "New Name",
                "age": 30,
                "height": 175.0,
                "weight": 75.0,
                "goal": "build_muscle",
                "activity_level": "moderate",
                "location": "New Location"
            },
            headers={"Authorization": "Bearer mock_token"}
        )
        
        print(f"Response status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response body: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert data["age"] == 30
        assert data["height"] == 175.0
        assert data["weight"] == 75.0
        assert data["goal"] == "build_muscle"
        assert data["activity_level"] == "moderate"
        assert data["location"] == "New Location"
        print("✓ PUT /api/profile updates profile successfully")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_partial_update():
    """Test PUT /api/profile handles partial updates"""
    mock_user_id = ObjectId()
    mock_user = {
        "_id": mock_user_id,
        "name": "Test User",
        "email": "test@example.com",
        "age": 25,
        "height": 170.0,
        "weight": 70.0,
        "xp": 100,
        "rank": "Intermediate",
        "streak_count": 5,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return {
                    "_id": mock_user_id,
                    "name": "Updated Name",
                    "email": "test@example.com",
                    "age": 25,
                    "height": 170.0,
                    "weight": 70.0,
                    "xp": 100,
                    "rank": "Intermediate",
                    "streak_count": 5,
                }
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={"name": "Updated Name"},
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        print("✓ PUT /api/profile handles partial updates")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_name_too_short():
    """Test PUT /api/profile returns 400 for name too short"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={"name": "A"},  # Too short (min 2 chars)
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 422  # Pydantic validation error
        print("✓ PUT /api/profile returns 422 for name too short")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_name_too_long():
    """Test PUT /api/profile returns 400 for name too long"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={"name": "A" * 51},  # Too long (max 50 chars)
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 422
        print("✓ PUT /api/profile returns 422 for name too long")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_weight_out_of_range():
    """Test PUT /api/profile returns 400 for weight out of range"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        # Test weight too low
        response = client.put(
            "/api/profile",
            json={"weight": 15.0},  # Below min (20 kg)
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 422
        
        # Test weight too high
        response = client.put(
            "/api/profile",
            json={"weight": 350.0},  # Above max (300 kg)
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 422
        
        print("✓ PUT /api/profile returns 422 for weight out of range")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_height_out_of_range():
    """Test PUT /api/profile returns 400 for height out of range"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        # Test height too low
        response = client.put(
            "/api/profile",
            json={"height": 90.0},  # Below min (100 cm)
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 422
        
        # Test height too high
        response = client.put(
            "/api/profile",
            json={"height": 260.0},  # Above max (250 cm)
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 422
        
        print("✓ PUT /api/profile returns 422 for height out of range")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_age_out_of_range():
    """Test PUT /api/profile returns 400 for age out of range"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        # Test age too low
        response = client.put(
            "/api/profile",
            json={"age": 10},  # Below min (13 years)
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 422
        
        # Test age too high
        response = client.put(
            "/api/profile",
            json={"age": 130},  # Above max (120 years)
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 422
        
        print("✓ PUT /api/profile returns 422 for age out of range")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_invalid_goal():
    """Test PUT /api/profile returns 400 for invalid goal"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={"goal": "invalid_goal"},
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 422
        print("✓ PUT /api/profile returns 422 for invalid goal")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_validation_error_invalid_activity_level():
    """Test PUT /api/profile returns 400 for invalid activity level"""
    mock_user = {
        "_id": ObjectId(),
        "name": "Test User",
        "email": "test@example.com",
        "xp": 0,
        "rank": "Beginner",
        "streak_count": 0,
    }
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return mock_user
        
        users = MockUsers()
    
    from routers.profile import get_current_user
    from database import get_db
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={"activity_level": "super_active"},
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 422
        print("✓ PUT /api/profile returns 422 for invalid activity level")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_unauthorized():
    """Test PUT /api/profile returns error without valid token"""
    # Mock database to avoid connection error
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return {}
        
        users = MockUsers()
    
    from database import get_db
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        # Don't provide authorization header
        response = client.put(
            "/api/profile",
            json={"name": "New Name"}
        )
        # FastAPI returns 422 for missing required header parameter
        assert response.status_code in [401, 422]
        print("✓ PUT /api/profile returns error without authorization header")
    finally:
        app.dependency_overrides.clear()


def test_update_profile_invalid_token():
    """Test PUT /api/profile returns 401 with invalid token"""
    from fastapi import HTTPException
    from routers.profile import get_current_user
    from database import get_db
    
    def mock_get_current_user():
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    class MockDB:
        class MockUsers:
            async def update_one(self, filter_dict, update_dict):
                class MockResult:
                    matched_count = 1
                return MockResult()
            
            async def find_one(self, filter_dict):
                return {}
        
        users = MockUsers()
    
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_db] = lambda: MockDB()
    
    try:
        response = client.put(
            "/api/profile",
            json={"name": "New Name"},
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
        print("✓ PUT /api/profile returns 401 for invalid token")
    finally:
        app.dependency_overrides.clear()


if __name__ == "__main__":
    print("Testing Profile Router...\n")
    
    # Run helper function tests
    test_calculate_subscription_status_active()
    test_calculate_subscription_status_expiring_today()
    test_calculate_subscription_status_expired()
    test_calculate_subscription_status_inactive()
    
    # Run GET endpoint tests
    test_get_profile_success()
    test_get_profile_without_subscription()
    test_get_profile_calculates_subscription_status()
    test_get_profile_unauthorized()
    test_get_profile_invalid_token()
    test_get_profile_with_all_optional_fields()
    
    # Run PUT endpoint tests
    test_update_profile_success()
    test_update_profile_partial_update()
    test_update_profile_validation_error_name_too_short()
    test_update_profile_validation_error_name_too_long()
    test_update_profile_validation_error_weight_out_of_range()
    test_update_profile_validation_error_height_out_of_range()
    test_update_profile_validation_error_age_out_of_range()
    test_update_profile_validation_error_invalid_goal()
    test_update_profile_validation_error_invalid_activity_level()
    test_update_profile_unauthorized()
    test_update_profile_invalid_token()
    
    print("\n✅ All profile router tests passed!")
