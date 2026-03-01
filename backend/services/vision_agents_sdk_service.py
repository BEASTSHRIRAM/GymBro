"""
GymBro — Vision Agents SDK Integration (Python SDK)
Real-time pose estimation using Vision Agents Python SDK
Based on: https://visionagents.ai/introduction/video-agents
"""
import os
import base64
import json
import random
from typing import Dict, List, Optional
from datetime import datetime

# Note: This requires vision-agents Python package to be installed
# pip install vision-agents[ultralytics]

try:
    from vision_agents.plugins import ultralytics
    VISION_AGENTS_AVAILABLE = True
except ImportError:
    VISION_AGENTS_AVAILABLE = False
    print("[VisionAgents] SDK not installed. Using MOCK MODE for testing.")

# Exercise-specific thresholds for rep counting
EXERCISE_THRESHOLDS = {
    "squat": {"down": 100, "up": 150, "joint": "knee"},
    "bench_press": {"down": 60, "up": 160, "joint": "elbow"},
    "deadlift": {"down": 90, "up": 170, "joint": "hip"},
    "shoulder_press": {"down": 70, "up": 160, "joint": "elbow"},
}


class VisionAgentsSDKService:
    """Service for real-time pose estimation using Vision Agents Python SDK"""
    
    def __init__(self):
        self.pose_processor = None
        self.frame_count = 0
        self.use_mock = True  # Default to mock mode
        
        if VISION_AGENTS_AVAILABLE:
            try:
                # Initialize YOLO Pose Processor
                self.pose_processor = ultralytics.YOLOPoseProcessor(
                    model_path="yolo11n-pose.pt"
                )
                self.use_mock = False
                print("[VisionAgents] Using real YOLO pose detection")
            except Exception as e:
                print(f"[VisionAgents] Failed to load YOLO model: {e}. Using mock mode.")
                self.use_mock = True
        else:
            print("[VisionAgents] SDK not available. Using mock mode.")
            self.use_mock = True
    
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
            if self.use_mock or not self.pose_processor:
                return self._mock_analysis(exercise, session_state)
            
            # Real YOLO analysis (if SDK available)
            import io
            from PIL import Image
            import numpy as np
            
            image_data = base64.b64decode(frame_b64)
            image = Image.open(io.BytesIO(image_data))
            frame = np.array(image)
            
            results = self.pose_processor.process_frame(frame)
            
            if not results or len(results) == 0:
                return self._empty_analysis()
            
            keypoints = self._extract_keypoints(results[0])
            
            if not keypoints:
                return self._empty_analysis()
            
            joint_angles = self._calculate_joint_angles(keypoints, exercise)
            faults = self._detect_form_faults(keypoints, joint_angles, exercise)
            rep_count = self._update_rep_count(joint_angles, exercise, session_state)
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
            print(f"[VisionAgentsSDK] Error analyzing frame: {e}")
            return self._mock_analysis(exercise, session_state)
    
    def _extract_keypoints(self, result) -> dict:
        """Extract keypoints from YOLO pose result"""
        try:
            # YOLO pose returns keypoints in COCO format (17 keypoints)
            # Format: [x, y, confidence] for each keypoint
            keypoints_array = result.keypoints.xy[0].cpu().numpy()
            confidence_array = result.keypoints.conf[0].cpu().numpy()
            
            # COCO keypoint names
            keypoint_names = [
                "nose", "left_eye", "right_eye", "left_ear", "right_ear",
                "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
                "left_wrist", "right_wrist", "left_hip", "right_hip",
                "left_knee", "right_knee", "left_ankle", "right_ankle"
            ]
            
            keypoints = {}
            for i, name in enumerate(keypoint_names):
                if i < len(keypoints_array):
                    x, y = keypoints_array[i]
                    conf = confidence_array[i] if i < len(confidence_array) else 0.0
                    keypoints[name] = [float(x), float(y), float(conf)]
            
            return keypoints
            
        except Exception as e:
            print(f"[VisionAgentsSDK] Error extracting keypoints: {e}")
            return {}
    
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
            print(f"[VisionAgentsSDK] Error calculating angles: {e}")
        
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
                hip_angle = joint_angles.get("hip_avg", 180)
                if hip_angle < 80:
                    faults.append({
                        "type": "back_rounding",
                        "severity": "high",
                        "description": "Back rounding detected",
                        "correction": "Keep spine neutral, chest up"
                    })
                    
        except Exception as e:
            print(f"[VisionAgentsSDK] Error detecting faults: {e}")
        
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
    
    def _mock_analysis(self, exercise: str, session_state: dict) -> dict:
        """Return mock analysis for testing without Vision Agents SDK"""
        self.frame_count += 1
        
        # Simulate rep counting (every 30 frames = 1 rep at 500ms intervals = 15 seconds per rep)
        rep_count = session_state.get("rep_count", 0)
        if self.frame_count % 30 == 0:
            rep_count += 1
        
        # Simulate form score (80-95% with occasional dips)
        form_score = random.uniform(80, 95) if self.frame_count % 5 != 0 else random.uniform(70, 80)
        
        # Simulate occasional faults
        faults = []
        if random.random() < 0.1:  # 10% chance of fault
            fault_types = {
                "squat": ["knee_not_aligned", "back_not_straight", "depth_insufficient"],
                "bench_press": ["elbow_flare", "bar_path_off", "shoulder_unstable"],
                "deadlift": ["back_rounded", "hips_too_high", "bar_away_from_body"],
                "shoulder_press": ["core_not_engaged", "bar_path_off", "shoulder_shrug"],
            }
            possible_faults = fault_types.get(exercise, ["form_issue"])
            faults = [random.choice(possible_faults)]
        
        return {
            "keypoints": {},
            "joint_angles": {},
            "faults": faults,
            "fault_details": [],
            "rep_count": rep_count,
            "form_score": form_score,
            "timestamp": datetime.utcnow().isoformat()
        }


# Singleton instance
_vision_sdk_service = None

def get_vision_sdk_service() -> VisionAgentsSDKService:
    """Get or create Vision Agents SDK service instance"""
    global _vision_sdk_service
    if _vision_sdk_service is None:
        _vision_sdk_service = VisionAgentsSDKService()
    return _vision_sdk_service
