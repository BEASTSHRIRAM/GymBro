import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from dotenv import load_dotenv

load_dotenv()

async def verify_memory():
    user_id = "69a87139035c6825c6c862a4"
    print(f"[FETCH] Testing memory retrieval for user: {user_id}")
    
    server_params = StdioServerParameters(
        command="uv", 
        args=["run", "gymbro_mcp_server.py"], 
        env=None
    )

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                print("[MCP] Fetching AI System Prompt Context...")
                result = await session.call_tool(
                    "get_system_prompt_context", 
                    arguments={"user_id": user_id}
                )
                
                context = result.content[0].text
                print("\n" + "="*40)
                print("SYSTEM PROMPT CONTEXT")
                print("="*40)
                print(context)
                print("="*40 + "\n")
                
                if "RECENT TRAINING SESSIONS" in context:
                    print("[SUCCESS] Training history is now included in the context!")
                else:
                    print("[FAILURE] Training history is still missing.")

    except Exception as e:
        print(f"[ERROR] Error during verification: {e}")

if __name__ == "__main__":
    asyncio.run(verify_memory())
