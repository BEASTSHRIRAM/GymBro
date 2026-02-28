"""
GymBro — Gemini Service
Uses: google-genai SDK (installed via vision-agents[gemini])
"""
import json
from google import genai
from google.genai import types
from config import get_settings

settings = get_settings()
_MODEL = "gemini-3-flash-preview"
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



async def generate_workout_split(user_stats: dict) -> dict:
    """
    Generate a personalized workout split using Gemini AI.
    
    Args:
        user_stats: Dictionary containing age, weight, height, goal, activity_level
        
    Returns:
        Dictionary containing structured workout split with days, exercises, sets, reps, rest periods
        
    Raises:
        TimeoutError: If request exceeds 10 seconds
        ValueError: If response is invalid or cannot be parsed
        Exception: For other API errors
    """
    import asyncio
    
    # Extract user stats
    age = user_stats.get("age")
    weight = user_stats.get("weight")
    height = user_stats.get("height")
    goal = user_stats.get("goal")
    activity_level = user_stats.get("activity_level")
    
    # Construct the prompt with all required user stats
    prompt = f"""You are a professional fitness coach. Generate a personalized workout split for a user with the following stats:

- Age: {age} years
- Weight: {weight} kg
- Height: {height} cm
- Fitness Goal: {goal}
- Activity Level: {activity_level}

Create a structured weekly workout split that includes:
1. Optimal training frequency (3-6 days per week)
2. Muscle group distribution across days
3. Specific exercises with sets, reps, and rest periods
4. Progressive overload recommendations

Return the response in the following JSON format (no markdown, just JSON):
{{
  "split_name": "string",
  "frequency": "string (e.g., '5 days per week')",
  "days": [
    {{
      "day_name": "string (e.g., 'Day 1: Chest & Triceps')",
      "exercises": [
        {{
          "name": "string",
          "sets": number,
          "reps": "string (e.g., '8-10')",
          "rest_seconds": number,
          "notes": "string (optional)"
        }}
      ],
      "notes": "string (optional)"
    }}
  ],
  "notes": "string (optional general notes)"
}}"""
    
    # Retry logic: 1 retry on failure
    max_attempts = 2
    last_error = None
    
    for attempt in range(max_attempts):
        try:
            # Implement 10-second timeout
            response = await asyncio.wait_for(
                _get_client().aio.models.generate_content(
                    model=_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.7),
                ),
                timeout=10.0
            )
            
            # Parse and validate Gemini response
            raw = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
            workout_split = json.loads(raw)
            
            # Validate the structure
            if not isinstance(workout_split, dict):
                raise ValueError("Response is not a dictionary")
            
            required_fields = ["split_name", "frequency", "days"]
            for field in required_fields:
                if field not in workout_split:
                    raise ValueError(f"Missing required field: {field}")
            
            if not isinstance(workout_split["days"], list) or len(workout_split["days"]) == 0:
                raise ValueError("Days must be a non-empty list")
            
            # Validate each day structure
            for day in workout_split["days"]:
                if not isinstance(day, dict):
                    raise ValueError("Each day must be a dictionary")
                if "day_name" not in day or "exercises" not in day:
                    raise ValueError("Each day must have day_name and exercises")
                if not isinstance(day["exercises"], list) or len(day["exercises"]) == 0:
                    raise ValueError("Each day must have a non-empty exercises list")
                
                # Validate each exercise structure
                for exercise in day["exercises"]:
                    if not isinstance(exercise, dict):
                        raise ValueError("Each exercise must be a dictionary")
                    required_exercise_fields = ["name", "sets", "reps", "rest_seconds"]
                    for field in required_exercise_fields:
                        if field not in exercise:
                            raise ValueError(f"Exercise missing required field: {field}")
            
            # If validation passes, return the workout split
            return workout_split
            
        except asyncio.TimeoutError:
            last_error = TimeoutError("Workout split generation timed out after 10 seconds")
            if attempt < max_attempts - 1:
                continue  # Retry
            raise last_error
            
        except json.JSONDecodeError as e:
            last_error = ValueError(f"Failed to parse Gemini response as JSON: {str(e)}")
            if attempt < max_attempts - 1:
                continue  # Retry
            raise last_error
            
        except ValueError as e:
            last_error = e
            if attempt < max_attempts - 1:
                continue  # Retry
            raise last_error
            
        except Exception as e:
            last_error = Exception(f"Error generating workout split: {str(e)}")
            if attempt < max_attempts - 1:
                continue  # Retry
            raise last_error
    
    # If we get here, all retries failed
    raise last_error
