"""
GymBro — Strength Prediction Service
Epley + Brzycki 1RM estimation, 4/8-week linear regression prediction.
"""
import math
from datetime import datetime


def epley_1rm(weight_kg: float, reps: int) -> float:
    """
    Epley formula: 1RM = weight × (1 + reps/30)
    Most accurate for reps 1-10.
    """
    if reps == 1:
        return weight_kg
    return weight_kg * (1 + reps / 30)


def brzycki_1rm(weight_kg: float, reps: int) -> float:
    """
    Brzycki formula: 1RM = weight × 36 / (37 - reps)
    More accurate for lower rep ranges (1-10).
    """
    if reps >= 37:
        return weight_kg * 1.2  # fallback for edge case
    return weight_kg * 36 / (37 - reps)


def estimate_1rm(weight_kg: float, reps: int) -> float:
    """Return the average of Epley & Brzycki for better accuracy."""
    return round((epley_1rm(weight_kg, reps) + brzycki_1rm(weight_kg, reps)) / 2, 2)


def predict_progression(logs: list[dict]) -> dict:
    """
    Given a list of workout logs [{weight_kg, reps, logged_at}...],
    calculate current 1RM and project 4-week and 8-week 1RM.

    Uses simple linear regression on weekly best 1RMs.
    Returns: {current_1rm, predicted_4_week, predicted_8_week, weekly_data}
    """
    if not logs:
        return {"current_1rm": 0, "predicted_4_week": 0, "predicted_8_week": 0, "weekly_data": []}

    # Group logs by week and find best 1RM per week
    from collections import defaultdict
    weekly_best: dict[int, float] = defaultdict(float)

    for log in logs:
        ts = log.get("logged_at") or datetime.utcnow()
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        week_num = ts.isocalendar()[1]  # ISO week number
        rm = estimate_1rm(log["weight_kg"], log["reps"])
        if rm > weekly_best[week_num]:
            weekly_best[week_num] = rm

    weeks = sorted(weekly_best.keys())
    if not weeks:
        return {"current_1rm": 0, "predicted_4_week": 0, "predicted_8_week": 0, "weekly_data": []}

    # Build x/y for linear regression
    x = list(range(len(weeks)))
    y = [weekly_best[w] for w in weeks]

    current_1rm = y[-1]

    # Least-squares linear regression
    n = len(x)
    if n < 2:
        slope = 0.0
    else:
        x_mean = sum(x) / n
        y_mean = sum(y) / n
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator != 0 else 0.0

    # Each "week" = 1 unit
    predicted_4_week = round(current_1rm + slope * 4, 2)
    predicted_8_week = round(current_1rm + slope * 8, 2)

    weekly_data = [{"week": weeks[i], "orm": round(y[i], 2)} for i in range(len(weeks))]

    return {
        "current_1rm": round(current_1rm, 2),
        "predicted_4_week": max(predicted_4_week, current_1rm),
        "predicted_8_week": max(predicted_8_week, current_1rm),
        "weekly_data": weekly_data,
    }
