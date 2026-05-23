import asyncio
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Ensure your python environment has 'mcp' library installed:
# pip install mcp

async def main():
    # 1. Setup Stdio Server Parameters to launch the Node.js MCP server
    server_params = StdioServerParameters(
        command="node",
        args=["../../dist/index.js"],
        env=None
    )

    print("Starting and connecting to Antigravity MCP Server...")
    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # Initialize the session
            await session.initialize()
            print("Session initialized successfully!\n")

            # 2. Call debate deliberation tool
            print("--- Running Multi-Agent Debate Simulation ---")
            debate_result = await session.call_tool(
                name="run_debate_deliberation",
                arguments={
                    "topic": "Is it safe to store secrets in environment variables inside Docker images?",
                    "rounds": 1
                }
            )
            print("Debate Output:")
            print(debate_result.content[0].text)

            # 3. Call programming advice tool
            print("\n--- Requesting Programming Advice ---")
            advice_result = await session.call_tool(
                name="get_programming_advice",
                arguments={
                    "question": "What is the best way to implement token bucket rate limiting in Node.js with Redis?",
                    "language": "typescript"
                }
            )
            print("Advice Output:")
            print(advice_result.content[0].text)

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
