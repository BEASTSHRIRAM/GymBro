"""
GymBro — Video Call Service with Vision Agents
WebRTC video calls with AI gym trainer using Stream + Vision Agents SDK
"""
import os
import asyncio
from typing import Dict, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

try:
    from vision_agents.core import Agent, User
    from vision_agents.plugins import getstream, gemini, deepgram, elevenlabs, ultralytics
    VISION_AGENTS_AVAILABLE = True
except ImportError:
    VISION_AGENTS_AVAILABLE = False
    print("[VideoCall] Vision Agents SDK not installed")

from config import get_settings

settings = get_settings()


class VideoCallService:
    """
    Manages WebRTC video calls with AI gym trainer
    Uses Vision Agents SDK with Stream's global edge network
    """
    
    def __init__(self):
        if not VISION_AGENTS_AVAILABLE:
            raise ImportError("Vision Agents SDK not installed")
        
        # Set environment variables for Stream SDK
        os.environ['api_key'] = settings.stream_api_key
        os.environ['api_secret'] = settings.stream_api_secret
        os.environ['GOOGLE_API_KEY'] = settings.gemini_api_key
        os.environ['DEEPGRAM_API_KEY'] = settings.deepgram_api_key
        os.environ['ELEVENLABS_API_KEY'] = settings.elevenlabs_api_key
        
        print(f"[VideoCall] Initialized with Stream API key: {settings.stream_api_key[:10]}...")
        
        # Active agents by call_id
        self.agents: Dict[str, Agent] = {}
        self.call_metadata: Dict[str, dict] = {}
    
    async def create_agent_for_call(
        self,
        call_id: str,
        call_type: str,
        exercise: str,
        user_id: str
    ) -> Agent:
        """
        Create and start an AI agent for a video call
        
        Args:
            call_id: Stream call ID
            call_type: "default" or custom call type
            exercise: Exercise name (squat, bench_press, etc.)
            user_id: User ID for tracking
            
        Returns:
            Agent instance
        """
        try:
            print(f"[VideoCall] Creating agent for call {call_id}, exercise: {exercise}")
            
            # Create agent with Stream Edge + Gemini LLM + Deepgram STT + ElevenLabs TTS
            agent = Agent(
                edge=getstream.Edge(),
                agent_user=User(name="GymBro Trainer", id="gymbro-agent"),
                instructions=f"""You are an expert gym trainer analyzing {exercise} form in real-time.

Your role:
1. Watch the user's video feed and analyze their exercise form
2. Count reps accurately
3. Detect form faults (knees caving, back rounding, etc.)
4. Provide encouraging, concise coaching feedback
5. Focus on safety and proper technique

Be supportive and motivating. Keep feedback brief and actionable.""",
                llm=gemini.LLM("gemini-3.0-flash-preview"),
                stt=deepgram.STT(),
                tts=elevenlabs.TTS(),
                processors=[
                    ultralytics.YOLOPoseProcessor(model_path="yolo11n-pose.pt")
                ],
            )
            
            # Store agent and metadata
            self.agents[call_id] = agent
            self.call_metadata[call_id] = {
                "exercise": exercise,
                "user_id": user_id,
                "start_time": datetime.utcnow(),
                "reps": 0,
                "form_scores": [],
            }
            
            # Join the call in background
            asyncio.create_task(self._join_call(agent, call_type, call_id, user_id))
            
            print(f"[VideoCall] Agent created and joining call {call_id}")
            return agent
            
        except Exception as e:
            print(f"[VideoCall] Error creating agent: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def _join_call(self, agent: Agent, call_type: str, call_id: str, user_id: str):
        """
        Join a video call and handle the session
        
        This runs in the background and keeps the agent in the call
        """
        try:
            print(f"[VideoCall] Agent joining call {call_id}")
            
            # Create call using Vision Agents' built-in method
            # This handles Stream SDK integration internally
            call = await agent.create_call(call_type, call_id)
            
            print(f"[VideoCall] Call created: {call_id}")
            
            # Join the call with agent
            async with agent.join(call):
                # Send initial greeting
                await agent.simple_response("Hey! I'm your AI gym trainer. Show me your form and let's get started!")
                
                # Wait for call to end
                await agent.finish()
            
            print(f"[VideoCall] Agent left call {call_id}")
            
        except Exception as e:
            print(f"[VideoCall] Error in call {call_id}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Cleanup
            await self.end_call(call_id)
    
    async def end_call(self, call_id: str) -> dict:
        """
        End a call and return summary
        
        Args:
            call_id: Stream call ID
            
        Returns:
            Call summary with stats
        """
        # Check if call exists in our tracking
        if call_id not in self.call_metadata:
            # Call was never successfully started, return empty summary
            return {
                "call_id": call_id,
                "exercise": "unknown",
                "user_id": "unknown",
                "duration_seconds": 0,
                "total_reps": 0,
                "avg_form_score": 0.0,
            }
        
        try:
            agent = self.agents.pop(call_id, None)
            metadata = self.call_metadata.pop(call_id, {})
            
            # Close agent if it exists
            if agent:
                await agent.close()
            
            # Calculate stats
            duration = (datetime.utcnow() - metadata.get("start_time", datetime.utcnow())).seconds
            form_scores = metadata.get("form_scores", [])
            avg_score = sum(form_scores) / len(form_scores) if form_scores else 0.0
            
            summary = {
                "call_id": call_id,
                "exercise": metadata.get("exercise", "unknown"),
                "user_id": metadata.get("user_id", "unknown"),
                "duration_seconds": duration,
                "total_reps": metadata.get("reps", 0),
                "avg_form_score": round(avg_score, 1),
            }
            
            print(f"[VideoCall] Call {call_id} ended: {summary}")
            return summary
            
        except Exception as e:
            print(f"[VideoCall] Error ending call {call_id}: {e}")
            return {
                "call_id": call_id,
                "exercise": "unknown",
                "user_id": "unknown",
                "duration_seconds": 0,
                "total_reps": 0,
                "avg_form_score": 0.0,
                "error": str(e)
            }
    
    def get_call_status(self, call_id: str) -> dict:
        """Get current status of a call"""
        if call_id not in self.agents:
            return {"status": "not_found"}
        
        metadata = self.call_metadata.get(call_id, {})
        duration = (datetime.utcnow() - metadata.get("start_time", datetime.utcnow())).seconds
        
        return {
            "status": "active",
            "call_id": call_id,
            "exercise": metadata.get("exercise", "unknown"),
            "duration_seconds": duration,
            "reps": metadata.get("reps", 0),
        }


# Singleton instance
_video_call_service = None

def get_video_call_service() -> VideoCallService:
    """Get or create VideoCallService instance"""
    global _video_call_service
    if _video_call_service is None:
        _video_call_service = VideoCallService()
    return _video_call_service
