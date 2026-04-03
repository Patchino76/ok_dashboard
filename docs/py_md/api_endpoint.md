# api_endpoint.py — Agentic REST API

**File:** `python/agentic/api_endpoint.py`
**Prefix:** `/api/v1/agentic`
**MCP Server dependency:** `localhost:8003/mcp`

## Overview

Exposes the multi-agent analysis system as REST endpoints. Manages analysis lifecycle: submit → track progress → retrieve results → cleanup.

## Pydantic Models

### Request/Response

| Model | Fields |
|-------|--------|
| `AnalysisRequest` | `question` (str, required), `mill_number` (int, opt), `start_date` (str, opt), `end_date` (str, opt) |
| `AnalysisResponse` | `analysis_id`, `status`, `message`, `started_at` |
| `ProgressMessage` | `timestamp`, `stage`, `message` |
| `AnalysisResult` | `analysis_id`, `status`, `question`, `final_answer`, `report_files`, `chart_files`, `progress` (list[ProgressMessage]), `started_at`, `completed_at`, `error` |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze` | Submit analysis request → returns `analysis_id` |
| GET | `/status/{analysis_id}` | Poll progress, results, and file lists |
| GET | `/reports` | List all reports/charts across all analyses |
| GET | `/reports/{analysis_id}/{filename}` | Download a report or chart file |
| DELETE | `/analysis/{analysis_id}` | Delete analysis and its output files |

## In-Memory Tracking

`_analyses: dict[str, dict]` — keyed by `analysis_id`:

```python
{
    "status": "running" | "completed" | "failed",
    "question": "full prompt text",
    "started_at": "ISO timestamp",
    "final_answer": None | "markdown text",
    "error": None | "error description",
    "completed_at": None | "ISO timestamp",
    "progress": [
        {"timestamp": "...", "stage": "data_loader", "message": "Loading mill data..."},
        ...
    ],
}
```

## Progress Callback System

`_make_progress_callback(analysis_id)` returns a `(stage, message) -> None` closure that appends to `_analyses[id]["progress"]`. This callback is passed into `build_graph()` and invoked from every graph node, enabling real-time progress polling by the frontend.

Progress flow:
1. Backend appends `ProgressMessage` dicts to `_analyses[id]["progress"]`
2. Frontend polls `GET /status/{id}` every 4 seconds
3. Frontend reads `progress` array and displays new messages incrementally

## Background Runner: `_run_analysis_background`

Async function launched via `asyncio.create_task()`:

1. Validates `GOOGLE_API_KEY` from environment
2. Reports progress: "Connecting to MCP server..."
3. Opens `streamable_http_client` to MCP server at `localhost:8003/mcp`
4. Calls `set_output_directory` tool with analysis_id
5. Fetches LangChain tools via `get_mcp_tools(session)`
6. Builds graph with `build_graph(tools, api_key, on_progress=callback)`
7. Invokes graph with `HumanMessage(prompt)`, `recursion_limit=150`
8. On success: sets status=completed, stores final_answer
9. On failure: sets status=failed, stores error message

## Output Directory Structure

```
python/agentic/output/
├── {analysis_id_1}/
│   ├── report.md
│   ├── chart_1.png
│   └── chart_2.png
├── {analysis_id_2}/
│   └── ...
```

The `/status/{id}` endpoint scans `output/{analysis_id}/` for `.md` (reports) and `.png` (charts) files dynamically.

## File Download

`GET /reports/{analysis_id}/{filename}` returns a `FileResponse`. Falls back to flat `output/` directory for backward compatibility with older analyses.
