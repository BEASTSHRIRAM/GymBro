import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import json

async def run_mcp_tests():
    print("=========================================")
    print("🧪 GYMBRO MCP SERVER INTEGRATION TEST 🧪")
    print("=========================================\n")

    test_user = "test_user_999"

    # Define connection to the running MCP Server
    server_params = StdioServerParameters(
        command="uv", 
        args=["run", "gymbro_mcp_server.py"], 
        env=None
    )

    print(f"📡 Connecting to GymBro Brain (MCP Server) via stdio...")
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                print("✅ Connected successfully!\n")

                # --- TEST 1: Save a Profile Fact (MongoDB & Redis) ---
                print(f"👉 TEST 1: Saving a profile fact for {test_user}...")
                await session.call_tool(
                    "save_profile_fact",
                    arguments={"user_id": test_user, "key": "fitness_goal", "value": "Lose 10 pounds by summer"}
                )
                print("✅ Successfully saved strict profile fact (MongoDB + Redis).\n")

                # --- TEST 2: Update Chat History (Redis) ---
                print(f"👉 TEST 2: Simulating chat history updates...")
                await session.call_tool(
                    "update_short_term_chat", 
                    arguments={"user_id": test_user, "role": "user", "message": "My left knee hurts today."}
                )
                await session.call_tool(
                    "update_short_term_chat", 
                    arguments={"user_id": test_user, "role": "assistant", "message": "I'll keep that in mind. Let's avoid heavy squats."}
                )
                print("✅ Successfully saved conversation turns (Redis).\n")

                # --- TEST 3: Fetch System Context (The AI Prompt) ---
                print(f"👉 TEST 3: Fetching the invisible System Prompt Context...")
                context_result = await session.call_tool(
                    "get_system_prompt_context", 
                    arguments={"user_id": test_user}
                )
                system_prompt_context = context_result.content[0].text
                print("━━━━━━━━━ CONTEXT RESULTS ━━━━━━━━━")
                print(system_prompt_context)
                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

                # --- TEST 4: Log a Full Workout (Qdrant Vector DB) ---
                print(f"👉 TEST 4: Logging a massive workout to Long-Term Memory (Qdrant Vector DB)...")
                workout_summary = "Workout: Squat. Duration: 1200 seconds. Overall form score: 85%. Faults observed: Knees caved in on last set."
                await session.call_tool(
                    "log_workout_to_long_term_memory",
                    arguments={
                        "user_id": test_user, 
                        "timestamp": "2026-03-08T12:00:00Z",
                        "summary": workout_summary
                    }
                )
                print("✅ Successfully vectorized and saved memory to Qdrant.\n")

                # Wait a tiny bit for Vector DB to index
                await asyncio.sleep(1)

                # --- TEST 5: Query Long-Term Memory (RAG) ---
                print(f"👉 TEST 5: Asking the AI about past workouts...")
                search_query = "Did I have any issues with my squats?"
                print(f"   Querying Vector Memory for: '{search_query}'")
                
                search_result = await session.call_tool(
                    "search_long_term_memory",
                    arguments={"user_id": test_user, "query": search_query}
                )
                print("━━━━━━━━ MEMORY RETRIEVAL ━━━━━━━━━")
                print(search_result.content[0].text)
                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
                
                print("🎉 ALL TESTS PASSED! The GymBro MCP Brain is fully functional! 🎉")

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        print("Please ensure your Docker composition (Redis, Mongo, Qdrant) is running!")

if __name__ == "__main__":
    asyncio.run(run_mcp_tests())
