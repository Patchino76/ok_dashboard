# Prompts & Agent Design

## Overview

Each specialist agent is driven by a **system prompt** that defines its role, capabilities, and rules. The prompts are carefully engineered to:

1. Provide **domain context** about the ore dressing plant
2. Define **exactly which tools** the agent should call
3. Set **output format rules** (chart quality, report structure)
4. Prevent **role confusion** (e.g., reporter shouldn't load data)

All prompts share a common `DOMAIN_CONTEXT` prefix that grounds the LLM in the industrial domain.

---

## Shared Domain Context

```python
DOMAIN_CONTEXT = """You are working on data from an ore dressing factory with 12 ball mills.
Data is in MILL_XX tables (minute-level time-series) with columns:
TimeStamp (index), Ore (t/h), WaterMill, WaterZumpf, Power, ZumpfLevel,
PressureHC, DensityHC, FE, PulpHC, PumpRPM, MotorAmp, PSI80, PSI200.
Ore quality (ore_quality table): Shisti, Daiki, Grano, Class_12, Class_15."""
```

This gives every agent the vocabulary and column names it needs without relying on schema discovery at runtime.

---

## Agent 1: Data Loader

### Role

Load data from PostgreSQL into in-memory DataFrames. Does **no analysis**.

### Key Prompt Elements

| Element                | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| Date computation rules | LLM calculates `start_date`/`end_date` from natural language ("last 72 hours") |
| Today's date injection | `{TODAY_DATE}` placeholder replaced at graph build time with `datetime.now()`  |
| Mill extraction        | Parse "all mills" → load 1–12; "Mill 8" → load just 8                          |
| Naming convention      | Each mill stored as `mill_data_N` automatically                                |
| No-analysis rule       | Explicitly told **not** to analyze data — only load it                         |

### Dynamic Date Injection

```python
# At graph build time:
today = datetime.now().strftime("%Y-%m-%d")
PROMPTS["data_loader"] = DATA_LOADER_PROMPT.replace("{TODAY_DATE}", today)
```

This means the LLM always knows today's date and can compute:

- "last 24 hours" → `end_date = 2026-03-11`, `start_date = 2026-03-10`
- "last 72 hours" → `end_date = 2026-03-11`, `start_date = 2026-03-08`

### SQL-Level Filtering

The prompt instructs the LLM to **always** pass date parameters:

```
CRITICAL: ALWAYS compute start_date and end_date to filter at SQL level.
Never load full tables.
```

This ensures the SQL query has a `WHERE` clause, preventing full-table scans of potentially millions of rows.

### Example Tool Call

The LLM produces 12 parallel tool calls:

```json
[
  {"name": "query_mill_data", "args": {"mill_number": 1, "start_date": "2026-03-08", "end_date": "2026-03-11"}},
  {"name": "query_mill_data", "args": {"mill_number": 2, "start_date": "2026-03-08", "end_date": "2026-03-11"}},
  ...
  {"name": "query_mill_data", "args": {"mill_number": 12, "start_date": "2026-03-08", "end_date": "2026-03-11"}}
]
```

---

## Agent 2: Analyst

### Role

Perform statistical analysis and generate charts using `execute_python`.

### Key Prompt Elements

| Element                   | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| Data access instructions  | `get_df('mill_data_8')`, `list_dfs()`, loop patterns   |
| Multi-mill vs single-mill | Different analysis paths depending on the request      |
| Chart quality rules       | Figure sizes, axis labels, color schemes, DPI settings |
| Output rules              | Print stats to stdout, save charts to `OUTPUT_DIR`     |

### Multi-Mill Analysis Pattern

```python
# The prompt teaches this pattern:
for i in range(1, 13):
    df = get_df(f'mill_data_{i}')
    if df is not None:
        # compute stats per mill
```

### Single-Mill Analysis Capabilities

The prompt covers a full analysis toolkit:

```
┌──────────────────────────────────────────────────────────┐
│  Single-Mill Analysis Suite                              │
│                                                          │
│  EDA            Distribution plots for Ore, PSI80,       │
│                 DensityHC, MotorAmp                       │
│                                                          │
│  SPC            Control charts (mean ± 3σ) for           │
│                 PSI80 and Ore feed rate                    │
│                                                          │
│  Correlations   Heatmap of df.corr()                     │
│                                                          │
│  Anomalies      Z-scores with threshold=3                │
│                                                          │
│  Downtime       Periods where Ore < 10 t/h               │
└──────────────────────────────────────────────────────────┘
```

### Chart Quality Standards

The prompt enforces professional chart formatting:

```python
# Required setup
sns.set_theme(style='whitegrid', font_scale=1.2)

# Figure size standards
# Bar charts:     (14, 7)
# Distributions:  (10, 6)
# SPC charts:     (14, 5)
# Heatmaps:       (12, 10)

# Mandatory elements
ax.set_xlabel('Ore Feed Rate (t/h)')  # Labels with units
ax.set_title('Descriptive Title')      # Every chart needs a title
plt.savefig(os.path.join(OUTPUT_DIR, 'chart.png'), dpi=150, bbox_inches='tight')
plt.close()                             # Always close after saving
```

### Critical Rule: Print Statistics

The analyst must print all computed statistics to stdout because the **reporter** will extract these numbers for the final report:

```
OUTPUT RULES:
- Print all key statistics to stdout (the reporter will use these numbers)
- Print a summary table at the end
```

---

## Agent 3: Code Reviewer

### Role

Validate analysis outputs — check that charts were generated and results are sensible.

### Key Prompt Elements

The code reviewer is deliberately lightweight:

1. Call `list_output_files` to see what charts exist
2. Review stdout from previous steps for errors
3. If NO charts exist → call `execute_python` to regenerate
4. If everything looks good → write a short validation summary

### Design Philosophy

The code reviewer acts as a **safety net**, not a second analyst. It:

- Does NOT regenerate existing charts
- Only fills gaps if something is clearly missing
- Provides a brief validation summary for the manager to review

---

## Agent 4: Reporter

### Role

Write a comprehensive Markdown report using actual numbers and chart references.

### Key Prompt Elements

| Element                   | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| Step-by-step instructions | 1) List files, 2) Extract stats from messages, 3) Write report         |
| Report structure template | Title, Executive Summary, Data Overview, Findings, Charts, Conclusions |
| Exact filename rule       | Only reference charts that actually exist (from `list_output_files`)   |
| Real numbers rule         | Must include actual computed statistics, not placeholders              |
| Minimum length            | Report should be at least 1000 words                                   |

### Report Structure

```markdown
# [Title matching the analysis request]

## Executive Summary

3-4 sentences with key findings and actual numbers.

## Data Overview

What data was loaded, time range, number of records.

## Findings

Organized by analyses performed.
Include actual numbers extracted from stdout.

## Charts

![Ore Comparison](ore_comparison.png)
![Histograms](ore_histograms.png)

## Conclusions & Recommendations

3-5 specific actionable items.
```

### Critical Rules

```
- Use EXACT filenames from list_output_files
- Include ACTUAL numbers from the analysis (means, stds, counts)
- Do NOT use placeholder text like "X anomalies were detected"
- Every section must have substantive content
```

---

## Agent 5: Manager (Quality Reviewer)

### Role

Review each specialist's output and decide: **ACCEPT** or **REWORK**.

### Prompt Design

The manager is intentionally concise:

```
Evaluate the last specialist's output for:
- Completeness: did they do everything asked?
- Quality: are charts well-formatted? Is the report detailed with actual numbers?
- Correctness: are there errors or unreasonable values?

Respond with EXACTLY one of:
- ACCEPT: [brief reason]
- REWORK: [specific instructions on what to fix]
```

### Decision Stamping

The manager's raw LLM response is post-processed to ensure deterministic routing:

```python
if content.upper().startswith("REWORK") or "REWORK:" in content.upper():
    stamped = f"REWORK: {content}"
else:
    stamped = f"ACCEPT: {content}"
```

The `manager_router` then checks only for the `REWORK:` prefix:

```python
if content.startswith("REWORK:"):
    return f"{current}_entry"  # send back for rework
```

This prevents ambiguous responses from causing incorrect routing.

### Auto-Accept Rules

| Condition               | Behavior                                                   |
| ----------------------- | ---------------------------------------------------------- |
| data_loader stage       | Always auto-ACCEPT (no LLM review needed for data loading) |
| Max reworks reached     | Force-ACCEPT (prevents infinite loops)                     |
| LLM error during review | ACCEPT with "Review skipped due to error"                  |

---

## Per-Specialist Tool Binding

A critical design decision: each agent only sees the tools it needs.

```python
TOOL_SETS = {
    "data_loader":    ["query_mill_data", "query_combined_data", "get_db_schema"],
    "analyst":        ["execute_python", "list_output_files"],
    "code_reviewer":  ["execute_python", "list_output_files"],
    "reporter":       ["list_output_files", "write_markdown_report"],
}

# Each specialist gets its own LLM instance with bound tools
specialist_llms[stage_name] = llm.bind_tools(stage_tools)
```

### Why This Matters

Without per-specialist binding, the LLM sees **all 6 tools** in its function-calling schema. This causes:

1. **Role confusion** — the reporter calls `query_mill_data` instead of writing a report
2. **Decision paralysis** — too many tool options reduce the LLM's reliability
3. **Wrong tool selection** — the analyst might call `write_markdown_report` prematurely

With binding, each agent's decision space is reduced to 2–3 relevant tools, dramatically improving tool-calling reliability.

---

## Context Management Strategy

### The Problem

Loading 12 mills produces ~12 JSON tool results, each ~500 chars. Combined with the system prompt, user request, and multi-iteration tool loops, the context can easily exceed the LLM's effective attention window, causing:

- Empty responses (`""`)
- Text responses instead of tool calls
- Hallucinated tool arguments

### The Solution: `build_focused_context`

Each specialist receives a **filtered view** of the conversation:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Specialist: analyst                                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ SystemMessage: ANALYST_PROMPT                     │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ HumanMessage: User request (original)             │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ HumanMessage: [Prior analysis context]:           │   │
│  │   mill_data_1 loaded: 4320 rows...                │   │
│  │   mill_data_2 loaded: 4320 rows...                │   │
│  │   (compact summaries, not full JSON)              │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ AIMessage(analyst): [tool_call: execute_python]   │   │  ← own
│  │ ToolMessage: {stdout: "...", new_files: [...]}    │   │  ← own
│  │ AIMessage(analyst): "Analysis complete."          │   │  ← own
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  NOT included:                                           │
│  ✗ 12 full query_mill_data JSON results                 │
│  ✗ data_loader's AIMessages                              │
│  ✗ Manager review messages from other stages             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Truncation Limits

```python
MAX_TOOL_OUTPUT_CHARS = 2000   # Each tool result truncated
MAX_AI_MSG_CHARS = 3000        # Each AI message truncated
MAX_MESSAGES_WINDOW = 14       # Keep last N messages in window
```

These limits balance information preservation with context window efficiency.

---

## Prompt Engineering Lessons Learned

### 1. Be Explicit About What NOT To Do

```
"Do NOT call any other tool. Do NOT analyze the data."  ← data_loader
"Do NOT regenerate charts that already exist."           ← code_reviewer
```

Without these negative constraints, the LLM frequently crosses role boundaries.

### 2. Provide Concrete Code Patterns

Instead of "access the DataFrames", the analyst prompt shows:

```python
df = get_df('mill_data_8')
for i in range(1, 13): df = get_df(f'mill_data_{i}')
```

Concrete examples are far more reliable than abstract instructions.

### 3. Inject Runtime Information

The `{TODAY_DATE}` placeholder ensures the LLM can compute date ranges without guessing. Without this, the LLM often invents dates or skips date filtering entirely.

### 4. Separate Concerns Rigidly

Each agent has one job. The analyst doesn't write reports. The reporter doesn't load data. This rigid separation, enforced by both prompts and tool binding, prevents the cascading failures common in multi-agent systems.

### 5. Print for the Next Agent

The analyst prints statistics to stdout because the reporter needs actual numbers. This creates a reliable **data handoff** channel that doesn't depend on the LLM maintaining context across stages.
