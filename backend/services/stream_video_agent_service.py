"""
GymBro — Stream Video Agent Service
Real-time AI gym trainer using Stream's edge network + Vision Agents
Based on: https://getstream.io/video/docs/react/guides/configuring-call-types.md
"""
import os
from typing import Dict, Optional
from datetime import datetime

from vision_agents.core import Agent, AgentLauncher, User, Runner
from vision_agents.plugins import getstream, gemini, deepgram, ultralytics
from config import get_settings

settings = get_settings()


class StreamGymCoach:
    """
    Real-time AI Gym Coach using Stream Video + Vision Agents
    Provides live video analysis with pose detection and voice coaching
    """
    
    def __init__(self):
        """Initialize Stream Video Agent"""
        # Set environment variables for Vision Agents
        os.environ['STREAM_API_KEY'] = settings.stream_api_key
        os.environ['STREAM_API_SECRET'] = settings.stream_api_secret
        os.environ['GOOGLE_API_KEY'] = settings.gemini_api_key
        os.environ['DEEPGRAM_API_KEY'] = settings.deepgram_api_key
        os.environ['VISIONAGENTS_API_KEY'] = settings.visionagents_api_key
        os.environ['VISIONAGENTS_SECRET_KEY'] = settings.visionagents_secret_key
        
        self.sessions: Dict[str, dict] = {}
    
    async def create_agent(self, exercise: str = "squat", **kwargs) -> Agent:
        """
        Create a Stream Video Agent for gym coaching
        
        Args:
            exercise: Exercise type (squat, bench_press, deadlift, shoulder_press)
            
        Returns:
            Configured Agent instance
        """
        instructions = self._get_instructions(exercise)
        
        # Create agent with realtime Gemini + YOLO pose detection
        agent = Agent(
            edge=getstream.Edge(),
            agent_user=User(name="GymBro Coach", id="gym-coach"),
            instructions=instructions,
            llm=gemini.Realtime(fps=3),  # 3 frames per second for real-time analysis
            processors=[
                ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt")
            ],
            stt=deepgram.STT(),  # Speech-to-text for user questions
        )
        
        return agent
    
    def _get_instructions(self, exercise: str) -> str:
        """Get exercise-specific coaching instructions"""
        instructions_map = {
            "squat": """You are an expert squat coach. Analyze the user's squat form in real-time:
1. Monitor knee tracking - knees should track over toes
2. Check depth - aim for parallel or below
3. Watch back position - keep spine neutral
4. Detect forward lean - minimize excessive lean
5. Count reps accurately

Provide concise, actionable coaching cues. Be encouraging and motivational.
When you detect form issues, give ONE specific correction at a time.
Example: "Great depth! Keep your knees tracking over your toes."
""",
            "bench_press": """You are an expert bench press coach. Analyze the user's bench press form:
1. Monitor elbow angle - should be 45-75 degrees
2. Check bar path - should be straight up and down
3. Watch wrist position - keep wrists neutral
4. Detect uneven bar - ensure balanced pressing
5. Count reps accurately

Provide concise, actionable coaching cues. Be encouraging.
Example: "Nice rep! Keep the bar path straight - avoid drifting forward."
""",
            "deadlift": """You are an expert deadlift coach. Analyze the user's deadlift form:
1. Monitor back position - keep spine neutral
2. Check hip hinge - proper hip-knee coordination
3. Watch bar proximity - bar should stay close to body
4. Detect hip shift - minimize lateral movement
5. Count reps accurately

Provide concise, actionable coaching cues. Be encouraging.
Example: "Good lift! Keep the bar closer to your body on the way up."
""",
            "shoulder_press": """You are an expert shoulder press coach. Analyze the user's shoulder press form:
1. Monitor elbow position - elbows should be under the bar
2. Check back arch - avoid excessive lumbar arch
3. Watch wrist alignment - keep wrists neutral
4. Detect uneven pressing - ensure balanced strength
5. Count reps accurately

Provide concise, actionable coaching cues. Be encouraging.
Example: "Perfect form! Keep your core tight and elbows under the bar."
""",
        }
        
        return instructions_map.get(exercise, instructions_map["squat"])
    
    async def start_session(
        self,
        session_id: str,
        user_id: str,
        exercise: str,
        call_type: str = "default",
    ) -> dict:
        """
        Start a new video coaching session
        
        Args:
            session_id: Unique session identifier
            user_id: User ID
            exercise: Exercise type
            call_type: Stream call type
            
        Returns:
            Session info dict
        """
        self.sessions[session_id] = {
            "user_id": user_id,
            "exercise": exercise,
            "call_type": call_type,
            "start_time": datetime.utcnow(),
            "reps": 0,
            "form_scores": [],
            "faults": [],
        }
        
        print(f"[StreamCoach] Session {session_id} started for {exercise}")
        
        return {
            "status": "started",
            "session_id": session_id,
            "exercise": exercise,
        }
    
    async def end_session(self, session_id: str) -> dict:
        """
        End a coaching session and return summary
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session summary
        """
        if session_id not in self.sessions:
            return {"error": "Session not found"}
        
        session = self.sessions.pop(session_id)
        
        scores = session.get("form_scores", [])
        avg_score = sum(scores) / len(scores) if scores else 0.0
        
        duration = (datetime.utcnow() - session["start_time"]).seconds
        
        summary = {
            "session_id": session_id,
            "exercise": session["exercise"],
            "total_reps": session["reps"],
            "avg_form_score": round(avg_score, 1),
            "duration_seconds": duration,
            "unique_faults": list(set(session["faults"])),
        }
        
        print(f"[StreamCoach] Session {session_id} ended: {summary}")
        
        return summary
    
    async def join_call(
        self,
        agent: Agent,
        call_type: str,
        call_id: str,
        **kwargs
    ) -> None:
        """
        Join a Stream video call and start coaching
        
        Args:
            agent: Configured Agent instance
            call_type: Stream call type
            call_id: Stream call ID
        """
        try:
            call = await agent.create_call(call_type, call_id)
            async with agent.join(call):
                # Start coaching
                await agent.simple_response("Let's analyze your form. Show me your exercise!")
                await agent.finish()
        except Exception as e:
            print(f"[StreamCoach] Error in call {call_id}: {e}")
            import traceback
            traceback.print_exc()


# Singleton instance
_stream_coach = None


def get_stream_coach() -> StreamGymCoach:
    """Get or create Stream Gym Coach instance"""
    global _stream_coach
    if _stream_coach is None:
        _stream_coach = StreamGymCoach()
    return _stream_coach
