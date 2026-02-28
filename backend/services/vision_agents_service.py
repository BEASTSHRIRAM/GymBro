"""
GymBro — Vision Agents SDK Integration Service
Real-time pose estimation and form analysis using Vision Agents SDK
"""
import os
import base64
import json
import httpx
from typing import Dict, List, Optional
from datetime import datetime

VISION_AGENTS_API_KEY = os.getenv("VISIONAGENTS_API_KEY")
VISION_AGENTS_BASE_URL = os.getenv("VISIONAGENTS_BASE_URL", "https://api.visionagents.ai")

# Exercise-specific thresholds for rep counting
EXERCISE_THRESHOLDS = {
    "squat": {"down": 100, "up": 150, "joint": "knee"},
    "bench_press": {"down": 60, "up": 160, "joint": "elbow"},
    "deadlift": {"down": 90, "up": 170, "joint": "hip"},
    "shoulder_press": {"down": 70, "up": 160, "joint": "elbow"},
}


class VisionAgentsService:
    """Service for real-time pose estimation using Vision Agents SDK"""
    
    def __init__(self):
        self.api_key = VISION_AGENTS_API_KEY
        self.base_url = VISION_AGENTS_BASE_URL
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def analyze_frame(
        self,
        frame_b64: str,
        exercise: str,
        session_state: dict
    ) -> dict:
        """
        Analyze video frame for pose estimation and form analysis.
        
        Args:
            frame_b64: Base64-encoded JPEG frame
            exercise: Exercise name (squat, bench_press, etc.)
            session_state: Current session state for temporal analysis
            
        Returns:
            Analysis dict with keypoints, angles, faults, rep_count, form_score
        """
        try:
            # Call Vision Agents API for pose estimation
            keypoints = await self._get_pose_keypoints(frame_b64)
            
            if not keypoints:
                return self._empty_analysis()
            
            # Calculate joint angles
            joint_angles = self._calculate_joint_angles(keypoints, exercise)
            
            # Detect form faults
            faults = self._detect_form_faults(keypoints, joint_angles, exercise)
            
            # Update rep count using temporal state machine
            rep_count = self._update_rep_count(
                joint_angles,
                exercise,
                session_state
            )
            
            # Calculate form score (0-100)
            form_score = self._calculate_form_score(faults, joint_angles, exercise)
            
            return {
                "keypoints": keypoints,
                "joint_angles": joint_angles,
                "faults": [f["type"] for f in faults],
                "fault_details": faults,
                "rep_count": rep_count,
                "form_score": form_score,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            print(f"[VisionAgents] Error analyzing frame: {e}")
            return self._empty_analysis()
    
    async def _get_pose_keypoints(self, frame_b64: str) -> Optional[dict]:
        """Extract pose keypoints from frame using Vision Agents API"""
        try:
            # Try the /v1/pose endpoint (original API)
            response = await self.client.post(
                f"{self.base_url}/v1/pose",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "image": frame_b64,
                    "model": "body_pose_v2"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("keypoints", {})
            else:
                print(f"[VisionAgents] API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"[VisionAgents] Request failed: {e}")
            return None
    
    def _calculate_joint_angles(self, keypoints: dict, exercise: str) -> dict:
        """Calculate exercise-specific joint angles from keypoints"""
        angles = {}
        
        try:
            if exercise == "squat":
                # Calculate knee angle
                angles["knee_left"] = self._angle_between_points(
                    keypoints.get("left_hip", []),
                    keypoints.get("left_knee", []),
                    keypoints.get("left_ankle", [])
                )
                angles["knee_right"] = self._angle_between_points(
                    keypoints.get("right_hip", []),
                    keypoints.get("right_knee", []),
                    keypoints.get("right_ankle", [])
                )
                angles["knee_avg"] = (angles["knee_left"] + angles["knee_right"]) / 2
                
            elif exercise == "bench_press":
                # Calculate elbow angle
                angles["elbow_left"] = self._angle_between_points(
                    keypoints.get("left_shoulder", []),
                    keypoints.get("left_elbow", []),
                    keypoints.get("left_wrist", [])
                )
                angles["elbow_right"] = self._angle_between_points(
                    keypoints.get("right_shoulder", []),
                    keypoints.get("right_elbow", []),
                    keypoints.get("right_wrist", [])
                )
                angles["elbow_avg"] = (angles["elbow_left"] + angles["elbow_right"]) / 2
                
            elif exercise == "deadlift":
                # Calculate hip hinge angle
                angles["hip_left"] = self._angle_between_points(
                    keypoints.get("left_shoulder", []),
                    keypoints.get("left_hip", []),
                    keypoints.get("left_knee", [])
                )
                angles["hip_right"] = self._angle_between_points(
                    keypoints.get("right_shoulder", []),
                    keypoints.get("right_hip", []),
                    keypoints.get("right_knee", [])
                )
                angles["hip_avg"] = (angles["hip_left"] + angles["hip_right"]) / 2
                
            elif exercise == "shoulder_press":
                # Calculate elbow angle
                angles["elbow_left"] = self._angle_between_points(
                    keypoints.get("left_shoulder", []),
                    keypoints.get("left_elbow", []),
                    keypoints.get("left_wrist", [])
                )
                angles["elbow_right"] = self._angle_between_points(
                    keypoints.get("right_shoulder", []),
                    keypoints.get("right_elbow", []),
                    keypoints.get("right_wrist", [])
                )
                angles["elbow_avg"] = (angles["elbow_left"] + angles["elbow_right"]) / 2
                
        except Exception as e:
            print(f"[VisionAgents] Error calculating angles: {e}")
        
        return angles
    
    def _angle_between_points(self, p1: list, p2: list, p3: list) -> float:
        """Calculate angle between three points (in degrees)"""
        import math
        
        if not p1 or not p2 or not p3 or len(p1) < 2 or len(p2) < 2 or len(p3) < 2:
            return 0.0
        
        # Vector from p2 to p1
        v1 = [p1[0] - p2[0], p1[1] - p2[1]]
        # Vector from p2 to p3
        v2 = [p3[0] - p2[0], p3[1] - p2[1]]
        
        # Calculate angle using dot product
        dot = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)
        
        if mag1 == 0 or mag2 == 0:
            return 0.0
        
        cos_angle = dot / (mag1 * mag2)
        cos_angle = max(-1.0, min(1.0, cos_angle))  # Clamp to [-1, 1]
        angle_rad = math.acos(cos_angle)
        angle_deg = math.degrees(angle_rad)
        
        return angle_deg
    
    def _detect_form_faults(
        self,
        keypoints: dict,
        joint_angles: dict,
        exercise: str
    ) -> List[dict]:
        """Detect form faults based on keypoints and angles"""
        faults = []
        
        try:
            if exercise == "squat":
                # Check for knee valgus (knees caving in)
                left_knee = keypoints.get("left_knee", [])
                right_knee = keypoints.get("right_knee", [])
                left_ankle = keypoints.get("left_ankle", [])
                right_ankle = keypoints.get("right_ankle", [])
                
                if left_knee and right_knee and left_ankle and right_ankle:
                    knee_width = abs(left_knee[0] - right_knee[0])
                    ankle_width = abs(left_ankle[0] - right_ankle[0])
                    
                    if knee_width < ankle_width * 0.8:
                        faults.append({
                            "type": "knee_valgus",
                            "severity": "high",
                            "description": "Knees caving inward",
                            "correction": "Push knees outward, align with toes"
                        })
                
                # Check for incomplete depth
                knee_angle = joint_angles.get("knee_avg", 180)
                if knee_angle > 110:
                    faults.append({
                        "type": "incomplete_depth",
                        "severity": "medium",
                        "description": "Not reaching full depth",
                        "correction": "Squat deeper, aim for parallel or below"
                    })
                    
            elif exercise == "bench_press":
                # Check for elbow flare
                elbow_angle = joint_angles.get("elbow_avg", 90)
                if elbow_angle < 50 or elbow_angle > 100:
                    faults.append({
                        "type": "elbow_flare",
                        "severity": "medium",
                        "description": "Elbows flaring out",
                        "correction": "Keep elbows at 45-degree angle"
                    })
                    
            elif exercise == "deadlift":
                # Check for back rounding
                # (Simplified - would need more sophisticated spine curve analysis)
                hip_angle = joint_angles.get("hip_avg", 180)
                if hip_angle < 80:
                    faults.append({
                        "type": "back_rounding",
                        "severity": "high",
                        "description": "Back rounding detected",
                        "correction": "Keep spine neutral, chest up"
                    })
                    
        except Exception as e:
            print(f"[VisionAgents] Error detecting faults: {e}")
        
        return faults
    
    def _update_rep_count(
        self,
        joint_angles: dict,
        exercise: str,
        session_state: dict
    ) -> int:
        """Update rep count using temporal state machine"""
        thresholds = EXERCISE_THRESHOLDS.get(exercise, {"down": 90, "up": 160})
        
        # Get the relevant angle based on exercise
        if exercise == "squat":
            angle = joint_angles.get("knee_avg", 180)
        elif exercise in ["bench_press", "shoulder_press"]:
            angle = joint_angles.get("elbow_avg", 180)
        elif exercise == "deadlift":
            angle = joint_angles.get("hip_avg", 180)
        else:
            return session_state.get("reps", 0)
        
        current_position = session_state.get("position", "up")
        rep_count = session_state.get("reps", 0)
        
        # State machine transitions
        if current_position == "up" and angle < thresholds["down"]:
            # Transitioning to bottom position
            session_state["position"] = "down"
            session_state["down_timestamp"] = datetime.utcnow()
            
        elif current_position == "down" and angle > thresholds["up"]:
            # Completed rep: down → up transition
            session_state["position"] = "up"
            rep_count += 1
            session_state["reps"] = rep_count
            
            # Calculate rep duration
            if "down_timestamp" in session_state:
                duration = (datetime.utcnow() - session_state["down_timestamp"]).total_seconds()
                
                # Detect tempo issues
                if duration < 1.0:
                    session_state.setdefault("tempo_warnings", []).append("too_fast")
                elif duration > 5.0:
                    session_state.setdefault("tempo_warnings", []).append("too_slow")
        
        return rep_count
    
    def _calculate_form_score(
        self,
        faults: List[dict],
        joint_angles: dict,
        exercise: str
    ) -> float:
        """Calculate form score (0-100) based on faults and angles"""
        base_score = 100.0
        
        # Deduct points for faults
        for fault in faults:
            severity = fault.get("severity", "low")
            if severity == "high":
                base_score -= 20
            elif severity == "medium":
                base_score -= 10
            else:
                base_score -= 5
        
        # Ensure score is in valid range
        return max(0.0, min(100.0, base_score))
    
    def _empty_analysis(self) -> dict:
        """Return empty analysis when pose detection fails"""
        return {
            "keypoints": {},
            "joint_angles": {},
            "faults": [],
            "fault_details": [],
            "rep_count": 0,
            "form_score": 0.0,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Singleton instance
_vision_service = None

def get_vision_service() -> VisionAgentsService:
    """Get or create Vision Agents service instance"""
    global _vision_service
    if _vision_service is None:
        _vision_service = VisionAgentsService()
    return _vision_service
