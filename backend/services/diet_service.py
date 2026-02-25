"""
GymBro — Diet Service
BMR + TDEE calculation, macro distribution.
"""

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

GOAL_ADJUSTMENTS = {
    "lose_fat": -500,
    "build_muscle": +300,
    "maintain": 0,
}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str = "male") -> float:
    """
    Mifflin-St Jeor equation:
    Male:   10×weight + 6.25×height - 5×age + 5
    Female: 10×weight + 6.25×height - 5×age - 161
    """
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if gender.lower() == "male" else base - 161


def calculate_tdee(bmr: float, activity_level: str) -> float:
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    return round(bmr * multiplier, 2)


def calculate_macros(
    calories: float,
    goal: str,
    weight_kg: float,
) -> dict:
    """
    Macro split based on goal:
    - lose_fat:      High protein (35%), Moderate carb (35%), Low fat (30%)
    - build_muscle:  High protein (30%), High carb (45%), Moderate fat (25%)
    - maintain:      Balanced (30% P, 40% C, 30% F)
    """
    split = {
        "lose_fat":     {"protein": 0.35, "carbs": 0.35, "fat": 0.30},
        "build_muscle": {"protein": 0.30, "carbs": 0.45, "fat": 0.25},
        "maintain":     {"protein": 0.30, "carbs": 0.40, "fat": 0.30},
    }.get(goal, {"protein": 0.30, "carbs": 0.40, "fat": 0.30})

    # Adjust calories based on goal
    adjustment = GOAL_ADJUSTMENTS.get(goal, 0)
    target_calories = max(1200, calories + adjustment)

    protein_g = round((target_calories * split["protein"]) / 4, 1)  # 4 kcal/g
    carbs_g = round((target_calories * split["carbs"]) / 4, 1)
    fat_g = round((target_calories * split["fat"]) / 9, 1)           # 9 kcal/g

    return {
        "calories": round(target_calories, 0),
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
    }


def compute_diet_targets(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str,
    activity_level: str,
    goal: str,
) -> dict:
    """Full pipeline: BMR → TDEE → Macros."""
    bmr = calculate_bmr(weight_kg, height_cm, age, gender)
    tdee = calculate_tdee(bmr, activity_level)
    macros = calculate_macros(tdee, goal, weight_kg)
    return {
        "bmr": round(bmr, 2),
        "tdee": round(tdee, 2),
        **macros,
    }
