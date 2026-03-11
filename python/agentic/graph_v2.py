"""
graph.py — Sequential multi-agent LangGraph for Ore Dressing Plant Analysis
=============================================================================
Deterministic sequential pipeline — no LLM-based routing:

  [START] → [data_loader] ↔ [tools] → [analyst] ↔ [tools] →
            [code_reviewer] ↔ [tools] → [reporter] ↔ [tools] → [END]

Each specialist loops with tools until it returns a message without tool_calls,
then automatically advances to the next stage. No manager needed.
"""

from typing import TypedDict

from langchain_core.messages import (
    SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage,
)
from langchain_core.tools import BaseTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, MessagesState, END, START

GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

# Token-budget controls
MAX_TOOL_OUTPUT_CHARS = 1500
MAX_AI_MSG_CHARS = 2000
MAX_MESSAGES_WINDOW = 10
MAX_SPECIALIST_ITERS = 3


# ── State ────────────────────────────────────────────────────────────────────

class AnalysisState(MessagesState):
    current_stage: str


# ── Sequential workflow ──────────────────────────────────────────────────────

STAGES = ["data_loader", "analyst", "code_reviewer", "reporter"]


# ── System prompts ───────────────────────────────────────────────────────────

DOMAIN_CONTEXT = """You are working on data from an ore dressing factory with 12 ball mills.
Data is in MILL_XX tables (minute-level time-series) with columns:
TimeStamp (index), Ore (t/h), WaterMill, WaterZumpf, Power, ZumpfLevel,
PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200.
Ore quality (ore_quality table): Shisti, Daiki, Grano, Class_12, Class_15."""

DATA_LOADER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Loader. Your ONLY job is to call query_mill_data to load data.

Extract the mill number from the user request. Call query_mill_data with mill_number (required).
If a date range is mentioned, pass start_date and end_date.
After the tool returns, write a brief summary of what was loaded (rows, date range, columns).
Do NOT call any other tool. Do NOT analyze the data."""

ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Analyst. The data is already loaded as a DataFrame.

Call execute_python with a SINGLE block of Python code that does ALL of the following:
1. EDA: df.describe() for key vars, distribution histograms for Ore, PSI80, DensityHC, MotorAmp
2. SPC: Control charts (mean ± 3σ) for PSI80 and Ore, count out-of-control points
3. Correlations: heatmap of df.corr() for all numeric columns
4. Anomaly detection: Z-scores for PSI80 and Ore (threshold=3), print counts
5. Downtime: identify periods where Ore < 10 (group contiguous blocks), print total hours

RULES:
- The DataFrame is available as `df` (already loaded with TimeStamp index)
- Save EVERY chart: plt.savefig(os.path.join(OUTPUT_DIR, 'filename.png'), dpi=150, bbox_inches='tight')
- ALWAYS call plt.close() after each figure
- Use sns.set_style('whitegrid') at the start
- Print all key statistics to stdout
- Use descriptive filenames like 'mill_8_ore_distribution.png'"""

CODE_REVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Code Reviewer. Check the analysis results.

1. Call list_output_files to see what charts were generated
2. Review the stdout output from the analyst
3. If charts are missing or there were errors, call execute_python with corrective code
4. If everything looks good, write a short validation summary

Be concise. Focus only on whether the analysis produced correct outputs."""

REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Reporter. Write a professional Markdown analysis report.

1. First call list_output_files to get the exact chart filenames
2. Then call write_markdown_report with a complete report

Report structure:
# Mill [N] Analysis Report

## Executive Summary
2-3 sentences on overall mill health and key findings.

## Data Overview
Rows, date range, key variables.

## Key Findings
### Process Performance
Ore and PSI80 trends with chart references: ![title](filename.png)

### Statistical Process Control
Control chart results, out-of-control points.

### Correlations
Key relationships found in the heatmap.

### Anomalies & Downtime
Z-score anomaly counts, downtime periods and total hours.

## Recommendations
3-5 actionable items for plant managers.

IMPORTANT: Use EXACT filenames from list_output_files. Only reference charts that actually exist."""


# ── Graph builder ────────────────────────────────────────────────────────────

def build_graph(tools: list[BaseTool], api_key: str) -> StateGraph:
    llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=api_key)
    llm_with_tools = llm.bind_tools(tools)

    # ── Message compression ──────────────────────────────────────────
    def compress_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        if len(messages) > MAX_MESSAGES_WINDOW + 1:
            messages = [messages[0]] + messages[-(MAX_MESSAGES_WINDOW):]

        compressed = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                if len(content) > MAX_TOOL_OUTPUT_CHARS:
                    compressed.append(ToolMessage(
                        content=content[:MAX_TOOL_OUTPUT_CHARS] + "\n... [truncated]",
                        tool_call_id=msg.tool_call_id, name=msg.name,
                    ))
                else:
                    compressed.append(msg)
            elif isinstance(msg, AIMessage):
                content = msg.content or ""
                if len(content) > MAX_AI_MSG_CHARS:
                    compressed.append(AIMessage(
                        content=content[:MAX_AI_MSG_CHARS] + "\n... [truncated]",
                        name=getattr(msg, "name", None),
                        tool_calls=msg.tool_calls if msg.tool_calls else [],
                    ))
                else:
                    compressed.append(msg)
            else:
                compressed.append(msg)
        return compressed

    # ── Specialist node factory ──────────────────────────────────────
    PROMPTS = {
        "data_loader": DATA_LOADER_PROMPT,
        "analyst": ANALYST_PROMPT,
        "code_reviewer": CODE_REVIEWER_PROMPT,
        "reporter": REPORTER_PROMPT,
    }

    def make_specialist_node(name: str):
        system_prompt = PROMPTS[name]

        def specialist_node(state: AnalysisState) -> dict:
            iteration = sum(1 for m in state["messages"] if getattr(m, "name", None) == name) + 1
            print(f"\n  [{name}] iteration {iteration}/{MAX_SPECIALIST_ITERS} — processing...")

            if iteration > MAX_SPECIALIST_ITERS:
                print(f"  [{name}] Iteration cap reached, advancing to next stage.")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Done (iteration cap). Moving on.",
                        name=name,
                    )],
                }

            messages = [SystemMessage(content=system_prompt)] + compress_messages(state["messages"])

            try:
                response = llm_with_tools.invoke(messages)
            except Exception as e:
                error_str = str(e)
                print(f"  [{name}] LLM error: {error_str[:200]}")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Error: {error_str[:150]}. Moving on.",
                        name=name,
                    )],
                }

            if response.tool_calls:
                tool_names = [tc["name"] for tc in response.tool_calls]
                print(f"  [{name}] Calling tools: {tool_names}")
            else:
                preview = (response.content[:120] + "...") if response.content and len(response.content) > 120 else response.content
                print(f"  [{name}] Done: \"{preview}\"")

            response.name = name
            return {"messages": [response]}

        return specialist_node

    # ── Tool execution node ──────────────────────────────────────────
    tools_by_name = {t.name: t for t in tools}

    async def tool_node(state: AnalysisState) -> dict:
        last_message = state["messages"][-1]
        results = []
        for tc in last_message.tool_calls:
            tool = tools_by_name.get(tc["name"])
            if tool is None:
                results.append(ToolMessage(
                    content=f"Error: unknown tool '{tc['name']}'",
                    tool_call_id=tc["id"], name=tc["name"],
                ))
                continue
            try:
                print(f"    [tool] Executing {tc['name']}...")
                output = await tool.ainvoke(tc["args"])
                results.append(ToolMessage(
                    content=str(output), tool_call_id=tc["id"], name=tc["name"],
                ))
            except Exception as e:
                results.append(ToolMessage(
                    content=f"Error: {e}", tool_call_id=tc["id"], name=tc["name"],
                ))
        return {"messages": results}

    # ── Routing logic ────────────────────────────────────────────────
    def needs_tools(state: AnalysisState) -> str:
        """If the specialist requested tools, go to tools. Otherwise advance."""
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "next_stage"

    def after_tools(state: AnalysisState) -> str:
        """After tool execution, return to the specialist that called them."""
        for msg in reversed(state["messages"]):
            if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
                return msg.name
        return "data_loader"  # fallback

    def advance_stage(state: AnalysisState) -> str:
        """Move to the next stage in the pipeline, or END if done."""
        current = state.get("current_stage", "data_loader")
        idx = STAGES.index(current) if current in STAGES else 0
        if idx + 1 < len(STAGES):
            next_stage = STAGES[idx + 1]
            print(f"\n  ──→ Advancing: {current} → {next_stage}")
            return next_stage
        print(f"\n  ──→ Pipeline complete!")
        return "end"

    # ── Stage transition nodes ───────────────────────────────────────
    # Each stage sets current_stage before calling the specialist
    def make_stage_entry(stage_name: str):
        def entry_node(state: AnalysisState) -> dict:
            return {"current_stage": stage_name}
        return entry_node

    # ── Graph assembly ───────────────────────────────────────────────
    graph = StateGraph(AnalysisState)

    # Add specialist nodes + entry nodes
    for stage in STAGES:
        graph.add_node(f"{stage}_entry", make_stage_entry(stage))
        graph.add_node(stage, make_specialist_node(stage))

    graph.add_node("tools", tool_node)

    # Entry point → first stage entry
    graph.set_entry_point("data_loader_entry")

    # Wire: entry → specialist
    for stage in STAGES:
        graph.add_edge(f"{stage}_entry", stage)

    # Wire: specialist → tools or next_stage
    next_stage_map = {}
    for i, stage in enumerate(STAGES):
        if i + 1 < len(STAGES):
            next_stage_map[stage] = f"{STAGES[i + 1]}_entry"
        else:
            next_stage_map[stage] = None  # last stage → END

    for stage in STAGES:
        target = next_stage_map[stage] or END
        graph.add_conditional_edges(
            stage,
            needs_tools,
            {
                "tools": "tools",
                "next_stage": target if target != END else END,
            },
        )

    # Wire: tools → back to the specialist
    graph.add_conditional_edges(
        "tools",
        after_tools,
        {stage: stage for stage in STAGES},
    )

    return graph.compile()
