"""
GymBro — Auth Service
Password hashing, JWT tokens, OTP generation & email
"""
import random
import string
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from jose import JWTError, jwt
from passlib.context import CryptContext

from config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password ─────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    # bcrypt 5.0 strictly enforces 72-byte max — truncate safely
    return pwd_context.hash(password.encode()[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain.encode()[:72], hashed)


# ─── OTP ──────────────────────────────────────────────────────────────────────
def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def get_otp_expiry(minutes: int = 10) -> datetime:
    return datetime.utcnow() + timedelta(minutes=minutes)


def check_rate_limit(user: dict) -> tuple[bool, int]:
    """
    Check if user can request a new OTP based on rate limiting.
    
    Args:
        user: User document from database
        
    Returns:
        Tuple of (is_allowed, remaining_seconds)
        - is_allowed: True if user can request OTP, False if still in cooldown
        - remaining_seconds: Seconds remaining in cooldown (0 if allowed)
    """
    last_generated = user.get("last_otp_generated_at")
    if not last_generated:
        return (True, 0)
    
    elapsed = (datetime.utcnow() - last_generated).total_seconds()
    cooldown = 60  # seconds
    
    if elapsed < cooldown:
        remaining = int(cooldown - elapsed)
        return (False, remaining)
    
    return (True, 0)


async def send_otp_email(to_email: str, otp: str) -> None:
    """Send OTP via Gmail SMTP using aiosmtplib."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "GymBro — Your Verification Code"
    msg["From"] = settings.gmail_user
    msg["To"] = to_email

    html = f"""
    <html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:40px;">
      <div style="max-width:480px;margin:auto;background:#1a1a1a;border-radius:16px;padding:32px;border:1px solid #FF6B35;">
        <h2 style="color:#FF6B35;margin-bottom:8px;">🏋️ GymBro</h2>
        <h3>Your Verification Code</h3>
        <div style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#FF6B35;margin:24px 0;">
          {otp}
        </div>
        <p style="color:#aaa;">This code expires in <strong style="color:#fff;">10 minutes</strong>.</p>
        <p style="color:#555;font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(settings.gmail_user, settings.gmail_app_password)
        server.sendmail(settings.gmail_user, to_email, msg.as_string())


# ─── JWT ──────────────────────────────────────────────────────────────────────
def create_access_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
