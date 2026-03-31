"""
main.py — Entry point: wires MCP client + multi-agent LangGraph
================================================================
This is the glue file, same pattern as mcp_example/main.py. It:
  1. Loads the API key from .env
  2. Opens the MCP session (streamable HTTP transport to port 8003)
  3. Fetches tools from the server via client.get_mcp_tools()
  4. Builds the multi-agent LangGraph via graph.build_graph()
  5. Runs analysis queries

Execution flow:
  main.py
    └─ graph.invoke({"messages": [HumanMessage(user_question)]})
         └─ manager     → decides first agent
         └─ data_loader → query_combined_data via MCP tools
         └─ manager     → routes to analyst
         └─ analyst     → execute_python (EDA, SPC, charts) via MCP tools
         └─ manager     → routes to code_reviewer
         └─ code_reviewer → validates outputs, fixes issues
         └─ manager     → routes to reporter
         └─ reporter    → write_markdown_report via MCP tools
         └─ manager     → FINISH → END
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv, find_dotenv
from langchain_core.messages import HumanMessage
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from client import get_mcp_tools
from graph_v3 import build_graph

script_dir = Path(__file__).parent
env_path = script_dir / ".env"
load_dotenv(env_path)

SERVER_URL = "http://localhost:8003/mcp"

# ── Demo analysis requests ───────────────────────────────────────────────────
# Each request triggers the full multi-agent pipeline.

# DEMO_REQUESTS = [
#     (
#         "Mill 8 Comprehensive Analysis",
#         "Perform a comprehensive analysis of Mill 8 for the last 30 days. "
#         "Include: EDA with distribution plots for key variables (Ore, PSI80, DensityHC, MotorAmp), "
#         "SPC control charts for PSI80 and Ore feed rate, "
#         "correlation heatmap between all numeric variables, "
#         "anomaly detection using Z-scores for PSI80 and Ore, "
#         "and a downtime analysis identifying periods where Ore < 10 t/h. "
#         "Generate a full report with charts and recommendations for the plant manager."
#     ),
# ]

DEMO_REQUESTS = [
    (
        "Mill Ore Load Comparison",
        "Сравни средното натоварване по руда на всички мелници  за последните 72 часа. Генерирай сравнителни графики.\
         Изчисли също стандартните отклонения, сравни ги графично и дай хистограмите. \
         При изчисленията елиминирай престоите (там където рудата е по-малка от 50 т/ч) \
         Мелница 11 по принцип работи с ниско натоварване.",
    ),
]


async def run_analysis(graph, label: str, user_input: str) -> None:
    """Run a single analysis request through the multi-agent graph."""
    print(f"\n{'═' * 70}")
    print(f"  🏭 ANALYSIS REQUEST: {label}")
    print(f"  {user_input[:150]}{'...' if len(user_input) > 150 else ''}")
    print(f"{'═' * 70}")

    final_state = await graph.ainvoke(
        {"messages": [HumanMessage(content=user_input)]},
        config={
            "configurable": {"thread_id": label},
            "recursion_limit": 150,
        },
    )

    # The last message in state is always the final output
    final_answer = final_state["messages"][-1].content
    print(f"\n{'─' * 70}")
    print(f"  📋 FINAL OUTPUT:")
    print(f"{'─' * 70}")
    print(f"  {final_answer[:500]}{'...' if len(final_answer) > 500 else ''}")


async def main() -> None:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not found. Add it to your .env file.")
        sys.exit(1)

    print(f"Connecting to MCP server at {SERVER_URL}...")
    async with streamable_http_client(SERVER_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print(f"Connected to MCP server at {SERVER_URL}\n")

            # ── Fetch tools once, build graph once ─────────────────────
            langchain_tools = await get_mcp_tools(session)
            graph = build_graph(langchain_tools, api_key)

            # ── Run demo analysis ──────────────────────────────────────
            for label, user_input in DEMO_REQUESTS:
                await run_analysis(graph, label, user_input)

    print(f"\n{'═' * 70}")
    print("  ✅ Analysis complete. Check agentic/output/ for results.")
    print(f"{'═' * 70}\n")


if __name__ == "__main__":
    asyncio.run(main())
