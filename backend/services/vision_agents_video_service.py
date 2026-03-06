"""
GymBro — Vision Agents Video Service
Live video call with AI trainer using Vision Agents SDK
Based on: https://visionagents.ai/introduction/video-agents
"""
import os
import base64
import asyncio
import json
import re
from typing import Dict, List, Optional
from datetime import datetime
from io import BytesIO
from dotenv import load_dotenv

# Load .env file FIRST before any SDK imports
load_dotenv()

try:
    from vision_agents.core import Agent, User
    from vision_agents.plugins import getstream, gemini, deepgram, elevenlabs
    VISION_AGENTS_AVAILABLE = True
    try:
        from vision_agents.plugins import ultralytics
        YOLO_AVAILABLE = True
    except ImportError:
        YOLO_AVAILABLE = False
except ImportError:
    VISION_AGENTS_AVAILABLE = False
    YOLO_AVAILABLE = False
    print("[VisionAgentsVideo] SDK not installed. Install with: pip install 'vision-agents[getstream,gemini,deepgram,elevenlabs]'")

from config import get_settings

settings = get_settings()


class GymBroVideoAgent:
    """
    Live AI Gym Trainer using Vision Agents SDK
    Provides real-time form analysis and voice coaching
    """
    
    def __init__(self):
        if not VISION_AGENTS_AVAILABLE:
            raise ImportError("Vision Agents SDK not installed")
        
        # Set ALL environment variables BEFORE any SDK initialization
        os.environ['VISIONAGENTS_API_KEY'] = settings.visionagents_api_key
        os.environ['VISIONAGENTS_SECRET_KEY'] = settings.visionagents_secret_key
        os.environ['GOOGLE_API_KEY'] = settings.gemini_api_key
        os.environ['DEEPGRAM_API_KEY'] = settings.deepgram_api_key
        os.environ['ELEVENLABS_API_KEY'] = settings.elevenlabs_api_key
        
        # Stream SDK expects these exact env var names (lowercase)
        os.environ['api_key'] = settings.stream_api_key
        os.environ['api_secret'] = settings.stream_api_secret
        
        print(f"[VisionAgent] Set api_key={os.environ.get('api_key')[:10]}...")
        print(f"[VisionAgent] Set api_secret={os.environ.get('api_secret')[:10]}...")
        
        # Session state
        self.sessions: Dict[str, dict] = {}
        self.agents: Dict[str, Agent] = {}
    
    async def start_session(
        self,
        session_id: str,
        user_id: str,
        exercise: str
    ) -> dict:
        """Start a new video training session"""
        try:
            # Build processors list — use YOLO if available
            processors = []
            if YOLO_AVAILABLE:
                processors.append(
                    ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt")
                )

            agent = Agent(
                edge=getstream.Edge(),
                agent_user=User(name="GymBro Trainer", id="agent"),
                instructions=f"You are a gym trainer analyzing {exercise} form. Provide real-time feedback on form, count reps, and detect faults. Be concise and encouraging.",
                llm=gemini.LLM("gemini-3.0-flash-preview"),
                stt=deepgram.STT(),
                tts=elevenlabs.TTS(),
                processors=processors,
            )
            
            self.agents[session_id] = agent
            self.sessions[session_id] = {
                "user_id": user_id,
                "exercise": exercise,
                "reps": 0,
                "form_scores": [],
                "all_faults": [],
                "start_time": datetime.utcnow(),
                "frame_count": 0
            }
            
            print(f"[VisionAgent] Session {session_id} started for {exercise}")
            return {
                "status": "started",
                "session_id": session_id,
                "exercise": exercise
            }
        except Exception as e:
            print(f"[VisionAgent] Error starting session: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def process_frame(
        self,
        session_id: str,
        frame_b64: str,
        exercise: str
    ) -> dict:
        """
        Process a single video frame with Gemini Vision API
        
        Args:
            session_id: Session identifier
            frame_b64: Base64-encoded JPEG frame
            exercise: Exercise name
            
        Returns:
            Analysis dict with rep_count, form_score, faults, feedback
        """
        if session_id not in self.sessions:
            await self.start_session(session_id, "unknown", exercise)
        
        session = self.sessions[session_id]
        session["frame_count"] += 1
        
        try:
            # Use Gemini Vision API directly for frame analysis
            import google.generativeai as genai
            from PIL import Image
            
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel('gemini-3.0-flash-preview')
            
            # Decode base64 image
            image_data = base64.b64decode(frame_b64)
            image = Image.open(BytesIO(image_data))
            
            print(f"[VisionAgent] Processing frame {session['frame_count']} for session {session_id}")
            
            # Build prompt for Gemini
            prompt = f"""Analyze this {exercise} exercise frame and provide feedback in JSON format.

Current session state:
- Rep count so far: {session['reps']}
- Frame #{session['frame_count']}

Analyze the person's form and respond with ONLY a JSON object (no markdown, no explanation):
{{
  "rep_count": <total reps completed so far>,
  "form_score": <0-100 score>,
  "faults": [<list of form issues like "knees_caving", "back_rounding">],
  "feedback": "<brief encouraging coaching tip>",
  "joint_angles": {{"hip": 90, "knee": 85}}
}}

Be concise and encouraging. Focus on safety."""
            
            # Call Gemini Vision API
            response = await asyncio.to_thread(
                model.generate_content,
                [prompt, image]
            )
            
            print(f"[VisionAgent] Gemini response: {response.text[:200] if response.text else 'None'}")
            
            # Parse response
            analysis = self._parse_agent_response(response.text, session, exercise)
            
            # Update session state
            session["reps"] = analysis["rep_count"]
            session["form_scores"].append(analysis["form_score"])
            session["all_faults"].extend(analysis["faults"])
            
            print(f"[VisionAgent] Analysis complete: reps={analysis['rep_count']}, score={analysis['form_score']}")
            
            return analysis
            
        except Exception as e:
            print(f"[VisionAgent] Error processing frame: {e}")
            import traceback
            traceback.print_exc()
            return self._empty_analysis(session)
    
    def _call_agent(self, agent: Agent, prompt: str, frame) -> str:
        """Call agent synchronously (for use with asyncio.to_thread)"""
        try:
            # Vision Agents doesn't have a simple chat() method for frame processing
            # We need to use the LLM directly for frame analysis
            # For now, return empty - we'll implement proper frame processing later
            print(f"[VisionAgent] Frame processing not yet implemented")
            return ""
        except Exception as e:
            print(f"[VisionAgent] Agent call error: {e}")
            return ""
    
    def _parse_agent_response(self, response: str, session: dict, exercise: str) -> dict:
        """Parse the agent's JSON response"""
        try:
            if not response:
                print(f"[VisionAgent] Empty response from agent")
                return self._empty_analysis(session)
            
            # Extract JSON from response (agent might include markdown)
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                
                # Validate and sanitize data
                rep_count = data.get("rep_count", session.get("reps", 0))
                form_score = data.get("form_score", 0.0)
                faults = data.get("faults", [])
                feedback = data.get("feedback", "")
                joint_angles = data.get("joint_angles", {})
                
                # Ensure values are valid numbers
                if rep_count is None or (isinstance(rep_count, float) and rep_count != rep_count):  # NaN check
                    rep_count = session.get("reps", 0)
                if form_score is None or (isinstance(form_score, float) and form_score != form_score):  # NaN check
                    form_score = 0.0
                
                rep_count = int(rep_count) if isinstance(rep_count, (int, float)) else 0
                form_score = float(form_score) if isinstance(form_score, (int, float)) else 0.0
                
                print(f"[VisionAgent] Parsed: reps={rep_count}, score={form_score}, faults={len(faults)}")
                
                return {
                    "rep_count": rep_count,
                    "form_score": form_score,
                    "faults": faults if isinstance(faults, list) else [],
                    "feedback": feedback if isinstance(feedback, str) else "",
                    "joint_angles": joint_angles if isinstance(joint_angles, dict) else {},
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                print(f"[VisionAgent] No JSON found in response: {response[:100]}")
                return self._empty_analysis(session)
                
        except Exception as e:
            print(f"[VisionAgent] Error parsing response: {e}")
            return self._empty_analysis(session)
    
    def _empty_analysis(self, session: dict) -> dict:
        """Return empty analysis when processing fails"""
        return {
            "rep_count": session.get("reps", 0),
            "form_score": 0.0,
            "faults": [],
            "feedback": "",
            "joint_angles": {},
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def end_session(self, session_id: str) -> dict:
        """End a training session and return summary"""
        if session_id not in self.sessions:
            return {"error": "Session not found"}
        
        session = self.sessions.pop(session_id)
        self.agents.pop(session_id, None)
        
        scores = session.get("form_scores", [])
        avg_score = sum(scores) / len(scores) if scores else 0.0
        
        duration = (datetime.utcnow() - session["start_time"]).seconds
        
        return {
            "session_id": session_id,
            "exercise": session["exercise"],
            "total_reps": session["reps"],
            "avg_form_score": round(avg_score, 1),
            "duration_seconds": duration,
            "frame_count": session["frame_count"],
            "unique_faults": list(set(session["all_faults"]))
        }


# Singleton instance
_video_agent = None

def get_video_agent() -> GymBroVideoAgent:
    """Get or create Video Agent instance"""
    global _video_agent
    if _video_agent is None:
        _video_agent = GymBroVideoAgent()
    return _video_agent
