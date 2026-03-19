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

from datetime import datetime, timedelta
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

CRITICAL: ALWAYS compute start_date and end_date to filter at SQL level. Never load full tables.
- "last 24 hours" → end_date = today's date, start_date = yesterday's date (ISO format YYYY-MM-DD)
- "last 30 days" → end_date = today, start_date = 30 days ago
- "last week" → end_date = today, start_date = 7 days ago
- Today's date: {{TODAY_DATE}}. Use this to compute date ranges.
- If no time range is mentioned, default to last 30 days.

RULES:
- Extract mill number(s) from the request. If "all mills" → load mills 1 through 12.
- ALWAYS pass start_date and end_date to every query_mill_data call.
- Each mill is stored automatically as 'mill_data_N' (e.g. mill_data_1, mill_data_8).
- After loading, write a brief summary: mills loaded, rows per mill, date range.
- Do NOT call any other tool. Do NOT analyze the data."""

ANALYST_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Data Analyst. Data has been loaded by the data_loader.

ACCESSING DATA:
- Call list_dfs() first to see all loaded DataFrames and their shapes
- Single mill: df = get_df('mill_data_8')  — for mill 8
- Multiple mills: use a loop: for i in range(1, 13): df = get_df(f'mill_data_{{i}}')
- The variable `df` is pre-set to the first loaded DataFrame

Call execute_python with a SINGLE block of Python code.
ALWAYS start your code with:
```
print("Loaded DataFrames:", list_dfs())
```

For MULTI-MILL comparison requests:
- Build a summary dict/DataFrame with stats per mill (mean Ore, std, etc.)
- Create bar charts comparing mills side-by-side
- Use the LAST 24 hours of data if requested: df_recent = df[df.index >= df.index.max() - pd.Timedelta(hours=24)]

For SINGLE-MILL analysis requests:
- EDA: distributions for Ore, PSI80, DensityHC, MotorAmp
- SPC: control charts (mean ± 3σ) for PSI80 and Ore
- Correlations: heatmap of df.corr()
- Anomaly detection: Z-scores (threshold=3)
- Downtime: periods where Ore < 10 t/h

CHART QUALITY RULES (CRITICAL):
- Use `sns.set_theme(style='whitegrid', font_scale=1.2)` at the start
- Figure sizes: bar charts (14,7), distributions (10,6), SPC (14,5), heatmap (12,10)
- All axes MUST have labels with units: 'Ore Feed Rate (t/h)', 'PSI80 (μm)', etc.
- All charts MUST have descriptive titles
- For bar charts: use different colors per mill, add value labels on bars, rotate x-labels if needed
- Save ALL charts: plt.savefig(os.path.join(OUTPUT_DIR, 'filename.png'), dpi=150, bbox_inches='tight')
- ALWAYS call plt.close() after each savefig

OUTPUT RULES:
- Print all key statistics to stdout (the reporter will use these numbers)
- Print a summary table at the end"""

CODE_REVIEWER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Code Reviewer. Validate the analysis outputs.

1. Call list_output_files to see what charts were generated
2. Review the stdout from previous steps for errors
3. If there are NO chart files (.png), call execute_python to regenerate them
4. If charts exist and stdout has meaningful results, write a short validation summary

Do NOT regenerate charts that already exist. Only fix errors or fill gaps."""

REPORTER_PROMPT = f"""{DOMAIN_CONTEXT}

You are the Reporter. Write a COMPREHENSIVE professional Markdown analysis report.

STEPS:
1. Call list_output_files to get the exact chart filenames
2. Read through ALL previous messages to extract statistics and findings
3. Call write_markdown_report with the full report content

Report MUST include:
- **Title** matching the analysis request
- **Executive Summary**: 3-4 sentences with the key findings and actual numbers
- **Data Overview**: what data was loaded, time range, number of records
- **Findings sections**: organize by the analyses performed, include actual numbers from stdout
- **Charts**: embed EVERY .png file from list_output_files using ![description](exact_filename.png)
- **Conclusions & Recommendations**: 3-5 specific actionable items

CRITICAL RULES:
- Use EXACT filenames from list_output_files — only reference charts that actually exist
- Include ACTUAL numbers from the analysis (means, stds, counts) — extract from prior messages
- Do NOT use placeholder text — use real numbers from the analysis
- Every section must have substantive content, not just headers
- The report should be at least 1000 words"""

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

    # ── Per-specialist tool binding ─────────────────────────────────────
    tools_by_name = {t.name: t for t in tools}
    TOOL_SETS = {
        "data_loader": ["query_mill_data", "query_combined_data", "get_db_schema"],
        "analyst":     ["execute_python", "list_output_files"],
        "code_reviewer": ["execute_python", "list_output_files"],
        "reporter":    ["list_output_files", "write_markdown_report"],
    }
    specialist_llms = {}
    for stage_name, tool_names in TOOL_SETS.items():
        stage_tools = [tools_by_name[n] for n in tool_names if n in tools_by_name]
        specialist_llms[stage_name] = llm.bind_tools(stage_tools)

    # ── Message helpers ─────────────────────────────────────────────────
    def truncate(text: str, limit: int) -> str:
        return text[:limit] + "\n... [truncated]" if len(text) > limit else text

    def normalize_content(content) -> str:
        """Gemini sometimes returns list of dicts instead of str."""
        if isinstance(content, list):
            texts = [item.get("text", "") if isinstance(item, dict) else str(item) for item in content]
            return "\n".join(texts).strip()
        return str(content) if content else ""

    def compress_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
        if len(messages) > MAX_MESSAGES_WINDOW + 1:
            messages = [messages[0]] + messages[-(MAX_MESSAGES_WINDOW):]

        compressed = []
        for msg in messages:
            if isinstance(msg, ToolMessage):
                content = normalize_content(msg.content)
                compressed.append(ToolMessage(
                    content=truncate(content, MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
            elif isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if len(content) > MAX_AI_MSG_CHARS:
                    compressed.append(AIMessage(
                        content=truncate(content, MAX_AI_MSG_CHARS),
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
                content = normalize_content(msg.content)
                clean.append(AIMessage(
                    content=f"[Tool result from {msg.name}]: {truncate(content, 800)}",
                    name=msg.name,
                ))
            elif isinstance(msg, AIMessage) and msg.tool_calls:
                text = normalize_content(msg.content) or f"[{getattr(msg, 'name', 'agent')} requested tools]"
                clean.append(AIMessage(content=text, name=getattr(msg, "name", None)))
            else:
                clean.append(msg)
        return clean

    # ── Focused context builder ─────────────────────────────────────────
    def build_focused_context(all_msgs: list[BaseMessage], stage_name: str) -> list[BaseMessage]:
        """Give each specialist ONLY what it needs:
        1. The original user request (HumanMessage)
        2. A compact summary of prior stages (data loaded, analysis results)
        3. This stage's own messages + tool results (for the tool-call loop)
        """
        user_msg = None
        prior_summary_parts = []
        current_stage_msgs = []

        # Identify which tool_call_ids belong to this stage
        my_tool_call_ids = set()
        for msg in all_msgs:
            if isinstance(msg, AIMessage) and getattr(msg, "name", None) == stage_name and msg.tool_calls:
                for tc in msg.tool_calls:
                    my_tool_call_ids.add(tc.get("id"))

        for msg in all_msgs:
            # 1. Capture original user request
            if isinstance(msg, HumanMessage) and user_msg is None:
                user_msg = msg
                continue

            msg_name = getattr(msg, "name", None)

            # 2. Messages from THIS stage → keep them for the tool loop
            if msg_name == stage_name:
                current_stage_msgs.append(msg)
                continue

            # Tool results for THIS stage's tool calls → keep
            if isinstance(msg, ToolMessage) and msg.tool_call_id in my_tool_call_ids:
                content = normalize_content(msg.content)
                current_stage_msgs.append(ToolMessage(
                    content=truncate(content, MAX_TOOL_OUTPUT_CHARS),
                    tool_call_id=msg.tool_call_id, name=msg.name,
                ))
                continue

            # 3. Messages from OTHER stages → summarize compactly
            if isinstance(msg, ToolMessage) and msg.name == "query_mill_data":
                content = normalize_content(msg.content)
                if "loaded" in content.lower():
                    prior_summary_parts.append(truncate(content, 150))
            elif isinstance(msg, ToolMessage) and msg.name == "execute_python":
                content = normalize_content(msg.content)
                prior_summary_parts.append(f"[python output]: {truncate(content, 800)}")
            elif isinstance(msg, AIMessage) and msg_name and msg_name != "manager" and not msg.tool_calls:
                content = normalize_content(msg.content)
                if content:
                    prior_summary_parts.append(f"[{msg_name}]: {truncate(content, 300)}")
            elif msg_name == "manager" and isinstance(msg, AIMessage):
                content = normalize_content(msg.content)
                if "REWORK" in content and stage_name in content:
                    current_stage_msgs.append(msg)  # manager feedback for this stage

        # Assemble
        result = []
        if user_msg:
            result.append(user_msg)

        if prior_summary_parts:
            # Compact: only last few summaries to keep context tight
            summary = "[Prior analysis context]:\n" + "\n".join(prior_summary_parts[-6:])
            result.append(HumanMessage(content=summary))

        result.extend(compress_messages(current_stage_msgs))
        return result

    # ── Specialist node factory ────────────────────────────────────────────
    today = datetime.now().strftime("%Y-%m-%d")
    PROMPTS = {
        "data_loader": DATA_LOADER_PROMPT.replace("{TODAY_DATE}", today),
        "analyst": ANALYST_PROMPT,
        "code_reviewer": CODE_REVIEWER_PROMPT,
        "reporter": REPORTER_PROMPT,
    }

    def make_specialist_node(name: str):
        system_prompt = PROMPTS[name]
        stage_llm = specialist_llms[name]

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

            # Build focused context: user request + prior-stage summary + current stage msgs
            raw_msgs = state["messages"]
            focused = build_focused_context(raw_msgs, name)
            messages = [SystemMessage(content=system_prompt)] + focused

            # DEBUG: show what we're sending to the LLM
            print(f"  [{name}] Context: {len(focused)} msgs, types: {[type(m).__name__ for m in focused]}")
            for i, m in enumerate(focused):
                content = m.content if isinstance(m.content, str) else str(m.content)
                print(f"    msg[{i}] {type(m).__name__}: {content[:100]}...")

            try:
                response = stage_llm.invoke(messages)
            except Exception as e:
                error_str = str(e)
                print(f"  [{name}] LLM error: {error_str[:200]}")
                return {
                    "messages": [AIMessage(
                        content=f"[{name}] Error: {error_str[:150]}. Moving on.",
                        name=name,
                    )],
                }

            # DEBUG: show raw response
            print(f"  [{name}] Raw response: content_type={type(response.content).__name__}, tool_calls={len(response.tool_calls) if response.tool_calls else 0}")
            if response.tool_calls:
                print(f"  [{name}] Raw tool_calls: {[tc['name'] for tc in response.tool_calls]}")

            # Normalize Gemini list-format content to string
            response.content = normalize_content(response.content)

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

        raw = response.content
        if isinstance(raw, list):
            # Gemini sometimes returns [{"type": "text", "text": "..."}]
            texts = [item.get("text", "") if isinstance(item, dict) else str(item) for item in raw]
            content = "\n".join(texts).strip()
        else:
            content = str(raw).strip()

        # Default to ACCEPT unless REWORK is explicitly stated
        if content.upper().startswith("REWORK") or "REWORK:" in content.upper():
            decision = "REWORK"
            stamped = f"REWORK: {content}"
        else:
            decision = "ACCEPT"
            stamped = f"ACCEPT: {content}"

        print(f"  [manager] Decision: {decision} — {content[:150]}")

        return {
            "messages": [AIMessage(content=stamped, name="manager")],
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

        # Only rework if message explicitly starts with REWORK:
        if content.startswith("REWORK:"):
            print(f"  [manager] Sending {current} back for rework.")
            return f"{current}_entry"

        # Everything else (ACCEPT:, errors, etc.) → advance
        idx = STAGES.index(current) if current in STAGES else 0
        if idx + 1 < len(STAGES):
            next_stage = STAGES[idx + 1]
            print(f"\n  ──→ Advancing: {current} → {next_stage}")
            return f"{next_stage}_entry"
        print(f"\n  ──→ Pipeline complete!")
        return "end"

    # ── Stage entry nodes ────────────────────────────────────────
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
