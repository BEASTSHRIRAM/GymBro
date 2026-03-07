# ==============================================================================
# GymBro Central Nervous System (MCP Server)
# ==============================================================================
# Architecture:
# 1. Redis: Short-term conversation history & ultra-fast L1 cache capability.
# 2. MongoDB: Hard facts (User Profiles, Goals, Medical Info).
# 3. Qdrant (Vector DB): Semantic long-term memory (Past workouts, feedback).
# 
# Requirements:
# pip install mcp motor redis qdrant-client sentence-transformers pydantic 
# ==============================================================================

import json
import asyncio
import logging
from typing import Dict, Any, List, Optional
import redis.asyncio as redis
from motor.motor_asyncio import AsyncIOMotorClient
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from sentence_transformers import SentenceTransformer
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import os

# Load Environment Variables
load_dotenv()

# ─── Configuration ───
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "gymbro")
REDIS_URI = os.getenv("REDIS_URI", "redis://localhost:6379/0")
QDRANT_URI = os.getenv("QDRANT_URI", "http://localhost:6333")

COLLECTION_CONTEXT = "gymbro_context"
QDRANT_COLLECTION = "gymbro_long_term_memory"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gymbro_mcp")

# ─── Initialize Services ───
mcp = FastMCP("GymBroProductionBrain")

# 1. Profile DB (MongoDB)
mongo_client = AsyncIOMotorClient(MONGO_URI)
db = mongo_client[MONGO_DB]
context_collection = db[COLLECTION_CONTEXT]

# 2. Short-Term DB (Redis)
redis_client = redis.from_url(REDIS_URI, decode_responses=True)

# 3. Long-Term DB (Qdrant Vector Engine + Embedding Model)
# Note: In production you might use OpenAI text-embedding-ada-002 API instead of local model
embedder = SentenceTransformer('all-MiniLM-L6-v2')
qdrant_client = AsyncQdrantClient(url=QDRANT_URI)


# --- Initialization Hook ---
async def ensure_qdrant_collection():
    """Ensure the Vector DB collection exists on startup."""
    exists = await qdrant_client.collection_exists(QDRANT_COLLECTION)
    if not exists:
         await qdrant_client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

# ─── CORE MCP TOOLS EXPOSED TO THE AGENT ───

@mcp.tool()
async def get_system_prompt_context(user_id: str) -> str:
    """
    [TIER 1 & 2: REDIS + MONGO]
    Called ONCE at the start of a conversation to build the invisible AI System Prompt.
    Fetches the static core profile + training history + recent short-term interaction summary.
    """
    profile_key = f"profile_cache:{user_id}"
    
    # 1. Check Redis for Instant Profile Load
    cached_profile = await redis_client.get(profile_key)
    if cached_profile:
        profile_data = json.loads(cached_profile)
    else:
        # Fallback to MongoDB
        doc = await context_collection.find_one({"user_id": user_id})
        profile_data = doc.get("profile", {}) if doc else {}
        # Cache for 1 hour
        await redis_client.setex(profile_key, 3600, json.dumps(profile_data))
    
    # 2. Get Training History from Mongo context
    doc = await context_collection.find_one({"user_id": user_id})
    training_history = doc.get("training_history", []) if doc else []
    
    # 3. Get last 5 things said (Short-Term Memory from Redis Lists)
    history_key = f"chat_history:{user_id}"
    recent_chat = await redis_client.lrange(history_key, -5, -1)
    
    # Compile the mega-prompt
    context_str = f"--- USER PROFILE ---\n"
    for k, v in profile_data.items():
        if v: context_str += f"- {k}: {v}\n"
    
    if training_history:
        context_str += f"\n--- RECENT TRAINING SESSIONS ---\n"
        # Last 3 sessions for density
        for s in training_history[-3:]:
            context_str += (
                f"- {s.get('exercise')} ({s.get('total_reps', 0)} reps): "
                f"Form {s.get('avg_form_score', 0)}%, "
                f"Faults: {', '.join(s.get('faults', [])) or 'None'}\n"
            )
    
    context_str += f"\n--- RECENT CONVERSATION (LAST 5 TURNS) ---\n"
    for msg in recent_chat:
        context_str += f"{msg}\n"
        
    return context_str

@mcp.tool()
async def save_profile_fact(user_id: str, key: str, value: str) -> str:
    """
    [TIER 2: MONGO]
    Called when the agent learns a HARD FACT about the user (e.g., "Goal = Bulk").
    Saves to Redis instantly, and MongoDB in the background.
    """
    profile_key = f"profile_cache:{user_id}"
    
    # Update Redis
    cached = await redis_client.get(profile_key)
    data = json.loads(cached) if cached else {}
    data[key] = value
    await redis_client.setex(profile_key, 3600, json.dumps(data))
    
    # Update Mongo (Background) - Save into 'profile' field of gymbro_context
    asyncio.create_task(
        context_collection.update_one(
            {"user_id": user_id}, 
            {"$set": {f"profile.{key}": value}}, 
            upsert=True
        )
    )
    return f"Saved fact: {key} = {value}"


@mcp.tool()
async def search_long_term_memory(user_id: str, query: str) -> str:
    """
    [TIER 3: VECTOR DB]
    Called by the agent when the user asks about the past (e.g., "What went wrong with my squat last week?").
    Returns semantically similar logs.
    """
    # Convert query to vectors
    vector = embedder.encode(query).tolist()
    
    # Search Qdrant, filtering specifically for this user's data
    results = await qdrant_client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=vector,
        query_filter={
            "must": [{"key": "user_id", "match": {"value": user_id}}]
        },
        limit=3 # Return top 3 most relevant memories
    )
    
    if not results:
        return "No relevant past memories found."
        
    memories = [f"- {res.payload['timestamp']}: {res.payload['text']}" for res in results]
    return "--- PAST RELEVANT MEMORIES ---\n" + "\n".join(memories)


@mcp.tool()
async def log_workout_to_long_term_memory(user_id: str, timestamp: str, summary: str) -> str:
    """
    [TIER 3: VECTOR DB]
    Called ONLY at the end of a workout session to store the massive summary/logs.
    """
    # Convert summary text to vector mathematical representation
    vector = embedder.encode(summary).tolist()
    
    # Insert memory
    import uuid
    point_id = str(uuid.uuid4())
    
    await qdrant_client.upsert(
        collection_name=QDRANT_COLLECTION,
        points=[
            PointStruct(
                id=point_id, 
                vector=vector, 
                payload={"user_id": user_id, "timestamp": timestamp, "text": summary}
            )
        ]
    )
    return f"Workout permanently saved to long-term memory."

@mcp.tool()
async def update_short_term_chat(user_id: str, role: str, message: str) -> str:
    """
    [TIER 1: REDIS]
    A utility block to push every line of chat to Redis. Called implicitly on every turn.
    """
    history_key = f"chat_history:{user_id}"
    log_line = f"{role}: {message}"
    
    # Push to right of list
    await redis_client.rpush(history_key, log_line)
    # Keep only last 20 messages to prevent overflow
    await redis_client.ltrim(history_key, -20, -1)
    
    return "ok"

if __name__ == "__main__":
    # Ensure Qdrant is setup before starting
    asyncio.run(ensure_qdrant_collection())
    
    mcp.run()
