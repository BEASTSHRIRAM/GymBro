"""
GymBro — Context Service (MongoDB)
Stores full user context: body scans, training history, diet, voice insights.
GymBro knows everything about the user — like a real gym buddy.
Future: migrate to Velky for optimized context retrieval.
"""
from datetime import datetime
from typing import Optional
from database import get_db


class GymBroContextService:
    """
    Central context engine for GymBro companion memory.
    Stores and retrieves all user data across features.

    MongoDB collection: 'gymbro_context' (one document per user)
    """

    def __init__(self):
        self.db = None

    def _get_db(self):
        if self.db is None:
            self.db = get_db()
        return self.db

    async def get_full_context(self, user_id: str) -> dict:
        """
        Get complete user context for AI coaching prompts.
        Combines: profile, body scan, training history, diet, preferences.
        """
        db = self._get_db()

        # Get or create context document
        ctx = await db["gymbro_context"].find_one({"user_id": user_id})
        if not ctx:
            ctx = {
                "user_id": user_id,
                "created_at": datetime.utcnow(),
                "profile": {},
                "body_scan": {},
                "training_history": [],
                "diet": {},
                "preferences": {},
                "voice_insights": [],
            }
            await db["gymbro_context"].insert_one(ctx)

        # Also fetch latest body scan from body_scans collection
        latest_scan = await db["body_scans"].find_one(
            {"user_id": user_id},
            sort=[("scan_date", -1)]
        )
        if latest_scan:
            ctx["body_scan"] = {
                "body_fat_estimate": latest_scan.get("body_fat_estimate"),
                "posture_issues": latest_scan.get("posture_issues", []),
                "scan_date": str(latest_scan.get("scan_date", "")),
            }

        # Fetch user profile
        user = await db["users"].find_one({"_id": user_id}) or await db["users"].find_one({"user_id": user_id})
        if user:
            ctx["profile"] = {
                "name": user.get("name", ""),
                "weight_kg": user.get("weight_kg"),
                "height_cm": user.get("height_cm"),
                "age": user.get("age"),
                "gender": user.get("gender"),
                "location": user.get("location", ""),
                "goal": user.get("fitness_goal", user.get("goal", "")),
            }

        # Clean up MongoDB _id for serialization
        ctx.pop("_id", None)
        return ctx

    async def save_training_summary(self, user_id: str, session_data: dict) -> None:
        """
        Save training session summary to user's context.
        Called after each training session ends.
        """
        db = self._get_db()

        summary = {
            "session_id": session_data.get("session_id", ""),
            "exercise": session_data.get("exercise", ""),
            "duration_seconds": session_data.get("duration_seconds", 0),
            "total_reps": session_data.get("total_reps", 0),
            "avg_form_score": session_data.get("avg_form_score", 0),
            "faults": session_data.get("unique_faults", []),
            "timestamp": datetime.utcnow(),
        }

        # Append to training history (keep last 50 sessions)
        await db["gymbro_context"].update_one(
            {"user_id": user_id},
            {
                "$push": {
                    "training_history": {
                        "$each": [summary],
                        "$slice": -50,  # Keep last 50
                    }
                },
                "$set": {
                    "last_training": summary,
                    "updated_at": datetime.utcnow(),
                },
                "$setOnInsert": {
                    "user_id": user_id,
                    "created_at": datetime.utcnow(),
                    "profile": {},
                    "body_scan": {},
                    "diet": {},
                    "preferences": {},
                    "voice_insights": [],
                },
            },
            upsert=True,
        )
        print(f"[GymBroContext] ✓ Saved training summary for {user_id}: {session_data.get('exercise')} ({session_data.get('duration_seconds', 0)}s)")

    async def save_voice_insight(self, user_id: str, transcript: str, response: str) -> None:
        """Save key voice interaction for context building."""
        db = self._get_db()

        insight = {
            "user_said": transcript,
            "coach_said": response,
            "timestamp": datetime.utcnow(),
        }

        await db["gymbro_context"].update_one(
            {"user_id": user_id},
            {
                "$push": {
                    "voice_insights": {
                        "$each": [insight],
                        "$slice": -30,  # Keep last 30 interactions
                    }
                },
                "$set": {"updated_at": datetime.utcnow()},
            },
            upsert=True,
        )

    async def update_preferences(self, user_id: str, preferences: dict) -> None:
        """Update user preferences (location, diet type, etc.)."""
        db = self._get_db()
        await db["gymbro_context"].update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "preferences": preferences,
                    "updated_at": datetime.utcnow(),
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow(),
                    "user_id": user_id,
                },
            },
            upsert=True,
        )

    def build_coaching_prompt(self, context: dict, exercise: str) -> str:
        """
        Build a contextual prompt for the AI coach using full user data.
        This makes GymBro truly know the user.
        """
        parts = [f"You are GymBro, coaching {exercise.replace('_', ' ')}."]

        # Profile context
        profile = context.get("profile", {})
        if profile.get("name"):
            parts.append(f"User's name: {profile['name']}.")
        if profile.get("weight_kg"):
            parts.append(f"Weight: {profile['weight_kg']}kg.")
        if profile.get("goal"):
            parts.append(f"Goal: {profile['goal']}.")
        if profile.get("location"):
            parts.append(f"Location: {profile['location']}.")

        # Body scan context
        scan = context.get("body_scan", {})
        if scan.get("posture_issues"):
            parts.append(f"Known posture issues: {', '.join(scan['posture_issues'])}.")

        # Training history context
        history = context.get("training_history", [])
        if history:
            recent = history[-3:]  # Last 3 sessions
            for s in recent:
                parts.append(
                    f"Recent {s.get('exercise', '?')}: {s.get('total_reps', 0)} reps, "
                    f"{s.get('avg_form_score', 0):.0f}% form"
                    + (f", faults: {', '.join(s['faults'])}" if s.get("faults") else "")
                )

        return " ".join(parts)


# ── Singleton ────────────────────────────────────────────────────────────────
_context_service = None


def get_context_service() -> GymBroContextService:
    global _context_service
    if _context_service is None:
        _context_service = GymBroContextService()
    return _context_service
