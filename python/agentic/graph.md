# graph.py — Deep Dive

> File: `python/agentic/graph.py`  
> Purpose: Builds the LangGraph state machine that orchestrates multi-agent analysis in the AI Chat.  
> Related: `prompts.py`, `analysis_templates.py`, `skills/`, `tools/`, `api_endpoint.py`

---

## 1. High-Level Architecture

The file defines **two** separate graphs:

| Graph | When it runs | Goal |
|-------|-------------|------|
| **Main Analysis Graph** (`build_graph`) | User sends a **new** question | Full end-to-end analysis: load data → plan → execute → validate → report |
| **Follow-Up Graph** (`build_followup_graph`) | User replies to an existing report | Lightweight routing: decide if we need new analysis, a text edit, or just an answer |

Both graphs use **Google Gemini** via LangChain and share the same tool registry (Python execution, database queries, file I/O, etc.).

---

## 2. Main Analysis Graph (`build_graph`)

### 2.1 State Shape (`AnalysisState`)

```python
class AnalysisState(MessagesState):
    current_stage: str          # Which node is running right now
    stages_to_run: list[str]    # Ordered pipeline set by the planner
    stage_attempts: dict        # How many times each stage was retried
    parallel_mode: bool         # True when specialists run concurrently
    extensions_used: int        # How many times critic added extra specialists
```

`MessagesState` (from LangGraph) gives us a `messages: list[BaseMessage]` field automatically. Every node appends new messages to this list.

### 2.2 The Pipeline

```
START
  │
  ▼
data_loader ──► manager_review ──► planner ──► manager_review
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    │ (sequential)                  │ (parallel, optional)        │
                    ▼                               ▼                             ▼
            specialist_1 ──► tools           specialist_1 ──┐               specialist_N ──┐
                │                                │            │                    │       │
                ▼                                ▼            │                    ▼       │
            manager_review                  specialist_2 ─────┘               specialist_N-1│
                │                                │            │                    │       │
                ▼                                ▼            └────────────────────┘       │
            specialist_2 ──► tools          critic_entry ◄─────────────────────────────────┘
                │                                │
                ▼                                ▼
            manager_review                  critic ──► tools
                │                                │
                ▼                                ▼
            ...                            manager_review
                │                                │
                ▼                                ▼
            critic ──► tools              reporter ──► tools ──► END
                │
                ▼
            manager_review
                │
                ▼
            reporter ──► tools ──► END
```

**Fixed prefix stages** (always run first): `data_loader`, `planner`  
**Fixed suffix stages** (always run last): `critic`, `reporter`  
**Dynamic middle stages** (planner chooses): any subset of the 6 specialists.

---

### 2.3 Stage-by-Stage Breakdown

#### `data_loader`
- **Prompt**: `DATA_LOADER_PROMPT`
- **Tools**: Database queries (`query_mill_data`, `query_combined_data`, `get_db_schema`)
- **What it does**: Loads real mill data into a working DataFrame so downstream agents never hallucinate numbers.
- **Manager behavior**: Auto-accepted (infrastructure stage).

#### `planner`
- **Prompt**: `PLANNER_PROMPT` (+ optional memory hint from past analyses)
- **Tools**: None (pure reasoning)
- **What it does**:
  1. Reads the user question + loaded data summary.
  2. Decides which specialists are relevant.
  3. Outputs a JSON like `{"specialists": ["analyst", "forecaster"], "rationale": "..."}`.
- **Parsing**: `_parse_planner_specialists()` tries JSON first, falls back to legacy `SPECIALISTS: a, b` line format.
- **Fallback**: If parsing fails, defaults to `["analyst"]`.
- **Template override**: If the frontend sent a `template_id`, the planner is skipped entirely and the template's hardcoded specialist list is used instead.

#### Specialists (dynamic pool)

| Name | Role | Typical output |
|------|------|---------------|
| `analyst` | EDA, correlations, distributions, SPC charts | PNG charts, stats tables |
| `forecaster` | Time-series forecasting, seasonality, changepoints | Forecast plots |
| `anomaly_detective` | Multivariate anomaly detection, root-cause analysis | Anomaly timelines |
| `bayesian_analyst` | Bayesian inference, credible intervals, causal analysis | Interval charts |
| `optimizer` | Pareto frontiers, what-if simulation, optimal setpoints | Recommendation tables |
| `shift_reporter` | Shift KPIs, benchmarking, handover reports | Shift comparison charts |

Each specialist gets:
- Its own **system prompt** (imported from `prompts.py`).
- Its own **tool binding** (e.g. `optimizer` gets `execute_python`, `run_skill`, `list_output_files`, `list_skills`).
- Its own **iteration counter** (max 5 loops per specialist before forced exit).

#### `manager_review`
- **Purpose**: Quality gate between stages.
- **Auto-accept** (no LLM call) for: `data_loader`, `planner`, `critic`, `reporter`.
- **Heuristic fast-path**: If a specialist produced:
  - `execute_python` output with `"new_files": [...]` (non-empty)
  - `STRUCTURED_OUTPUT:` line present
  - No `"error"` or traceback
  -> Accept immediately without calling the LLM.
- **LLM review fallback**: For ambiguous cases, the manager LLM reads the stage output and decides `ACCEPT` or `REWORK`.
- **Max reworks**: 1 per stage. After that, forced accept.

#### `critic`
- **Prompt**: `CRITIC_PROMPT`
- **Tools**: Analysis tools + `review_chart` (vision tool to inspect PNG files)
- **What it does**:
  1. Cross-checks numbers across all specialist outputs.
  2. Flags silently broken charts (using vision).
  3. Can request **pipeline extensions** by outputting `EXTEND_PIPELINE: forecaster, optimizer`.
- **Extension limit**: 2 times max. New stages are spliced in before the reporter.

#### `reporter`
- **Prompt**: `REPORTER_PROMPT`
- **Tools**: `list_output_files`, `write_markdown_report`
- **What it does**: Synthesizes everything into a final Bulgarian report.
- **Model tiering**: Can use a stronger Gemini model than the rest of the pipeline (configured via `GEMINI_REPORTER_MODEL` env var or per-request `reporterModel` setting).

---

### 2.4 Tool Binding System

Tools are not shared equally. Each stage gets only the tools it needs:

```python
TOOL_SETS = {
    "data_loader":       ["query_mill_data", "query_combined_data", "get_db_schema"],
    "analyst":           ["execute_python", "run_skill", "list_output_files", "list_skills"],
    "forecaster":        ["execute_python", "run_skill", "list_output_files", "list_skills"],
    "anomaly_detective": ["execute_python", "run_skill", "list_output_files", "list_skills"],
    "bayesian_analyst":  ["execute_python", "run_skill", "list_output_files", "list_skills"],
    "optimizer":         ["execute_python", "run_skill", "list_output_files", "list_skills"],
    "shift_reporter":    ["execute_python", "run_skill", "list_output_files", "list_skills"],
    "critic":            ["execute_python", "run_skill", "list_output_files", "list_skills", "review_chart"],
    "reporter":          ["list_output_files", "write_markdown_report"],
}
```

**Why this matters**: Limiting tools prevents agents from making irrelevant API calls (e.g. the reporter cannot accidentally run Python and waste tokens).

---

### 2.5 Message Handling & Memory Optimization

#### Compression (`compress_messages`)
LangGraph keeps all messages in state. Long conversations would blow up token usage. Two safeguards:

1. **Window cap**: Only the last `MAX_MESSAGES_WINDOW` (default 14) messages are kept, plus the very first message (user question).
2. **Truncation**:
   - Tool outputs cut to `MAX_TOOL_OUTPUT_CHARS` (default 2000)
   - AI messages cut to `MAX_AI_MSG_CHARS` (default 3000)

#### Context Building (`build_focused_context`)
When a specialist node runs, it does **not** receive the entire message history. Instead it gets:

1. **Original user question** (always preserved)
2. **Prior summary** (compact excerpts from earlier stages):
   - Data loading confirmations
   - Python outputs (truncated to 1200 chars)
   - `STRUCTURED_OUTPUT` blocks (for structured data flow)
   - Other specialists' final prose (truncated to 400 chars, or 1500 for critic)
3. **Current stage's own messages** (full, but still compressed)

This ensures each specialist sees enough context to be coherent, but not so much that token costs explode.

---

### 2.6 Parallel vs Sequential Mode

#### Sequential (default)
```
planner -> analyst -> manager -> forecaster -> manager -> critic -> reporter
```
Each specialist waits for the previous one to finish and be accepted. Safe, but slower.

#### Parallel (opt-in via `enableParallelSpecialists` setting)
```
planner -> [analyst, forecaster, optimizer] -> critic -> reporter
```
All selected specialists run simultaneously. They converge directly at `critic_entry`. Cuts wall-clock time for multi-specialist analyses, but skips per-stage `manager_review` for the middle specialists (only the critic reviews them).

**How it works in code**:
- `manager_router` detects `current == "planner"` + `_ENABLE_PARALLEL == True`
- Returns a list of `Send(...)` objects — LangGraph's way of fanning out to multiple branches
- Each branch gets a copy of state with `parallel_mode = True`
- `specialist_router` sees `parallel_mode` and routes finished specialists to `critic_entry` instead of `manager_review`
- `make_stage_entry("critic")` resets `parallel_mode = False` so the suffix runs sequentially again

---

### 2.7 Long-Term Memory

Before the planner runs, the system looks up the 3 most similar past analyses for the same user role:

```python
# Pseudocode of the memory flow
if role and user_question:
    similar = db.find_similar_analyses(user_question, role, limit=3)
    if similar:
        _memory_hint = "RECENT SIMILAR ANALYSES...\n" + bullet_list
```

This hint is injected into the planner's system prompt as soft guidance ("which specialists tended to be useful for similar questions"), not as a hard rule.

**Implementation**: Cheap keyword-Jaccard retrieval in `db.py` — no embedding model required.

---

### 2.8 Structured Output Streaming (2C Protocol)

Skills can emit structured data by printing lines like:

```python
print(f"STRUCTURED_OUTPUT:{json.dumps({'metric': 'mean', 'value': 42.5})}")
```

The graph catches these in two places:

1. **`_extract_structured_output()`**: Extracts the JSON from `execute_python` stdout for inclusion in `build_focused_context` summaries.
2. **`_stream_structured_outputs()`**: Streams each `STRUCTURED_OUTPUT` block as a separate progress event with prefix `STRUCTURED:...` so the frontend can render "live data tiles" alongside the normal text progress feed.

This lets the UI show real-time metrics, tables, or mini-charts while the analysis is still running.

---

## 3. Follow-Up Graph (`build_followup_graph`)

### 3.1 When it runs
After the main analysis is complete, the user can ask follow-up questions. The follow-up graph handles these without re-running the full pipeline.

### 3.2 State Shape (`FollowUpState`)

```python
class FollowUpState(MessagesState):
    action: str        # SPECIALIST:<name> | REFINE_REPORT | ANSWER
    instruction: str   # What the executor must do
```

### 3.3 Two-Stage Flow

```
START
  │
  ▼
followup_router ──► followup_executor ──► [followup_tools] ──► followup_executor ──► END
```

#### Stage 1: `followup_router`
Decides the action by reading the user's latest message:

| Action | When chosen | What happens next |
|--------|------------|-------------------|
| `SPECIALIST:<name>` | User asks for new charts, plots, forecasts, calculations | Runs a specialist with `execute_python` + skills |
| `REFINE_REPORT` | User wants text edits, restructuring, more explanations | Rewrites the existing Markdown report |
| `ANSWER` | Simple text question using already-computed results | Direct text reply |

**Safety net**: If the user uses visual/chart keywords (`начертай`, `графика`, `plot`, `chart`, `forecast`) but the router chose `ANSWER`, it is overridden to `SPECIALIST:analyst`.

#### Stage 2: `followup_executor`
Builds a focused system prompt based on the action:
- **SPECIALIST**: Injects `FOLLOWUP_SPECIALIST_PROMPT` + "You are acting as the {name} specialist"
- **REFINE_REPORT**: Instructs to call `list_output_files`, read existing report, then `write_markdown_report`
- **ANSWER**: Instructs to use `execute_python` for any new calculations, with strict anti-hallucination rules

**Context window**: Last 30 messages, but always preserves leading `SystemMessage`s (e.g. injected report snapshots).

---

## 4. Routing Logic Deep Dive

### 4.1 `specialist_router`
Called after every specialist node. Decides where to go next:

```python
def specialist_router(state):
    last = state["messages"][-1]
    if last has tool_calls:
        return "tools"                    # Go run the requested tools
    if state["parallel_mode"]:
        return "critic_entry"              # Parallel branch done, converge at critic
    if current_stage == last_stage:
        return "end"                       # Terminal stage (reporter), skip manager
    return "manager_review"               # Normal path: quality gate
```

### 4.2 `manager_router`
Called after `manager_review`. Decides the next stage:

```python
def manager_router(state):
    if manager said "REWORK":
        return f"{current_stage}_entry"    # Send back for rework
    if parallel mode and current == "planner":
        return [Send(s1_entry), Send(s2_entry), ...]  # Fan out
    # Normal sequential path
    return f"{next_stage}_entry"
```

### 4.3 `after_tools`
Called after `tools` node. Routes back to the specialist that requested the tools:

```python
def after_tools(state):
    # Scan backwards to find the most recent specialist with tool_calls
    return specialist_name
```

---

## 5. Key Helper Functions

| Function | Purpose |
|----------|---------|
| `truncate(text, limit)` | Cuts text to max length, appends `... [truncated]` |
| `normalize_content(content)` | Flattens Gemini's list-of-dicts response format into plain text |
| `compress_messages(messages)` | Applies window cap + truncation to all messages |
| `strip_tool_messages(messages)` | Converts `ToolMessage`s into `AIMessage`s so they survive LLM APIs that reject tool messages in non-tool contexts |
| `build_focused_context(all_msgs, stage_name)` | Builds the minimal context a specialist needs (user question + prior summaries + own messages) |
| `_parse_planner_specialists(content)` | Robust parser for planner output (JSON or legacy line format) |
| `_heuristic_check(messages, stage_name)` | Fast auto-accept based on file creation + structured output + no errors |
| `_parse_extensions(messages, stages)` | Finds `EXTEND_PIPELINE: ...` lines in critic output |
| `_stream_structured_outputs(owner, output)` | Scans `execute_python` output and emits `STRUCTURED:...` progress events |

---

## 6. Configuration & Settings

All module-level constants can be overridden per-request via the `settings` dict:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxToolOutputChars` | 2000 | Max chars per tool output before truncation |
| `maxAiMessageChars` | 3000 | Max chars per AI message before truncation |
| `maxMessagesWindow` | 14 | How many recent messages to keep in window |
| `maxSpecialistIterations` | 5 | Max loops per specialist before forced exit |
| `enableParallelSpecialists` | False | Run selected specialists concurrently |
| `reporterModel` | `GEMINI_MODEL` | Optional stronger model for the reporter |

---

## 7. Error Handling Strategy

Every node that calls an LLM is wrapped in a `try/except`:

- **Planner fails** -> Defaults to `["analyst"]` pipeline
- **Specialist fails** -> Returns an `AIMessage` with error text, moves on
- **Manager review fails** -> Auto-accepts the stage
- **Follow-up router fails** -> Defaults to `ANSWER`
- **Follow-up executor fails** -> Returns error message in chat

No single failure kills the entire pipeline. The graph always attempts to produce *some* output.

---

## 8. Integration Points

### From the frontend (`src/app/ai-chat/`)
1. User sends message -> `chat-store.ts` POSTs to `/api/v1/agentic/analyze`
2. `api_endpoint.py` calls `build_graph(tools, api_key, on_progress, settings, template_id, ...)`
3. Graph runs as a background task, streaming progress via `on_progress` callback
4. Frontend polls `GET /api/v1/agentic/status/{id}` for completion + file list

### To the tools (`python/agentic/tools/`)
- `execute_python` -> `python_executor.py`
- `run_skill` / `list_skills` -> `session_tools.py`
- `query_mill_data` / `query_combined_data` / `get_db_schema` -> `session_tools.py`
- `write_markdown_report` -> `report_tools.py`
- `review_chart` -> `session_tools.py`

### To the skills (`python/agentic/skills/`)
Skills are pure Python functions imported and made available inside `execute_python` via the `_ADVANCED_LIBS` injection in `python_executor.py`.

---

## 9. Summary

`graph.py` is the **conductor** of the AI Chat orchestra. It does not analyze data itself — it decides:

1. **Which** specialists to run
2. **In what order** (or in parallel)
3. **How much context** each one gets
4. **Whether** their output is good enough
5. **When** to extend the pipeline
6. **How** to package everything into a final Bulgarian report

It optimizes for **cost** (token budgets, tool limits, context windows) and **reliability** (error fallbacks, heuristic fast-paths, max rework caps) while still enabling deep domain-specific analysis.
