"""
GymBro — Body Scan Router
POST /body-scan/analyze  — Upload video for VisionAgents posture analysis
GET  /body-scan/report/{scan_id} — Retrieve posture report
GET  /body-scan/history  — All body scans for user
"""
import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from datetime import datetime
from bson import ObjectId

from database import get_db
from routers.auth import get_current_user
from services.gemini_service import generate_posture_report, generate_corrective_exercises
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/body-scan", tags=["body-scan"])


@router.post("/analyze")
async def analyze_body_scan(
    video: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Accept a 360° video upload, send to VisionAgents for body analysis,
    then use Gemini to generate a narrative posture report.
    """
    db = get_db()
    user_id = str(user["_id"])

    video_bytes = await video.read()
    video_b64 = base64.b64encode(video_bytes).decode()

    # ── Call VisionAgents body scan endpoint ──────────────────────────────
    analysis_data = {}
    body_fat = None
    imbalance_scores = {}
    posture_issues = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.visionagents_base_url}/v1/body-scan",
                headers={"Authorization": f"Bearer {settings.visionagents_api_key}"},
                json={"video": video_b64, "model": "body_scan_v1"},
            )
            if resp.status_code == 200:
                analysis_data = resp.json()
                body_fat = analysis_data.get("body_fat_percentage")
                imbalance_scores = analysis_data.get("imbalance_scores", {})
                posture_issues = analysis_data.get("posture_issues", [])
    except Exception as e:
        print(f"[BodyScan] VisionAgents error: {e}")
        # Graceful fallback — still generate report with empty data
        analysis_data = {"error": str(e), "note": "VisionAgents unavailable"}
        posture_issues = ["VisionAgents analysis unavailable"]

    # ── Generate narrative report via Gemini ──────────────────────────────
    report_text = await generate_posture_report(analysis_data)
    corrective_exercises = await generate_corrective_exercises(posture_issues)

    scan_doc = {
        "user_id": user_id,
        "body_fat_estimate": body_fat,
        "posture_analysis": report_text,
        "imbalance_scores": imbalance_scores,
        "posture_issues": posture_issues,
        "corrective_exercises": corrective_exercises,
        "scan_date": datetime.utcnow(),
    }
    result = await db["body_scans"].insert_one(scan_doc)
    scan_doc["id"] = str(result.inserted_id)

    return scan_doc


@router.get("/report/{scan_id}")
async def get_report(scan_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scan ID")

    scan = await db["body_scans"].find_one({"_id": oid, "user_id": user_id})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan["id"] = str(scan.pop("_id"))
    return scan


@router.get("/history")
async def get_scan_history(user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(user["_id"])
    cursor = db["body_scans"].find({"user_id": user_id}).sort("scan_date", -1).limit(10)
    scans = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        scans.append(doc)
    return {"scans": scans}
