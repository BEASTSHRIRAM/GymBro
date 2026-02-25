"""
Backend routers package — explicit imports for main.py
"""
from routers import auth, strength, diet, body_scan, gamification, coaches, form_checker

__all__ = ["auth", "strength", "diet", "body_scan", "gamification", "coaches", "form_checker"]
