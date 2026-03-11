"""
graph_v2.py — Hybrid multi-agent LangGraph for Ore Dressing Plant Analysis
===========================================================================
Deterministic stage order with manager QA review between stages:

  [START] → [data_loader] ↔ [tools] → [manager_review] →
            [analyst] ↔ [tools] → [manager_review] →
            [code_reviewer] ↔ [tools] → [manager_review] →
            [reporter] ↔ [tools] → [END]

The manager reviews after each stage and can send the specialist back
for improvements (up to 1 rework per stage). This produces higher quality
output while maintaining deterministic stage progression.
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
MAX_TOOL_OUTPUT_CHARS = 2000
MAX_AI_MSG_CHARS = 3000
MAX_MESSAGES_WINDOW = 14
MAX_SPECIALIST_ITERS = 5


# ── State ────────────────────────────────────────────────────────────────────

class AnalysisState(MessagesState):
    current_stage: str
    stage_attempts: dict  # track rework attempts per stage


# ── Sequential workflow ──────────────────────────────────────────────────────

STAGES = ["data_loader", "analyst", "code_reviewer", "reporter"]
MAX_REWORKS_PER_STAGE = 1  # manager can send back once per stage


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

You are the Data Analyst. The data is already loaded as a DataFrame named 'mill_data'.

Call execute_python with a SINGLE block of Python code that performs ALL analyses below.
The code MUST be well-structured and produce HIGH QUALITY charts.

Required analyses:
1. **EDA** — Distribution histograms with KDE for: Ore, PSI80, DensityHC, MotorAmp
2. **SPC** — Shewhart control charts (mean ± 3σ) for PSI80 and Ore. Mark out-of-control points in red.
3. **Correlations** — Heatmap of df.corr() for all numeric columns with annotations
4. **Anomaly detection** — Z-scores for PSI80 and Ore (threshold=3). Print counts and top 5 timestamps.
5. **Downtime** — Identify contiguous periods where Ore < 10 t/h. Print number of events, total hours, longest event.
6. **Time series overview** — Plot Ore and PSI80 over time on separate subplots to show trends.

CHART QUALITY RULES (CRITICAL):
- Use `sns.set_theme(style='whitegrid', font_scale=1.2)` at the start
- Figure sizes: distributions (10,6), SPC charts (14,5), heatmap (12,10), time series (14,8)
- All axes MUST have labels with units: 'Ore Feed Rate (t/h)', 'PSI80 (μm)', etc.
- All charts MUST have descriptive titles: 'Mill 8 — Ore Feed Rate Distribution'
- SPC charts: green dashed center line, red dashed UCL/LCL, red scatter for OOC points
- Heatmap: use annot=True, fmt='.2f', cmap='RdBu_r', center=0
- Histograms: use bins=50, add vertical lines for mean (green) and ±3σ (red dashed)
- Save ALL charts: plt.savefig(os.path.join(OUTPUT_DIR, 'filename.png'), dpi=150, bbox_inches='tight')
- ALWAYS call plt.close() after each savefig
- Use descriptive filenames: 'mill_8_ore_distribution.png', 'mill_8_psi80_spc.png', etc.

OUTPUT RULES:
- Print descriptive stats table for Ore, PSI80, DensityHC, MotorAmp
- Print SPC results: mean, std, UCL, LCL, number of OOC points for each variable
- Print anomaly counts and top 5 anomaly timestamps for each variable
- Print downtime summary: number of events, total hours, mean duration, max duration
- Print top 5 strongest correlations (excluding self-correlations)"""

CODE_REVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Code Reviewer. Validate the analysis outputs.

1. Call list_output_files to see what charts were generated
2. Review the stdout output from the analyst for errors or missing analyses
3. Check that ALL required charts exist:
   - 4 distribution plots (Ore, PSI80, DensityHC, MotorAmp)
   - 2 SPC control charts (PSI80, Ore)
   - 1 correlation heatmap
   - 1 time series overview (if requested)
4. If any charts are MISSING, call execute_python with code to generate ONLY the missing ones
5. If everything is complete, write a validation summary listing all generated files

Do NOT regenerate charts that already exist. Only fill gaps."""

REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Reporter. Write a COMPREHENSIVE professional Markdown analysis report.

1. First call list_output_files to get the exact chart filenames
2. Then call write_markdown_report with the full report content

The report MUST follow this structure and be DETAILED (at least 2000 words):

# Mill [N] Comprehensive Analysis Report

## 1. Executive Summary
3-4 sentences covering: overall mill health assessment, most critical finding,
key risk identified, and primary recommendation.

## 2. Data Overview
- Dataset: number of rows, time period (start — end), sampling frequency
- Variables analyzed: list all 13 process variables with brief descriptions
- Data quality: any NaN counts, gaps in time series

## 3. Exploratory Data Analysis
### 3.1 Ore Feed Rate
- Statistical summary (mean, std, min, max, quartiles) with actual numbers
- Distribution shape description (normal, skewed, bimodal?)
- ![Ore Distribution](exact_filename.png)

### 3.2 Grinding Quality (PSI80)
- Same statistical detail as above
- ![PSI80 Distribution](exact_filename.png)

### 3.3 Hydrocyclone Density (DensityHC)
- Statistical summary and distribution analysis
- ![DensityHC Distribution](exact_filename.png)

### 3.4 Motor Current (MotorAmp)
- Statistical summary and distribution analysis
- ![MotorAmp Distribution](exact_filename.png)

## 4. Statistical Process Control
### 4.1 Ore Feed Rate Control Chart
- Center line (mean), UCL, LCL values
- Number and percentage of out-of-control points
- Interpretation: is the process in statistical control?
- ![Ore SPC](exact_filename.png)

### 4.2 PSI80 Control Chart
- Same detail as above
- ![PSI80 SPC](exact_filename.png)

## 5. Correlation Analysis
- Top 5 strongest positive correlations with values
- Top 5 strongest negative correlations with values
- Key insights for operators (which variables are linked)
- ![Correlation Heatmap](exact_filename.png)

## 6. Anomaly Detection
- Method: Z-score with threshold = 3
- PSI80: number of anomalies, percentage of total data, notable timestamps
- Ore: number of anomalies, percentage of total data, notable timestamps
- Pattern analysis: are anomalies clustered or random?

## 7. Downtime Analysis
- Definition: periods where Ore < 10 t/h
- Number of downtime events
- Total downtime hours and percentage of total time
- Longest single downtime event (duration and timestamp)
- Average downtime duration

## 8. Conclusions & Recommendations
1. [Specific actionable recommendation with justification]
2. [Specific actionable recommendation with justification]
3. [Specific actionable recommendation with justification]
4. [Specific actionable recommendation with justification]
5. [Specific actionable recommendation with justification]

---
*Report generated by Agentic Analysis System*

CRITICAL RULES:
- Use EXACT filenames from list_output_files — only reference charts that actually exist
- Include ACTUAL numbers from the analysis (means, stds, counts, etc.)
- Do NOT use placeholder text like 'X anomalies were detected' — use real numbers
- Every section must have substantive content, not just headers"""

MANAGER_REVIEW_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Quality Manager reviewing the output of a specialist agent.
Your job is to decide if the work is ACCEPTABLE or needs REWORK.

Evaluate the last specialist's output for:
- Completeness: did they do everything asked?
- Quality: are charts well-formatted? Is the report detailed with actual numbers?
- Correctness: are there errors or unreasonable values?

Respond with EXACTLY one of:
- ACCEPT: [brief reason] — if the work is good enough to proceed
- REWORK: [specific instructions on what to fix] — if improvements are needed

Be concise. One line is enough."""


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

    def strip_tool_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        """Remove ToolMessages and tool_calls for the manager (no tools bound)."""
        clean = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = msg.content if isinstance(msg.content, str) else str(msg.content)
                clean.append(AIMessage(
                    content=f"[Tool result from {msg.name}]: {content[:800]}",
                    name=msg.name,
                ))
            elif isinstance(msg, AIMessage) and msg.tool_calls:
                text = msg.content or f"[{getattr(msg, 'name', 'agent')} requested tools]"
                clean.append(AIMessage(content=text, name=getattr(msg, "name", None)))
            else:
                clean.append(msg)
        return clean

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
                print(f"  [{name}] Iteration cap reached, advancing.")
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

    # ── Manager review node ──────────────────────────────────────────
    def manager_review_node(state: AnalysisState) -> dict:
        current = state.get("current_stage", "data_loader")
        attempts = state.get("stage_attempts", {})
        attempt_count = attempts.get(current, 0)

        print(f"\n  [manager] Reviewing {current} output (attempt {attempt_count + 1})...")

        # Skip review for data_loader (just load and move on)
        if current == "data_loader":
            print(f"  [manager] Data loaded — advancing.")
            return {
                "messages": [AIMessage(content="ACCEPT: Data loaded successfully.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        # If already reworked max times, force accept
        if attempt_count >= MAX_REWORKS_PER_STAGE:
            print(f"  [manager] Max reworks reached for {current} — accepting.")
            return {
                "messages": [AIMessage(content=f"ACCEPT: Max reworks reached for {current}.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        compressed = compress_messages(state["messages"])
        messages = [SystemMessage(content=MANAGER_REVIEW_PROMPT)] + strip_tool_messages(compressed)

        try:
            response = llm.invoke(messages)
        except Exception as e:
            print(f"  [manager] Review error: {str(e)[:150]}")
            return {
                "messages": [AIMessage(content="ACCEPT: Review skipped due to error.", name="manager")],
                "stage_attempts": {**attempts, current: attempt_count + 1},
            }

        content = response.content if isinstance(response.content, str) else str(response.content)
        decision = "ACCEPT" if "ACCEPT" in content.upper() else "REWORK"
        print(f"  [manager] Decision: {decision} — {content[:150]}")

        return {
            "messages": [AIMessage(content=content, name="manager")],
            "stage_attempts": {**attempts, current: attempt_count + 1},
        }

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
    def specialist_router(state: AnalysisState) -> str:
        """After specialist: go to tools if tool_calls, else to manager review."""
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "manager_review"

    def after_tools(state: AnalysisState) -> str:
        """After tool execution, return to the specialist that called them."""
        for msg in reversed(state["messages"]):
            if hasattr(msg, "tool_calls") and msg.tool_calls and getattr(msg, "name", None):
                return msg.name
        return "data_loader"

    def manager_router(state: AnalysisState) -> str:
        """After manager review: advance to next stage or rework current."""
        last = state["messages"][-1]
        content = last.content if isinstance(last.content, str) else str(last.content)
        current = state.get("current_stage", "data_loader")

        # If REWORK, send back to current specialist
        if "REWORK" in content.upper():
            print(f"  [manager] Sending {current} back for rework.")
            return f"{current}_entry"

        # ACCEPT — advance to next stage
        idx = STAGES.index(current) if current in STAGES else 0
        if idx + 1 < len(STAGES):
            next_stage = STAGES[idx + 1]
            print(f"\n  ──→ Advancing: {current} → {next_stage}")
            return f"{next_stage}_entry"
        print(f"\n  ──→ Pipeline complete!")
        return "end"

    # ── Stage entry nodes ────────────────────────────────────────────
    def make_stage_entry(stage_name: str):
        def entry_node(state: AnalysisState) -> dict:
            return {"current_stage": stage_name}
        return entry_node

    # ── Graph assembly ───────────────────────────────────────────────
    graph = StateGraph(AnalysisState)

    # Specialist + entry nodes
    for stage in STAGES:
        graph.add_node(f"{stage}_entry", make_stage_entry(stage))
        graph.add_node(stage, make_specialist_node(stage))

    graph.add_node("tools", tool_node)
    graph.add_node("manager_review", manager_review_node)

    # Entry point
    graph.set_entry_point("data_loader_entry")

    # Wire: entry → specialist
    for stage in STAGES:
        graph.add_edge(f"{stage}_entry", stage)

    # Wire: specialist → tools or manager_review
    for stage in STAGES:
        graph.add_conditional_edges(
            stage,
            specialist_router,
            {"tools": "tools", "manager_review": "manager_review"},
        )

    # Wire: tools → back to specialist
    graph.add_conditional_edges(
        "tools",
        after_tools,
        {stage: stage for stage in STAGES},
    )

    # Wire: manager_review → next stage or rework or END
    manager_targets = {f"{stage}_entry": f"{stage}_entry" for stage in STAGES}
    manager_targets["end"] = END
    graph.add_conditional_edges(
        "manager_review",
        manager_router,
        manager_targets,
    )

    return graph.compile()
