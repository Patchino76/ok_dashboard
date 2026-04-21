# graph_v3.py — Multi-Agent LangGraph Pipeline

**File:** `python/agentic/graph_v3.py`
**LLM:** Google Gemini (`gemini-3.1-flash-lite-preview`)

## Overview

Planner-driven multi-agent analysis pipeline built with LangGraph. A planner examines the user's request and selects relevant specialists from a pool of 6, avoiding wasted LLM calls on irrelevant analysis types.

## Execution Flow

```
[START]
  → data_loader_entry → data_loader ↔ tools → manager_review (auto-accept)
  → planner_entry     → planner              → manager_review (auto-accept)
  → specialist_1_entry → specialist_1 ↔ tools → manager_review (ACCEPT/REWORK)
  → specialist_2_entry → specialist_2 ↔ tools → manager_review (ACCEPT/REWORK)
  → ...
  → code_reviewer_entry → code_reviewer ↔ tools → manager_review
  → reporter_entry      → reporter ↔ tools → [END]
```

## State

```python
class AnalysisState(MessagesState):
    current_stage: str               # name of the active stage
    stages_to_run: list[str]         # full pipeline set by planner
    stage_attempts: dict[str, int]   # rework attempt counter per stage
```

## Pipeline Structure

The pipeline is built from three parts:

| Part | Stages | Behavior |
|------|--------|----------|
| **Fixed prefix** | `data_loader`, `planner` | Always run first; auto-accepted by manager |
| **Dynamic specialists** | Selected by planner from pool | Run in order; subject to manager review |
| **Fixed suffix** | `code_reviewer`, `reporter` | Always run last; validates and writes report |

## Specialist Pool

| Name | System Prompt | Focus |
|------|--------------|-------|
| `analyst` | `ANALYST_PROMPT` | EDA, SPC control charts, correlations, distributions, process capability (Cp/Cpk), missing data |
| `forecaster` | `FORECASTER_PROMPT` | Prophet forecasts, ARIMA, seasonal decomposition, changepoint detection, shift-level patterns |
| `anomaly_detective` | `ANOMALY_DETECTIVE_PROMPT` | Isolation Forest, DBSCAN regime detection, SHAP root cause, anomaly timeline, event clustering |
| `bayesian_analyst` | `BAYESIAN_ANALYST_PROMPT` | Bootstrap posteriors, Bayesian A/B tests, probabilistic Cpk, effect size estimation, conditional probabilities |
| `optimizer` | `OPTIMIZER_PROMPT` | Pareto frontiers, optimal operating windows per ore type, sensitivity tornado charts, Monte Carlo risk, setpoint recommendations |
| `shift_reporter` | `SHIFT_REPORTER_PROMPT` | Per-shift KPIs, Mann-Whitney shift comparisons, mill ranking, energy efficiency (kWh/ton), downtime analysis, handover reports |

## Fixed Stages

| Name | System Prompt | Purpose |
|------|--------------|---------|
| `data_loader` | `DATA_LOADER_PROMPT` | Load mill data from PostgreSQL. Computes date ranges from natural language. Stores as named DataFrames. |
| `planner` | `PLANNER_PROMPT` | Parses user request, selects 1–4 specialists, outputs `SPECIALISTS: a, b, c` format. |
| `code_reviewer` | `CODE_REVIEWER_PROMPT` | Validates all outputs: checks for missing charts, statistical errors, unreasonable values. Fixes critical issues. |
| `reporter` | `REPORTER_PROMPT` | Writes comprehensive Markdown report with embedded chart references. Minimum 1500 words. |

## Tool Binding

Each stage is bound to a specific tool subset via `llm.bind_tools()`:

| Stage | Tools |
|-------|-------|
| `data_loader` | `query_mill_data`, `query_combined_data`, `get_db_schema` |
| All analysis specialists + `code_reviewer` | `execute_python`, `list_output_files` |
| `reporter` | `list_output_files`, `write_markdown_report` |

## Manager Review

`manager_review_node` evaluates each specialist's output:

- **Auto-accept:** `data_loader` and `planner` are always accepted
- **LLM review:** Other stages are evaluated for completeness, quality, correctness, and actionability
- **ACCEPT** → advance to next stage in `stages_to_run`
- **REWORK** → send back to same specialist with feedback
- **Max reworks:** `MAX_REWORKS_PER_STAGE = 1` — after max reworks, auto-accept

## Token Budget Controls

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_TOOL_OUTPUT_CHARS` | 2000 | Truncation limit for tool output in messages |
| `MAX_AI_MSG_CHARS` | 3000 | Truncation limit for AI messages |
| `MAX_MESSAGES_WINDOW` | 14 | Max messages kept in context (sliding window) |
| `MAX_SPECIALIST_ITERS` | 5 | Max iterations per specialist before forced advance |

## Context Management

### `compress_messages(messages)`

Applies sliding window (`MAX_MESSAGES_WINDOW`) and truncates tool/AI messages to their respective limits. Keeps the first message (user question) plus the last N messages.

### `build_focused_context(all_msgs, stage_name)`

Builds a focused context window for a specialist:
1. Extracts the original user message
2. Collects the specialist's own prior messages and tool results
3. Summarizes other stages' outputs compactly (data loading results, python outputs, prior specialist findings)
4. Includes manager REWORK feedback if targeted at this specialist
5. Returns a compact message list: `[user_msg, prior_summary, own_messages...]`

### `strip_tool_messages(messages)`

Converts tool messages and tool-calling AI messages into plain AI messages for stages that don't use tools (planner, manager). Preserves content while removing tool call metadata.

## Domain Context

All prompts share `DOMAIN_CONTEXT` — a description of:

- **Plant:** 12 ball mills in an ore dressing factory
- **Tables:** `MILL_XX` with minute-level sensor data
- **Columns:** Ore, WaterMill, WaterZumpf, Power, ZumpfLevel, PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200
- **Ore quality:** Shisti, Daiki, Grano, Class_12, Class_15
- **Variable classification:** MV (operator-controlled), CV (process responses), DV (disturbances)
- **Shifts:** Shift 1 (06–14), Shift 2 (14–22), Shift 3 (22–06)

## Planner Selection Rules

From the planner prompt:
- General/vague requests → always include `analyst`
- "comprehensive" / "full analysis" → `analyst`, `anomaly_detective`, `shift_reporter`
- "forecast" / "predict" → `analyst`, `forecaster`
- "optimize" / "best settings" → `analyst`, `optimizer`
- "compare shifts" / "KPI report" → `shift_reporter`
- "anomaly" / "root cause" → `anomaly_detective`
- "uncertainty" / "how confident" → `analyst`, `bayesian_analyst`
- Max 4 specialists per analysis

## Progress Reporting

`build_graph()` accepts an optional `on_progress: Callable[[str, str], None]` callback. When provided:

| Node | Progress Messages |
|------|-------------------|
| Specialist | `"{Label} working (step N/M)..."`, `"{Label} calling tools: ..."`, `"{Label} completed."` |
| Planner | `"Planning analysis — selecting specialists..."`, `"Pipeline: Analyst → Forecaster → ..."` |
| Manager | `"Reviewing {Label} output..."`, `"{Label} — accepted."` or `"{Label} — rework requested."` |
| Tool node | `"Executing tool: {name}"` |
| System (routing) | `"Advancing: {Label} → {Label}"` |

Human-readable labels are provided via `_STAGE_LABELS` dictionary.

## Graph Assembly

1. **Register nodes:** For each stage in `ALL_STAGES`, register `{stage}_entry` (sets `current_stage`) and `{stage}` (runs the specialist)
2. **Planner special case:** Planner has its own node (no tools, no specialist factory)
3. **Entry point:** `data_loader_entry`
4. **Edges:**
   - `{stage}_entry → {stage}` for all stages
   - Each specialist → conditional: `tools` (if tool calls) or `manager_review`
   - `tools → after_tools()` → routes back to the specialist that called the tool
   - `manager_review → manager_router()` → next `{stage}_entry`, rework current `{stage}_entry`, or `END`
5. **Compile:** `graph.compile()` returns the executable graph

## `build_graph()` Signature

```python
def build_graph(
    tools: list[BaseTool],
    api_key: str,
    on_progress: Optional[Callable[[str, str], None]] = None,
) -> StateGraph:
```

- `tools` — LangChain tools from MCP client
- `api_key` — Google Gemini API key
- `on_progress` — optional callback for real-time progress reporting (no-op if None)
