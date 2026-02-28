"""
GymBro — VisionAgents SDK Integration
Real-time form analysis: keypoints, joint angles, fault detection, rep counting.
"""
import base64
import math
import os
import httpx
from config import get_settings

settings = get_settings()

# Set Vision Agents credentials
os.environ['VISIONAGENTS_API_KEY'] = settings.visionagents_api_key
os.environ['VISIONAGENTS_SECRET_KEY'] = settings.visionagents_secret_key

# Supported exercises and their key joints to monitor
EXERCISE_JOINTS = {
    "squat": {
        "monitor": ["hip", "knee", "ankle", "spine"],
        "faults": {
            "knee_valgus": {"threshold": 10, "description": "Knee collapsing inward"},
            "incomplete_depth": {"threshold": 90, "description": "Not reaching parallel"},
            "back_rounding": {"threshold": 45, "description": "Lower back rounding"},
            "forward_lean": {"threshold": 60, "description": "Excessive forward lean"},
        },
    },
    "bench_press": {
        "monitor": ["shoulder", "elbow", "wrist"],
        "faults": {
            "elbow_flare": {"threshold": 75, "description": "Elbows flaring out"},
            "wrist_deviation": {"threshold": 20, "description": "Wrists bending"},
            "uneven_bar": {"threshold": 5, "description": "Bar path uneven"},
        },
    },
    "deadlift": {
        "monitor": ["hip", "knee", "spine", "shoulder"],
        "faults": {
            "back_rounding": {"threshold": 30, "description": "Back rounding under load"},
            "hip_shift": {"threshold": 10, "description": "Hip shifting laterally"},
            "bar_drift": {"threshold": 15, "description": "Bar drifting from body"},
        },
    },
    "shoulder_press": {
        "monitor": ["shoulder", "elbow", "spine"],
        "faults": {
            "elbow_flare": {"threshold": 90, "description": "Elbows too wide"},
            "back_arch": {"threshold": 20, "description": "Excessive lumbar arch"},
            "wrist_deviation": {"threshold": 15, "description": "Wrists bent forward"},
        },
    },
}


def calculate_angle(a: list, b: list, c: list) -> float:
    """
    Calculate the angle at joint B formed by points A-B-C.
    Points are [x, y] or [x, y, z] coordinates (normalized 0-1).
    """
    try:
        ax, ay = a[0] - b[0], a[1] - b[1]
        cx, cy = c[0] - b[0], c[1] - b[1]
        dot = ax * cx + ay * cy
        mag_a = math.sqrt(ax**2 + ay**2)
        mag_c = math.sqrt(cx**2 + cy**2)
        if mag_a == 0 or mag_c == 0:
            return 0.0
        cos_angle = max(-1, min(1, dot / (mag_a * mag_c)))
        return math.degrees(math.acos(cos_angle))
    except Exception:
        return 0.0


async def analyze_frame(
    frame_b64: str,
    exercise: str,
    session_state: dict,
) -> dict:
    """
    Send a single frame to VisionAgents for keypoint detection,
    then compute angles, detect faults, update rep count.

    Args:
        frame_b64: Base64-encoded JPEG frame from Expo Camera
        exercise: Exercise name (squat, bench_press, deadlift, shoulder_press)
        session_state: Mutable dict tracking reps, position phase, etc.

    Returns:
        {
            keypoints: dict,
            joint_angles: dict,
            faults: list[str],
            feedback: str,
            rep_count: int,
            form_score: float,
        }
    """
    exercise_key = exercise.lower().replace(" ", "_")
    config = EXERCISE_JOINTS.get(exercise_key, EXERCISE_JOINTS["squat"])

    # ── Call VisionAgents API ──────────────────────────────────────────────
    keypoints = {}
    joint_angles = {}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.visionagents_base_url}/v1/pose",
                headers={"Authorization": f"Bearer {settings.visionagents_api_key}"},
                json={"image": frame_b64, "model": "body_pose_v2"},
            )
            if resp.status_code == 200:
                data = resp.json()
                keypoints = data.get("keypoints", {})
            else:
                # Fallback: return empty analysis
                print(f"[VisionAgents] API returned status {resp.status_code}: {resp.text}")
                return _empty_analysis(session_state)
    except Exception as e:
        print(f"[VisionAgents] Error calling API: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return _empty_analysis(session_state)

    # ── Compute joint angles ───────────────────────────────────────────────
    kp = keypoints  # normalized {name: [x, y, confidence]}

    def get_pt(name):
        return kp.get(name, [0.5, 0.5, 0.0])[:2]

    if exercise_key == "squat":
        joint_angles = {
            "left_knee": calculate_angle(get_pt("left_hip"), get_pt("left_knee"), get_pt("left_ankle")),
            "right_knee": calculate_angle(get_pt("right_hip"), get_pt("right_knee"), get_pt("right_ankle")),
            "left_hip": calculate_angle(get_pt("left_shoulder"), get_pt("left_hip"), get_pt("left_knee")),
            "spine": calculate_angle(get_pt("neck"), get_pt("left_hip"), get_pt("left_ankle")),
        }
    elif exercise_key == "bench_press":
        joint_angles = {
            "left_elbow": calculate_angle(get_pt("left_shoulder"), get_pt("left_elbow"), get_pt("left_wrist")),
            "right_elbow": calculate_angle(get_pt("right_shoulder"), get_pt("right_elbow"), get_pt("right_wrist")),
            "shoulder_width": calculate_angle(get_pt("left_shoulder"), get_pt("neck"), get_pt("right_shoulder")),
        }
    elif exercise_key == "deadlift":
        joint_angles = {
            "hip_hinge": calculate_angle(get_pt("left_shoulder"), get_pt("left_hip"), get_pt("left_knee")),
            "spine": calculate_angle(get_pt("neck"), get_pt("left_hip"), get_pt("left_ankle")),
            "knee": calculate_angle(get_pt("left_hip"), get_pt("left_knee"), get_pt("left_ankle")),
        }
    elif exercise_key == "shoulder_press":
        joint_angles = {
            "left_elbow": calculate_angle(get_pt("left_shoulder"), get_pt("left_elbow"), get_pt("left_wrist")),
            "right_elbow": calculate_angle(get_pt("right_shoulder"), get_pt("right_elbow"), get_pt("right_wrist")),
            "spine": calculate_angle(get_pt("neck"), get_pt("left_hip"), get_pt("left_ankle")),
        }

    # ── Fault Detection ───────────────────────────────────────────────────
    faults = _detect_faults(exercise_key, joint_angles, config)

    # ── Rep Counting (heuristic on primary angle) ──────────────────────────
    primary_angle = _get_primary_angle(exercise_key, joint_angles)
    rep_count = _update_rep_count(primary_angle, exercise_key, session_state)

    # ── Form Score (0-100) ────────────────────────────────────────────────
    form_score = max(0.0, 100.0 - len(faults) * 15)

    return {
        "keypoints": keypoints,
        "joint_angles": joint_angles,
        "faults": faults,
        "rep_count": rep_count,
        "form_score": round(form_score, 1),
    }


def _detect_faults(exercise: str, angles: dict, config: dict) -> list[str]:
    faults = []
    if exercise == "squat":
        knee_avg = (angles.get("left_knee", 180) + angles.get("right_knee", 180)) / 2
        if knee_avg > 100:
            faults.append("incomplete_depth")
        spine_angle = angles.get("spine", 90)
        if spine_angle > 135:
            faults.append("back_rounding")
        hip_angle = angles.get("left_hip", 90)
        if hip_angle < 60:
            faults.append("forward_lean")
    elif exercise == "bench_press":
        left_el = angles.get("left_elbow", 90)
        right_el = angles.get("right_elbow", 90)
        if abs(left_el - right_el) > 20:
            faults.append("uneven_bar")
        if left_el < 60 or right_el < 60:
            faults.append("elbow_flare")
    elif exercise == "deadlift":
        spine = angles.get("spine", 90)
        if spine > 150:
            faults.append("back_rounding")
        hip = angles.get("hip_hinge", 90)
        if hip > 160:
            faults.append("hip_shift")
    elif exercise == "shoulder_press":
        spine = angles.get("spine", 90)
        if spine > 160:
            faults.append("back_arch")
    return faults


def _get_primary_angle(exercise: str, angles: dict) -> float:
    mapping = {
        "squat": "left_knee",
        "bench_press": "left_elbow",
        "deadlift": "hip_hinge",
        "shoulder_press": "left_elbow",
    }
    key = mapping.get(exercise, "left_knee")
    return angles.get(key, 180.0)


def _update_rep_count(angle: float, exercise: str, state: dict) -> int:
    """
    Simple state machine:
    - "up" position = angle > 150°
    - "down" position = angle < 100°
    When transitioning down → up, increment rep.
    """
    position = state.get("position", "up")
    reps = state.get("reps", 0)

    if position == "up" and angle < 100:
        state["position"] = "down"
    elif position == "down" and angle > 150:
        state["position"] = "up"
        reps += 1
        state["reps"] = reps

    return reps


def _empty_analysis(state: dict) -> dict:
    return {
        "keypoints": {},
        "joint_angles": {},
        "faults": [],
        "rep_count": state.get("reps", 0),
        "form_score": 0.0,
    }
