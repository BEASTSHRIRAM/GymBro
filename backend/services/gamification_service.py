"""
GymBro — Gamification Service
XP awarding, rank system, streak tracking, badges. (In-memory + MongoDB, no Redis)
"""
from datetime import datetime, timedelta

# ─── Rank Thresholds (XP) ────────────────────────────────────────────────────
RANKS = [
    (0,    "Beginner"),
    (500,  "Bronze"),
    (1500, "Silver"),
    (3000, "Gold"),
    (6000, "Elite"),
]

# ─── XP Awards ────────────────────────────────────────────────────────────────
XP_REWARDS = {
    "workout_complete":   50,
    "perfect_form":       30,   # form_score == 100
    "good_form":          15,   # form_score >= 80
    "daily_streak":       20,
    "weekly_streak":     100,
    "diet_generated":     10,
    "body_scan":          25,
}

# ─── Achievement Badges ───────────────────────────────────────────────────────
BADGES = {
    "first_workout":   {"name": "First Rep",       "icon": "🏋️", "xp_threshold": 0,    "workout_count": 1},
    "week_warrior":    {"name": "Week Warrior",    "icon": "🗓️", "xp_threshold": 0,    "streak": 7},
    "perfect_form":    {"name": "Perfect Form",    "icon": "✅", "xp_threshold": 0,    "form_score": 100},
    "bronze_lifter":   {"name": "Bronze Lifter",   "icon": "🥉", "xp_threshold": 500,  "workout_count": None},
    "silver_lifter":   {"name": "Silver Lifter",   "icon": "🥈", "xp_threshold": 1500, "workout_count": None},
    "gold_lifter":     {"name": "Gold Lifter",     "icon": "🥇", "xp_threshold": 3000, "workout_count": None},
    "elite_athlete":   {"name": "Elite Athlete",   "icon": "🏆", "xp_threshold": 6000, "workout_count": None},
}


def get_rank(xp: int) -> str:
    """Return rank name based on total XP."""
    rank = "Beginner"
    for threshold, name in RANKS:
        if xp >= threshold:
            rank = name
    return rank


def calculate_xp_award(
    form_score: float,
    is_workout_complete: bool = True,
) -> int:
    """Calculate XP earned for a workout session."""
    xp = 0
    if is_workout_complete:
        xp += XP_REWARDS["workout_complete"]
    if form_score == 100:
        xp += XP_REWARDS["perfect_form"]
    elif form_score >= 80:
        xp += XP_REWARDS["good_form"]
    return xp


def update_streak(last_workout_date: datetime | None) -> tuple[int, bool]:
    """
    Returns (streak_increment, is_weekly_streak_bonus).
    - If last workout was yesterday: streak continues
    - If last workout was today: no change
    - Otherwise: streak resets to 1
    """
    now = datetime.utcnow().date()

    if last_workout_date is None:
        return 1, False

    last = last_workout_date.date() if isinstance(last_workout_date, datetime) else last_workout_date
    delta = (now - last).days

    if delta == 0:
        return 0, False       # Same day, no change
    elif delta == 1:
        return 1, False       # Streak continues
    else:
        return 0, False       # Reset (handled by caller setting streak=1)


def get_earned_badges(xp: int, streak: int, workout_count: int, best_form_score: float) -> list[str]:
    """Return list of badge keys the user has earned."""
    earned = []
    for key, badge in BADGES.items():
        if badge["xp_threshold"] and xp < badge["xp_threshold"]:
            continue
        if badge.get("workout_count") and workout_count < badge["workout_count"]:
            continue
        if badge.get("streak") and streak < badge["streak"]:
            continue
        if badge.get("form_score") and best_form_score < badge["form_score"]:
            continue
        earned.append(key)
    return earned


def build_badge_list(earned_keys: list[str]) -> list[dict]:
    """Convert badge keys to full badge objects for frontend."""
    return [
        {
            "id": key,
            "name": BADGES[key]["name"],
            "icon": BADGES[key]["icon"],
        }
        for key in earned_keys
        if key in BADGES
    ]
