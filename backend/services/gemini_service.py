"""
GymBro — Gemini Service
Uses: google-genai SDK (installed via vision-agents[gemini])
"""
import json
from google import genai
from google.genai import types
from config import get_settings

settings = get_settings()
_MODEL = "gemini-2.0-flash"
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


async def generate_meal_plan(calories: float, protein_g: float, carbs_g: float, fat_g: float, goal: str) -> list[dict]:
    prompt = f"""You are a certified sports nutritionist AI for GymBro.
Generate a ONE-DAY meal plan (4 meals: Breakfast, Lunch, Snack, Dinner) for:
- Calories: {calories:.0f} kcal, Protein: {protein_g:.0f}g, Carbs: {carbs_g:.0f}g, Fat: {fat_g:.0f}g, Goal: {goal}
Return ONLY a JSON array, no markdown:
[{{"name":"Breakfast","calories":600,"protein_g":40,"carbs_g":60,"fat_g":15,"items":["Oatmeal","Eggs"]}}]"""
    response = await _get_client().aio.models.generate_content(
        model=_MODEL, contents=prompt,
        config=types.GenerateContentConfig(temperature=0.7),
    )
    raw = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
    return json.loads(raw)


async def generate_posture_report(analysis_data: dict) -> str:
    prompt = f"""You are a physical therapist AI. Analyze this posture data: {analysis_data}
Write a concise actionable report (max 200 words): key imbalances, injury risks, top 3 corrective exercises."""
    response = await _get_client().aio.models.generate_content(model=_MODEL, contents=prompt)
    return response.text.strip()


async def generate_corrective_exercises(posture_issues: list[str]) -> list[str]:
    prompt = f"""Issues: {', '.join(posture_issues)}. Return exactly 5 corrective exercises as a JSON array of strings. Only JSON."""
    response = await _get_client().aio.models.generate_content(model=_MODEL, contents=prompt)
    raw = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
    return json.loads(raw)


async def generate_form_feedback_narrative(faults: list[str], exercise: str) -> str:
    if not faults:
        return f"Great {exercise}! Your form looks solid — keep it up!"
    prompt = f"""Gym coach AI. Athlete doing {exercise} has: {', '.join(faults)}.
Give ONE coaching cue (max 15 words). Direct, actionable."""
    response = await _get_client().aio.models.generate_content(model=_MODEL, contents=prompt)
    return response.text.strip().strip('"')
