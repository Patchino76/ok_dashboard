# Agentic Analysis System

**Directory:** `python/agentic/`
**MCP Server Port:** 8003
**API Prefix:** `/api/v1/agentic`

## Overview

A multi-agent AI analysis system built with LangGraph and Google Gemini. Users submit natural-language analysis requests via the chat UI, and a pipeline of specialist agents performs data loading, statistical analysis, anomaly detection, forecasting, and report generation — all autonomously.

## Architecture

```
  User Question (via UI)
       │
       ▼
  POST /api/v1/agentic/analyze  (api_endpoint.py)
       │  background task
       ▼
  MCP Client Session  (client.py)
       │  connects to
       ▼
  MCP Server  (server.py :8003)
       │  provides tools
       ▼
  LangGraph Pipeline  (graph_v3.py)
       │
       ├─ data_loader  → query_mill_data / query_combined_data
       ├─ planner      → selects specialists
       ├─ specialist_1 ↔ tools ↔ manager_review
       ├─ specialist_2 ↔ tools ↔ manager_review
       ├─ ...
       ├─ code_reviewer ↔ tools ↔ manager_review
       └─ reporter     → write_markdown_report
              │
              ▼
        output/{analysis_id}/  (charts + reports)
```

## Files

### api_endpoint.py — FastAPI Router

Exposes the agentic system as REST endpoints mounted on the main API.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze` | Start an analysis — returns `analysis_id` |
| GET | `/status/{analysis_id}` | Poll analysis progress and results |
| GET | `/reports` | List all generated reports across analyses |
| GET | `/reports/{analysis_id}/{filename}` | Download a specific report or chart file |
| DELETE | `/analysis/{analysis_id}` | Delete analysis and its output files |

**In-memory tracking:** `_analyses` dictionary stores per-analysis state:
- `status` — `running` | `completed` | `failed`
- `question` — the original prompt
- `progress` — list of `{timestamp, stage, message}` progress entries
- `final_answer` — the last agent message content
- `error` — error details on failure

**Progress callback:** `_make_progress_callback(analysis_id)` creates a closure that appends progress messages to `_analyses[id]["progress"]`. This callback is passed to `build_graph()` and called from every graph node, enabling the frontend to display real-time agent progress via polling.

**Background runner:** `_run_analysis_background()` runs the full pipeline:
1. Connects to MCP server at `localhost:8003`
2. Sets per-analysis output directory
3. Fetches LangChain tools from MCP
4. Builds and invokes the LangGraph
5. Stores final answer on completion

### graph_v3.py — Multi-Agent LangGraph

**Model:** Google Gemini (`gemini-3.1-flash-lite-preview`)

#### State

```python
class AnalysisState(MessagesState):
    current_stage: str
    stages_to_run: list[str]
    stage_attempts: dict[str, int]
```

#### Pipeline Stages

Fixed prefix → dynamic specialists → fixed suffix:

| Stage | Type | Description |
|-------|------|-------------|
| `data_loader` | Fixed | Loads mill data from PostgreSQL via MCP tools |
| `planner` | Fixed | Analyzes request, selects relevant specialists |
| *specialists* | Dynamic | Selected by planner from the pool below |
| `code_reviewer` | Fixed | Validates outputs, fixes issues |
| `reporter` | Fixed | Writes final Markdown report |

#### Specialist Pool

| Specialist | Focus |
|------------|-------|
| `analyst` | EDA, SPC, correlations, distributions |
| `forecaster` | Time series forecasting, changepoints, seasonality |
| `anomaly_detective` | Multivariate anomaly detection, root cause, regimes |
| `bayesian_analyst` | Bayesian inference, credible intervals, causal analysis |
| `optimizer` | Pareto frontiers, what-if simulation, optimal setpoints |
| `shift_reporter` | Shift KPIs, benchmarking, energy efficiency |

#### Manager Review

After each specialist completes, a `manager_review` node evaluates the output:
- **ACCEPT** — advance to the next stage
- **REWORK** — send back to the same specialist with feedback

Auto-accept for `data_loader` and `planner`. Max reworks per stage is configurable (`MAX_REWORKS_PER_STAGE`).

#### Tool Binding

Each specialist is bound to a specific tool set:

| Specialist | Tools |
|------------|-------|
| `data_loader` | `query_mill_data`, `query_combined_data`, `get_db_schema` |
| `analyst`, `forecaster`, `anomaly_detective`, `bayesian_analyst`, `optimizer`, `shift_reporter`, `code_reviewer` | `execute_python`, `list_output_files` |
| `reporter` | `list_output_files`, `write_markdown_report` |

#### Key Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MAX_SPECIALIST_ITERS` | configurable | Max iterations per specialist before forced advance |
| `MAX_MESSAGES_WINDOW` | configurable | Message window for context compression |
| `MAX_TOOL_OUTPUT_CHARS` | 2000 | Truncation limit for tool output in messages |
| `MAX_AI_MSG_CHARS` | 3000 | Truncation limit for AI messages |
| `recursion_limit` | 150 | LangGraph recursion limit |

#### Progress Reporting

`build_graph()` accepts an optional `on_progress` callback. When provided, every node calls it with `(stage, message)` pairs. Human-readable labels are provided via `_STAGE_LABELS` dictionary.

### server.py — MCP Tool Server

Low-level MCP server using Starlette + uvicorn on port 8003.

- Registers tool handlers from `tools/__init__.py`
- Uses `StreamableHTTPSessionManager` for HTTP transport at `/mcp`
- Stateless — tool state lives in module-level variables within tool files

### client.py — MCP-to-LangChain Bridge

Converts MCP tool descriptors into LangChain `StructuredTool` objects:
1. Fetches tool list from MCP server
2. Converts JSON Schema → Pydantic model for each tool's `args_schema`
3. Creates async wrapper that calls `session.call_tool()` on invocation

### main.py — CLI Entry Point

Standalone script for running analyses without the API:
1. Loads `.env` for API key
2. Connects to MCP server
3. Builds graph
4. Runs demo analysis requests

### tools/ — MCP Tool Implementations

#### tools/__init__.py — Tool Registry

Maps tool names to `{tool, handler}` pairs. Adding a new tool requires only:
1. Define tool descriptor + handler in the appropriate file
2. Add one entry to the registry

#### tools/db_tools.py — Database Tools

| Tool | Description |
|------|-------------|
| `get_db_schema` | Returns table/column metadata from PostgreSQL `mills` schema |
| `query_mill_data` | Loads `MILL_XX` data into in-memory DataFrame store |
| `query_combined_data` | Loads mill + ore quality data joined on TimeStamp |

In-memory store: `_dataframes` dictionary. Access via `get_df(name)` in Python executor.

#### tools/python_executor.py — Code Execution

Executes arbitrary Python code with pre-injected namespace:

| Variable | Content |
|----------|---------|
| `df` | Default loaded DataFrame |
| `get_df(name)` | Named DataFrame from store |
| `list_dfs()` | All loaded DataFrames with shapes |
| `pd`, `np`, `plt`, `sns` | Core data science libraries |
| `scipy_stats` | `scipy.stats` module |
| `Prophet` | Facebook Prophet (time series) |
| `sm`, `tsa` | statsmodels API |
| `pmdarima` | Auto-ARIMA |
| `IsolationForest`, `DBSCAN`, `StandardScaler`, `LinearRegression` | sklearn |
| `shap` | SHAP explainability |
| `hmm` | Hidden Markov Models |
| `OUTPUT_DIR` | Per-analysis output directory |

Returns: stdout, list of newly created files, and errors.

#### tools/report_tools.py — Report Generation

| Tool | Description |
|------|-------------|
| `list_output_files` | List files in output directory (optionally filtered by extension) |
| `write_markdown_report` | Write a Markdown report file to the output directory |

#### tools/session_tools.py — Session Configuration

| Tool | Description |
|------|-------------|
| `set_output_directory` | Set output subfolder for current analysis (`output/{analysis_id}/`) |

#### tools/output_dir.py — Output Directory State

Module-level mutable state for the current output directory:
- `get_output_dir()` — returns current path (creates if needed)
- `set_output_dir(subdir)` — sets to `output/{subdir}/`
- `reset_output_dir()` — resets to default `output/`
