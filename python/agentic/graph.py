"""
graph.py — Multi-agent LangGraph for Ore Dressing Plant Data Analysis
======================================================================
Multi-agent pipeline for comprehensive process data analysis:

  [START] → [manager] → [data_loader] → [manager] → [analyst] → [manager]
                                                                      ↓
          [END] ← [manager] ← [reporter] ← [manager] ← [code_reviewer] ←─┘

Agents:
  - Manager       : Orchestrates workflow, routes to specialists
  - Data Loader   : Uses DB tools to pull and profile mill data
  - Analyst       : Performs EDA, SPC, correlations, anomaly detection via execute_python
  - Code Reviewer : Validates analysis outputs, checks for errors, suggests improvements
  - Reporter      : Assembles final Markdown report with embedded chart references

State flows through a shared MessagesState, with each agent appending its
output. The Manager reads the full conversation and decides who goes next.
"""

import operator
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import (
    SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage,
)
from langchain_core.tools import BaseTool
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, MessagesState, END, START

GROQ_MODEL = "llama-3.3-70b-versatile"

# Token-budget controls (Groq free tier: 8K TPM)
MAX_TOOL_OUTPUT_CHARS = 1500   # truncate long tool responses
MAX_AI_MSG_CHARS = 2000        # truncate long AI messages
MAX_MESSAGES_WINDOW = 12       # sliding window: only keep last N messages
MAX_SPECIALIST_ITERS = 3       # max tool-call rounds per specialist visit


# ── Extended state ───────────────────────────────────────────────────────────

class AnalysisState(MessagesState):
    next_agent: str


# ── System prompts ───────────────────────────────────────────────────────────

MANAGER_PROMPT = """You are the Manager coordinating a data analysis team for an ore dressing factory with 12 ball mills.

Team: data_loader, analyst, code_reviewer, reporter.

Workflow: data_loader → analyst → code_reviewer → reporter → FINISH

The factory processes copper ore through ball mills. Data is in MILL_XX tables (minute-level time-series).
Key process variables (columns in MILL_XX):
- TimeStamp: datetime index (minute resolution)
- Ore: feed rate (t/h)
- WaterMill, WaterZumpf: water flow rates
- Power, ZumpfLevel: mill power and sump level
- PressureHC, DensityHC, PulpHC: hydrocyclone parameters
- PumpRPM, MotorAmp: mill motor current and pump speed
- PSI80, PSI200: product fineness (grinding quality targets)
- FE: iron content
- Ore quality (from ore_quality table, joined): Shisti, Daiki, Grano, Class_12, Class_15

Guide each agent with specific instructions about what to analyze.
Be brief — 1-3 sentences of instruction, then on its own line:
NEXT: <agent_name>
or NEXT: FINISH when the report is complete.

Example:
Load combined data for mill 8, last 30 days. We need full sensor + ore quality data.
NEXT: data_loader"""

DATA_LOADER_PROMPT = """You are the Data Loader. Load data in ONE tool call and return to manager.

Steps:
1. Call query_mill_data with the mill_number from the request. Pass start_date/end_date if the user specified a time range. This loads MILL_XX time-series data with TimeStamp index.
2. After the tool returns, write a 3-line summary: rows loaded, date range, key columns.
3. Return to manager. Do NOT call get_db_schema or any other tool — one call is enough.

Use query_combined_data ONLY if the user specifically asks for ore quality data (Shisti, Daiki, Grano).

IMPORTANT: Do NOT loop. One tool call, then summarize and stop."""

ANALYST_PROMPT = """You are the Data Analyst for an ore dressing factory. You perform analysis using execute_python.

You have access to loaded DataFrames via:
- df: the default DataFrame
- get_df('name'): get a specific named DataFrame
- list_dfs(): see all loaded DataFrames

Perform comprehensive analysis based on the manager's instructions. Common analyses include:

1. **EDA**: df.describe(), distributions, missing values, time series plots
2. **SPC Control Charts**: Calculate UCL/LCL using ±3σ, plot Xbar charts, identify out-of-control points
3. **Correlations**: df.corr(), heatmaps, rolling correlations between key variables
4. **Anomaly Detection**: Z-scores, IQR method, identify unusual operating periods
5. **Downtime Analysis**: Detect gaps where Ore=0 or MotorAmp=0, quantify lost production
6. **Process Capability**: Cp, Cpk calculations for key quality targets (PSI80, PSI200)

IMPORTANT RULES:
- Put ALL analysis code in a SINGLE execute_python call when possible
- Save ALL charts: plt.savefig(os.path.join(OUTPUT_DIR, 'name.png'), dpi=150, bbox_inches='tight')
- ALWAYS plt.close() after each figure
- Print key statistics and findings to stdout
- Use descriptive chart filenames like 'mill_8_correlation_heatmap.png'
- Use professional styling: sns.set_style('whitegrid'), proper labels and titles"""

CODE_REVIEWER_PROMPT = """You are the Code Reviewer. Your job is to validate the analysis outputs.

1. Call list_output_files to see what charts were generated
2. Review the stdout from the analyst's code execution
3. Check for:
   - Missing or failed charts
   - Statistical errors or unreasonable values
   - Incomplete analysis (missing key variables)
   - Data quality issues that weren't addressed
4. If issues found, write corrective code using execute_python
5. If everything looks good, write a brief validation summary

Be concise. Focus on correctness and completeness.
If the analyst missed something important, generate the missing analysis with execute_python."""

REPORTER_PROMPT = """You are the Reporter for an ore dressing factory. Create a professional Markdown report.

First call list_output_files to get all chart filenames. Then call write_markdown_report with:

Report structure:
# Mill [N] Analysis Report — [Date Range]

## Executive Summary
2-3 sentences: overall mill health, key findings, urgent issues.

## Data Overview
- Dataset description, time period, sample count
- Data quality summary

## Key Findings
### Process Performance
- Ore feed rate trends, stability
- Grinding quality (PSI80/PSI200) analysis
![chart](chart_name.png) references for each finding

### Statistical Process Control
- Control chart results, out-of-control points
- Process capability indices

### Correlations & Dependencies
- Key variable relationships
- Important correlations for operators

### Anomalies & Alerts
- Detected anomalies with timestamps
- Unusual operating conditions

## Conclusions & Recommendations
- Actionable items for plant managers
- Process optimization suggestions

Keep the report under 1500 words. Use chart filenames exactly as returned by list_output_files.
Write in professional technical English suitable for plant management."""


# ── Graph builder ────────────────────────────────────────────────────────────

def build_graph(tools: list[BaseTool], api_key: str) -> StateGraph:
    """
    Build and compile the multi-agent LangGraph.

    Parameters
    ----------
    tools   : list of LangChain-compatible tools (from client.get_mcp_tools)
    api_key : Groq API key

    Returns
    -------
    A compiled LangGraph graph ready to invoke.
    """

    llm = ChatGroq(model=GROQ_MODEL, api_key=api_key)
    llm_with_tools = llm.bind_tools(tools)

    # ── Message compression + sliding window ──────────────────────────
    def compress_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        """Truncate long outputs and keep only a sliding window of messages."""
        # Always keep the first message (user request) + last N messages
        if len(messages) > MAX_MESSAGES_WINDOW + 1:
            messages = [messages[0]] + messages[-(MAX_MESSAGES_WINDOW):]

        compressed = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                if len(content) > MAX_TOOL_OUTPUT_CHARS:
                    truncated = content[:MAX_TOOL_OUTPUT_CHARS] + "\n... [truncated]"
                    compressed.append(ToolMessage(
                        content=truncated,
                        tool_call_id=msg.tool_call_id,
                        name=msg.name,
                    ))
                else:
                    compressed.append(msg)
            elif isinstance(msg, AIMessage):
                content = msg.content or ""
                if len(content) > MAX_AI_MSG_CHARS:
                    truncated_msg = AIMessage(
                        content=content[:MAX_AI_MSG_CHARS] + "\n... [truncated]",
                        name=getattr(msg, "name", None),
                        tool_calls=msg.tool_calls if msg.tool_calls else [],
                    )
                    compressed.append(truncated_msg)
                else:
                    compressed.append(msg)
            else:
                compressed.append(msg)
        return compressed

    # ── Manager node ─────────────────────────────────────────────────
    def strip_tool_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        """Remove ToolMessages and tool_calls so the manager (no tools bound) doesn't confuse Groq."""
        clean = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                # Convert tool result into a plain AI summary
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                clean.append(AIMessage(
                    content=f"[Tool result from {msg.name}]: {content[:800]}",
                    name=msg.name,
                ))
            elif isinstance(msg, AIMessage) and msg.tool_calls:
                # Strip tool_calls, keep text content only
                text = msg.content or f"[{getattr(msg, 'name', 'agent')} requested tools]"
                clean.append(AIMessage(content=text, name=getattr(msg, "name", None)))
            else:
                clean.append(msg)
        return clean

    def manager_node(state: AnalysisState) -> dict:
        print(f"\n  [manager] Reviewing conversation ({len(state['messages'])} messages)...")

        compressed = compress_messages(state["messages"])
        messages = [SystemMessage(content=MANAGER_PROMPT)] + strip_tool_messages(compressed)
        response = llm.invoke(messages)  # Manager doesn't need tools

        content = response.content
        print(f"  [manager] Response: {content[-200:]}")

        # Parse the NEXT: directive
        next_agent = "FINISH"
        for line in content.strip().split("\n"):
            line = line.strip()
            if line.startswith("NEXT:"):
                next_agent = line.split("NEXT:")[1].strip()
                break

        print(f"  [manager] Routing to: {next_agent}")

        return {
            "messages": [AIMessage(content=content, name="manager")],
            "next_agent": next_agent,
        }

    # ── Specialist agent factory ─────────────────────────────────────
    def make_specialist_node(name: str, system_prompt: str):
        """Create a specialist agent node that can use tools."""

        def specialist_node(state: AnalysisState) -> dict:
            iteration = sum(1 for m in state["messages"] if getattr(m, "name", None) == name) + 1
            print(f"\n  [{name}] iteration {iteration}/{MAX_SPECIALIST_ITERS} — processing...")

            # If iteration cap reached, force return to manager without tool calls
            if iteration > MAX_SPECIALIST_ITERS:
                print(f"  [{name}] Iteration cap reached, returning to manager.")
                summary = AIMessage(
                    content=f"[{name}] Completed my work (iteration cap reached). Returning to manager.",
                    name=name,
                )
                return {"messages": [summary]}

            messages = [SystemMessage(content=system_prompt)] + compress_messages(state["messages"])

            try:
                response = llm_with_tools.invoke(messages)
            except Exception as e:
                error_str = str(e)
                print(f"  [{name}] LLM error: {error_str[:200]}")
                # On tool-call parse failure, return a plain message so the graph continues
                fallback = AIMessage(
                    content=f"[{name}] Tool call failed ({error_str[:100]}). Returning to manager for guidance.",
                    name=name,
                )
                return {"messages": [fallback]}

            if response.tool_calls:
                names = [tc["name"] for tc in response.tool_calls]
                print(f"  [{name}] Requesting tools: {names}")
            else:
                preview = (response.content[:100] + "...") if len(response.content) > 100 else response.content
                print(f"  [{name}] Response: \"{preview}\"")

            response.name = name
            return {"messages": [response]}

        return specialist_node

    # ── Create specialist nodes ──────────────────────────────────────
    data_loader_node = make_specialist_node("data_loader", DATA_LOADER_PROMPT)
    analyst_node = make_specialist_node("analyst", ANALYST_PROMPT)
    code_reviewer_node = make_specialist_node("code_reviewer", CODE_REVIEWER_PROMPT)
    reporter_node = make_specialist_node("reporter", REPORTER_PROMPT)

    # ── Tool node (manual implementation — langgraph 1.1.0 compat) ──
    tools_by_name = {t.name: t for t in tools}

    async def tool_node(state: AnalysisState) -> dict:
        """Execute tool calls from the last AI message and return ToolMessages."""
        last_message = state["messages"][-1]
        results = []
        for tc in last_message.tool_calls:
            tool = tools_by_name.get(tc["name"])
            if tool is None:
                results.append(ToolMessage(
                    content=f"Error: unknown tool '{tc['name']}'",
                    tool_call_id=tc["id"],
                    name=tc["name"],
                ))
                continue
            try:
                output = await tool.ainvoke(tc["args"])
                results.append(ToolMessage(
                    content=str(output),
                    tool_call_id=tc["id"],
                    name=tc["name"],
                ))
            except Exception as e:
                results.append(ToolMessage(
                    content=f"Error executing {tc['name']}: {e}",
                    tool_call_id=tc["id"],
                    name=tc["name"],
                ))
        return {"messages": results}

    # ── Router functions ─────────────────────────────────────────────
    def manager_router(state: AnalysisState) -> str:
        """Route from manager to the next specialist or END."""
        next_agent = state.get("next_agent", "FINISH")
        if next_agent in ("data_loader", "analyst", "code_reviewer", "reporter"):
            return next_agent
        return "end"

    def specialist_router(state: AnalysisState) -> str:
        """After a specialist: go to tools if tool_calls exist, else back to manager."""
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return "manager"

    def post_tool_router(state: AnalysisState) -> str:
        """After tools execute, route back to the specialist that requested them."""
        for msg in reversed(state["messages"]):
            if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
                return msg.name
        return "manager"

    # ── Graph assembly ───────────────────────────────────────────────
    graph_builder = StateGraph(AnalysisState)

    # Register all nodes
    graph_builder.add_node("manager", manager_node)
    graph_builder.add_node("data_loader", data_loader_node)
    graph_builder.add_node("analyst", analyst_node)
    graph_builder.add_node("code_reviewer", code_reviewer_node)
    graph_builder.add_node("reporter", reporter_node)
    graph_builder.add_node("tools", tool_node)

    # Entry point
    graph_builder.set_entry_point("manager")

    # Manager routes to specialists or END
    graph_builder.add_conditional_edges(
        "manager",
        manager_router,
        {
            "data_loader": "data_loader",
            "analyst": "analyst",
            "code_reviewer": "code_reviewer",
            "reporter": "reporter",
            "end": END,
        },
    )

    # Each specialist either calls tools or returns to manager
    for specialist in ["data_loader", "analyst", "code_reviewer", "reporter"]:
        graph_builder.add_conditional_edges(
            specialist,
            specialist_router,
            {
                "tools": "tools",
                "manager": "manager",
            },
        )

    # After tools, route back to the specialist that called them
    graph_builder.add_conditional_edges(
        "tools",
        post_tool_router,
        {
            "data_loader": "data_loader",
            "analyst": "analyst",
            "code_reviewer": "code_reviewer",
            "reporter": "reporter",
            "manager": "manager",
        },
    )

    return graph_builder.compile()
